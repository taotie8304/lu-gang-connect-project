// 鲁港通 - 智能体浏览器操作执行器（P2 阶段一）：
// 负责灰度判断、本机/内网地址拦截、敏感字段拦截、设备在线检查、指令下发与快照格式化。
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall
} from '@fastgpt/global/core/ai/llm/type';
import type {
  DesktopAiCommand,
  DesktopBrowserResumeState,
  DesktopBrowserSnapshot,
  DesktopCommandEnvelope,
  DesktopCommandFileResult,
  DesktopCommandResult,
  DesktopDocumentEditResult,
  DesktopDocumentSummary,
  DesktopFormField,
  DesktopFormFillResult,
  DesktopFormSummary
} from '@fastgpt/global/support/desktopCommand/type';
import {
  DESKTOP_BROWSER_CLICK_RESULT_TIMEOUT_MS,
  DESKTOP_BROWSER_RESULT_TIMEOUT_MS,
  DESKTOP_COMMAND_MAX_BYTES,
  isDesktopLongWaitAction
} from './constant';
import {
  desktopCommandStore,
  type DesktopCommandStore
} from './store';

export const DESKTOP_BROWSER_ENABLED_ENV = 'LUGANG_DESKTOP_AI_BROWSER';

export type DesktopBrowserIdentity = {
  tmbId: string;
  uid?: string;
  username?: string;
  contact?: string;
};

export type DesktopBrowserOperationStore = Pick<
  DesktopCommandStore,
  | 'getDeviceByOwner'
  | 'isDeviceOnline'
  | 'enqueue'
  | 'waitForResult'
  | 'saveBrowserResume'
  | 'getBrowserResume'
  | 'getDeviceAppVersionByOwner'
>;

export type DesktopBrowserAuditRecord = {
  tmbId: string;
  uid?: string;
  chatId: string;
  deviceId?: string;
  action: string;
  url?: string;
  ok: boolean;
  code?: string;
  changed?: boolean;
  stopped?: boolean;
  /** 提交前确认结果，只记决定不记文案 */
  confirmation?: string;
  createdAt: number;
};

export type DesktopBrowserAuditWriter = (record: DesktopBrowserAuditRecord) => Promise<void>;

/** 模型工具参数的最小结构；具体校验由 browserOperation tool 的 Zod schema 负责。 */
type BrowserOperationToolArgs = Record<string, unknown> & { action: string };

type ExecutorResult = {
  response: string;
  usages: [];
  metadata?: unknown;
  error?: unknown;
};

const SENSITIVE_TARGET_PATTERN =
  /密码|密碼|口令|验证码|驗證碼|动态码|動態碼|安全码|安全碼|银行卡|銀行卡|信用卡|借记卡|借記卡|password|passcode|passwd|otp|one[- ]?time|cvv|cvc|bank\s*card|card\s*number|\bpin\b/i;

const CONTINUATION_PATTERN =
  /^(继续|繼續|接着|接著|往下|继续吧|繼續吧|继续填写|繼續填寫|continue|go on|keep going)[。.!！?？\s]*$/i;

const normalizeHost = (hostname: string): string =>
  hostname.trim().toLowerCase().replace(/\.$/, '');

const stripBrackets = (host: string): string =>
  host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

const isPrivateIpv4 = (host: string): boolean => {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const [a, b] = match.slice(1).map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
};

const isPrivateIpv6 = (host: string): boolean => {
  if (host === '::' || host === '::1') return true;
  if (/^fe[89ab][0-9a-f]?:/.test(host)) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(host);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
};

const isPrivateHost = (hostname: string): boolean => {
  const host = stripBrackets(normalizeHost(hostname));
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  return isPrivateIpv4(host) || isPrivateIpv6(host);
};

/**
 * 灰度开关：
 * - 环境变量为空、off、false、0 时关闭；
 * - all 或 * 对所有成员开启；
 * - 逗号分隔名单按邮箱、用户名、成员 ID、用户 ID 精确匹配；
 * - root 账号始终可用，便于管理员自查。
 */
export const isDesktopBrowserEnabledForUser = (
  identity: DesktopBrowserIdentity & { username?: string },
  raw: string | undefined = process.env[DESKTOP_BROWSER_ENABLED_ENV]
): boolean => {
  if ((identity.username ?? '').trim().toLowerCase() === 'root') return true;

  const value = (raw ?? '').trim().toLowerCase();
  if (!value || ['off', 'false', '0', 'no', 'disabled'].includes(value)) return false;
  if (value === 'all' || value === '*') return true;

  const candidates = [identity.username, identity.contact, identity.tmbId, identity.uid]
    .map((item) => (item ?? '').trim().toLowerCase())
    .filter(Boolean);

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .some((item) => candidates.includes(item));
};

/** 只拦截本机/内网地址与非 http(s) 协议，公网站点不设白名单。 */
export const isDesktopBrowserUrlOperable = (input: string): boolean => {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return !isPrivateHost(url.hostname);
  } catch {
    return false;
  }
};

/** 审计与续跑状态只保留源与路径，查询串和锚点可能含令牌。 */
const sanitizeUrl = (input: unknown): string => {
  if (typeof input !== 'string' || !input) return '';
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
};

const getLatestUserText = (messages: ChatCompletionMessageParam[]): string => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'user') continue;

    const content = message.content;
    if (typeof content === 'string') return content.trim().slice(0, 500);
    if (Array.isArray(content)) {
      const text = content
        .map((part) => (part && typeof part === 'object' && 'text' in part ? String(part.text) : ''))
        .join('')
        .trim();
      if (text) return text.slice(0, 500);
    }
  }
  return '';
};

const isContinuationMessage = (text: string): boolean => CONTINUATION_PATTERN.test(text.trim());

const formatSnapshot = (snapshot: DesktopBrowserSnapshot): string => {
  const lines: string[] = [];
  lines.push(`当前页面：${snapshot.title || '（无标题）'}`);
  lines.push(`地址：${snapshot.url || '未知'}`);
  lines.push(
    `滚动位置：纵向 ${snapshot.scroll.y}px / 页面高 ${snapshot.scroll.pageHeight}px，可视区 ${snapshot.scroll.viewportWidth}x${snapshot.scroll.viewportHeight}`
  );

  if (snapshot.text) {
    lines.push('页面文本：');
    lines.push(snapshot.text);
    if (snapshot.textTruncated) {
      lines.push('（页面文本已截断；需要更多内容时可以继续滚动后重新 read）');
    }
  }

  if (snapshot.elements.length > 0) {
    lines.push('可操作元素（后续操作请传对应的 ref）：');
    for (const element of snapshot.elements) {
      const details = [
        element.tag,
        element.type,
        element.placeholder ? `placeholder="${element.placeholder}"` : '',
        element.value ? `value="${element.value}"` : '',
        element.checked !== undefined ? `checked=${element.checked}` : '',
        element.disabled ? 'disabled' : '',
        element.href ? `href=${element.href}` : '',
        element.inViewport === false ? '不在视口内' : ''
      ]
        .filter(Boolean)
        .join(' ');
      lines.push(`[${element.ref}] ${element.role} "${element.name}"${details ? ` ${details}` : ''}`);
    }
    if (snapshot.elementsTruncated) {
      lines.push('（可操作元素过多，仅列出前 300 个）');
    }
  } else {
    lines.push('页面上没有识别到可操作元素。');
  }

  return lines.join('\n');
};

const FORM_KIND_LABELS: Record<DesktopFormField['kind'], string> = {
  text: '文本',
  choice: '单选项',
  checkbox: '勾选项',
  date: '日期',
  'table-cell': '表格单元格',
  unknown: '其他'
};

const FORM_FORMAT_LABELS: Record<DesktopFormSummary['format'], string> = {
  docx: 'Word 文档',
  xlsx: 'Excel 表格',
  pdf: 'PDF 表单'
};

/** open_form 只返回结构摘要，这里把它转成模型能直接照着填的字段清单 */
const formatFormSummary = (form: DesktopFormSummary): string => {
  const lines: string[] = [];
  lines.push(
    `表单已读取：${form.name}（${FORM_FORMAT_LABELS[form.format]}）${form.title ? `，标题「${form.title}」` : ''}，共 ${form.fields.length} 个字段。`
  );

  if (form.fields.length > 0) {
    lines.push('可填写字段（fill_form 时用字段 id）：');
    for (const field of form.fields) {
      const details = [
        FORM_KIND_LABELS[field.kind] ?? '其他',
        field.required ? '必填' : '',
        field.options?.length ? `可选：${field.options.join(' / ')}` : '',
        field.hint ? `提示：${field.hint}` : ''
      ]
        .filter(Boolean)
        .join('，');
      lines.push(`- ${field.id}「${field.label}」${details ? ` ${details}` : ''}`);
    }
  } else {
    lines.push('这份表单没有识别到可填写的字段。');
  }

  if (form.fieldsTruncated) {
    lines.push('（字段较多，这里只列出了一部分；其余字段需要用户自己补充）');
  }
  if (form.warnings?.length) {
    lines.push(`提示：${form.warnings.join('；')}`);
  }
  lines.push(
    '下一步：结合用户资料和办理要求，用 fill_form 按字段 id 填写；资料不全或没有把握的字段留空，并告诉用户还需要补充什么，不要编造证件号、电话、地址等个人信息。'
  );

  return lines.join('\n');
};

const formatFillResult = (
  file: DesktopCommandFileResult,
  fill: DesktopFormFillResult | undefined
): string => {
  const lines = [
    `已生成已填写的副本：${file.name}${file.folder ? `，保存在「${file.folder}」` : ''}，共填写 ${fill?.filled ?? 0} 项。`,
    '原文件没有被修改，副本只保存在你的电脑上，不会上传到服务器。'
  ];
  if (fill?.skipped?.length) {
    lines.push(`以下内容没有写入：${fill.skipped.join('；')}`);
  }
  if (fill?.warnings?.length) {
    lines.push(`提示：${fill.warnings.join('；')}`);
  }
  lines.push(
    '请让用户打开副本核对填写结果。核对无误后如果还需要上传到网页，再按用户要求用 upload（桌面客户端会再次让用户亲自选择文件）。'
  );
  return lines.join('\n');
};

const DOCUMENT_FORMAT_LABELS: Record<DesktopDocumentSummary['format'], string> = {
  docx: 'Word 文档',
  xlsx: 'Excel 表格',
  pdf: 'PDF 文档'
};

/** 鲁港通 - 文档修改从桌面端 0.6.0 起支持，服务端按注册上报的版本识别 */
export const DESKTOP_DOCUMENT_MIN_VERSION = '0.6.0';

const parseVersion = (input?: string): number[] | undefined => {
  const text = (input ?? '').trim().replace(/^v/i, '');
  if (!text) return undefined;
  const parts = text.split('.').slice(0, 3);
  const nums = parts.map((part) => Number.parseInt(part.replace(/[^0-9].*$/, ''), 10));
  if (nums.some((value) => Number.isNaN(value))) return undefined;
  while (nums.length < 3) nums.push(0);
  return nums;
};

export const isDesktopDocumentAction = (action: string): boolean =>
  action === 'open_document' || action === 'edit_document';

export const isDesktopDocumentVersionSupported = (
  version: string | undefined,
  minimum: string = DESKTOP_DOCUMENT_MIN_VERSION
): boolean => {
  const current = parseVersion(version);
  const required = parseVersion(minimum);
  if (!current || !required) return false;
  for (let index = 0; index < 3; index += 1) {
    if (current[index] > required[index]) return true;
    if (current[index] < required[index]) return false;
  }
  return true;
};

// 鲁港通 - 桌面端会整条丢弃校验失败的修改：下发前把模型常见写法归一化，并明确指出哪一项不合法
type NormalizedEditOperation = Record<string, unknown> & { op: string };

type EditOperationNormalizeResult =
  | { ok: true; operations: NormalizedEditOperation[] }
  | { ok: false; message: string };

const EDIT_OPERATION_NAMES =
  'replace_text、set_paragraph、insert_paragraph、append_paragraph、set_table_cell、set_cell、append_row';

const toEditIndex = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return undefined;
};

const editColumnLettersToIndex = (letters: string): number =>
  letters
    .toUpperCase()
    .split('')
    .reduce((total, character) => total * 26 + (character.charCodeAt(0) - 64), 0) - 1;

const toEditColumn = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value <= 100 ? value : undefined;
  }
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  const letters = /^[A-Za-z]+/.exec(trimmed)?.[0];
  if (letters) {
    const index = editColumnLettersToIndex(letters);
    return index <= 100 ? index : undefined;
  }
  return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
};

const toEditCell = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const match = /^([A-Za-z]{1,3})([1-9]\d{0,5})$/.exec(value.trim());
  return match ? `${match[1].toUpperCase()}${match[2]}` : undefined;
};

const toEditText = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  return undefined;
};

const toEditSheet = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const name = value.trim();
  return name && name.length <= 31 ? name : undefined;
};

const normalizeEditDocumentOperations = (raw: unknown): EditOperationNormalizeResult => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, message: `缺少 operations 修改清单，至少要有一条修改项（可用：${EDIT_OPERATION_NAMES}）` };
  }
  if (raw.length > 60) {
    return { ok: false, message: '单次修改不能超过 60 条，请分次提交' };
  }

  const operations: NormalizedEditOperation[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, message: `operations.${index} 不是有效的修改项` };
    }
    const record = item as Record<string, unknown>;
    const op = typeof record.op === 'string' ? record.op : '';
    const label = `operations.${index}（${op || '缺少 op'}）`;

    switch (op) {
      case 'replace_text': {
        const find = toEditText(record.find);
        if (!find || !find.trim()) {
          return { ok: false, message: `${label} 需要 find：要查找的原文，不能为空` };
        }
        const replace = toEditText(record.replace);
        if (replace === undefined) {
          return { ok: false, message: `${label} 需要 replace：替换后的文字，可以是空字符串` };
        }
        const operation: NormalizedEditOperation = { op, find, replace };
        if (record.paragraph !== undefined) {
          const paragraph = toEditIndex(record.paragraph);
          if (paragraph === undefined) {
            return { ok: false, message: `${label} 的 paragraph 需要是 0 开始的段落序号` };
          }
          operation.paragraph = paragraph;
        }
        if (record.sheet !== undefined) {
          const sheet = toEditSheet(record.sheet);
          if (!sheet) {
            return { ok: false, message: `${label} 的 sheet 需要是工作表名称（最多 31 字）` };
          }
          operation.sheet = sheet;
        }
        if (operation.paragraph !== undefined && operation.sheet !== undefined) {
          return { ok: false, message: `${label} 不能同时指定 paragraph 与 sheet` };
        }
        operations.push(operation);
        break;
      }
      case 'set_paragraph': {
        const paragraph = toEditIndex(record.paragraph);
        if (paragraph === undefined) {
          return { ok: false, message: `${label} 的 paragraph 需要是 0 开始的段落序号` };
        }
        const text = toEditText(record.text);
        if (text === undefined) {
          return { ok: false, message: `${label} 需要 text：改写后的段落文字` };
        }
        operations.push({ op, paragraph, text });
        break;
      }
      case 'insert_paragraph': {
        const after = toEditIndex(record.after);
        if (after === undefined) {
          return { ok: false, message: `${label} 的 after 需要是 0 开始的段落序号` };
        }
        const text = toEditText(record.text);
        if (text === undefined) {
          return { ok: false, message: `${label} 需要 text：要插入的段落文字` };
        }
        operations.push({ op, after, text });
        break;
      }
      case 'append_paragraph': {
        const text = toEditText(record.text);
        if (text === undefined) {
          return { ok: false, message: `${label} 需要 text：要追加的段落文字` };
        }
        operations.push({ op, text });
        break;
      }
      case 'set_table_cell': {
        const table = toEditIndex(record.table);
        if (table === undefined) {
          return { ok: false, message: `${label} 的 table 需要是 0 开始的表格序号` };
        }
        const row = toEditIndex(record.row);
        if (row === undefined) {
          return { ok: false, message: `${label} 的 row 需要是 0 开始的行号` };
        }
        const cell = toEditColumn(record.cell);
        if (cell === undefined) {
          return { ok: false, message: `${label} 的 cell 需要是 0 开始的列号或 B 这样的列字母` };
        }
        const text = toEditText(record.text);
        if (text === undefined) {
          return { ok: false, message: `${label} 需要 text：单元格要写入的文字` };
        }
        operations.push({ op, table, row, cell, text });
        break;
      }
      case 'set_cell': {
        const sheet = toEditSheet(record.sheet);
        if (!sheet) {
          return { ok: false, message: `${label} 的 sheet 需要是工作表名称（最多 31 字）` };
        }
        const cell = toEditCell(record.cell);
        if (!cell) {
          return { ok: false, message: `${label} 需要 cell：单元格地址要写成 B10 这样的格式` };
        }
        const value = toEditText(record.value);
        if (value === undefined) {
          return { ok: false, message: `${label} 需要 value：要写入单元格的内容` };
        }
        operations.push({ op, sheet, cell, value });
        break;
      }
      case 'append_row': {
        const sheet = toEditSheet(record.sheet);
        if (!sheet) {
          return { ok: false, message: `${label} 的 sheet 需要是工作表名称（最多 31 字）` };
        }
        if (!Array.isArray(record.values) || record.values.length === 0) {
          return { ok: false, message: `${label} 需要 values：按列顺序给出这一行的内容` };
        }
        if (record.values.length > 50) {
          return { ok: false, message: `${label} 的 values 不能超过 50 列` };
        }
        const values: string[] = [];
        for (const cellValue of record.values) {
          const text = toEditText(cellValue);
          if (text === undefined) {
            return { ok: false, message: `${label} 的 values 只能包含文字或数字` };
          }
          values.push(text);
        }
        operations.push({ op, sheet, values });
        break;
      }
      default:
        return {
          ok: false,
          message: `${label} 不是支持的修改方式（可用：${EDIT_OPERATION_NAMES}）`
        };
    }
  }

  return { ok: true, operations };
};

/** open_document 与 read 返回段落序号与表格、工作表结构，模型据此生成 edit_document 指令 */
const formatDocumentSummary = (
  document: DesktopDocumentSummary,
  source: 'open_document' | 'read',
  documentToken?: string
): string => {
  const heading =
    source === 'read'
      ? `右栏打开的文件已读取：${document.name}（${DOCUMENT_FORMAT_LABELS[document.format]}）。`
      : `文档已读取：${document.name}（${DOCUMENT_FORMAT_LABELS[document.format]}）。`;

  // 鲁港通 - PDF 只能读，不能作为 edit_document 的修改目标
  if (document.format === 'pdf') {
    return [
      heading,
      'PDF 只能读取，不能修改。需要修改时，请让用户先把文件另存为 Word 或 Excel，再用 open_document 打开。'
    ].join('\n');
  }

  const lines: string[] = [heading];

  // 鲁港通 - 提纲必须带上 token，否则模型只能凭空猜，第一次修改一定失败
  if (documentToken) {
    lines.push(
      `文档 token：${documentToken}。调用 edit_document 时必须把这个值原样放进 token 字段；每次读取都会换新 token，修改成功后旧 token 失效，需要接着改就重新读取。`
    );
  }

  if (document.paragraphs?.length) {
    lines.push('段落（方括号内是段落序号，修改时直接使用）：');
    for (const paragraph of document.paragraphs) {
      lines.push(
        `- [${paragraph.index}] ${paragraph.text}${paragraph.style ? `（样式：${paragraph.style}）` : ''}`
      );
    }
  }
  if (document.tables?.length) {
    lines.push('表格（序号从 0 开始，改单元格时用表格序号、行号、列号）：');
    for (const table of document.tables) {
      lines.push(
        `- 表 ${table.index}：${table.rows} 行 ${table.cells} 列${table.header.length ? `，表头：${table.header.join(' | ')}` : ''}`
      );
    }
  }
  if (document.sheets?.length) {
    lines.push('工作表（单元格地址按工作表真实列字母与行号书写，例如 B11）：');
    for (const sheet of document.sheets) {
      const headerRow = sheet.headerRow && sheet.headerRow > 0 ? sheet.headerRow : 1;
      const headerNote = sheet.header.length
        ? `，表头在第 ${headerRow} 行：${sheet.header.join(' | ')}`
        : '';
      lines.push(`- 「${sheet.name}」${sheet.rowCount} 行 ${sheet.columnCount} 列${headerNote}`);
      const rowNumbers = sheet.sampleRowNumbers ?? sheet.sampleRows.map((_, index) => index + 2);
      sheet.sampleRows.forEach((row, index) => {
        const cells = [...row];
        while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
        lines.push(`  第 ${rowNumbers[index] ?? index + 2} 行：${cells.join(' | ')}`);
      });
      if (sheet.rowLabels?.length) {
        lines.push(
          `  行标签（可直接按行号用 set_cell 填写）：${sheet.rowLabels
            .map((item) => `第 ${item.row} 行 ${item.text}`)
            .join('；')}`
        );
        if (sheet.rowLabelsTruncated) {
          lines.push('  （标签行较多，只列出前一部分；其余行可按行号继续填写）');
        }
      }
    }
  }
  if (document.paragraphsTruncated) {
    lines.push('（段落较多，这里只列出了前一部分；其余段落需要用户自己处理）');
  }
  if (document.sheetsTruncated) {
    lines.push('（工作表较多，这里只列出了前几张）');
  }
  if (document.warnings?.length) {
    lines.push(`提示：${document.warnings.join('；')}`);
  }
  lines.push(
    '下一步：直接按用户要求用 edit_document 提交修改，token 用上面给出的文档 token；不要先反问，也不要等用户再次确认，右栏的改动清单就是修改前的确认环节，由用户确认后才会写入。可改：替换文字（replace_text，可按段落限定）、整段改写（set_paragraph）、在某段后插入（insert_paragraph）、文末追加（append_paragraph）、改表格单元格（set_table_cell）、改 Excel 单元格（set_cell，地址按真实行号与列字母书写）、工作表追加一行（append_row）。只写副本，原文件不会被改动。填写 Excel 时，按提纲里带行号的现有行用 set_cell 把内容写进对应单元格，不要用 append_row 把示范内容堆在表尾，也不要用 generate_file 另建文件代替修改；用户没提供的数字可以按合理估计先填，并在备注列标注「待核对」，不要停下来反复确认。替换与改写合计最多 50 处、插入追加最多 20 段、Excel 单元格最多 200 个，一次提交的改动控制在 30 条以内，多了就分两次提交，避免参数过长被截断。如果客户端指出参数问题，按提示修正后立即重新发送，不要改为让用户手动修改。'
  );

  return lines.join('\n');
};

const formatEditResult = (
  file: DesktopCommandFileResult,
  edit: DesktopDocumentEditResult | undefined
): string => {
  const lines = [
    `已生成修改后的副本：${file.name}${file.folder ? `，保存在「${file.folder}」` : ''}，共完成 ${edit?.applied ?? 0} 处修改。`,
    '原文件没有被修改，副本只保存在你的电脑上，不会上传到服务器。'
  ];
  if (edit?.skipped?.length) {
    lines.push(`以下改动没有写入：${edit.skipped.join('；')}`);
  }
  if (edit?.warnings?.length) {
    lines.push(`提示：${edit.warnings.join('；')}`);
  }
  lines.push(
    '请让用户打开副本核对修改结果。需要继续修改同一份文档时，先重新用 open_document 打开（副本或原文件）再提交，不要复用旧 token。'
  );
  return lines.join('\n');
};

const guidanceForCode = (code?: string, action?: string): string | undefined => {
  const isFormFill = action === 'fill_form';
  const isDocumentEdit = action === 'edit_document';

  switch (code) {
    case 'not_found':
      return '找不到目标元素。页面可能已经变化，请先重新读取页面，再决定下一步操作。';
    case 'ambiguous':
      return '匹配到多个可能的元素。请改用元素引用（ref）重新操作。';
    case 'verification_failed':
      return '操作后没有检测到预期变化。请先重新读取页面，确认是否已经成功。';
    case 'not_allowed':
      return '当前页面指向本机或内网地址，不能代为操作。请让用户在自己的浏览器里处理，或先导航到对外的网页。';
    case 'page_error':
      return '页面加载失败或已被关闭。桌面客户端会尝试自动恢复；请先重新读取页面确认已经恢复，再从中断的步骤继续。如果页面仍未恢复，请让用户重新打开页面后再继续。';
    case 'page_closed_twice':
      return '页面被连续关闭两次，本次操作已停止。请先询问用户是否继续，得到用户确认后再重新打开页面继续操作，不要自己重试。';
    case 'sensitive_blocked':
      return '该操作涉及密码、验证码、银行卡或支付信息，必须由用户本人手动完成。';
    case 'high_risk_blocked':
      return '该操作涉及支付、转账或购买，属于资金类操作，必须由用户本人手动完成。';
    case 'cancelled_by_user':
      return '用户取消了文件选择，本次没有上传。请不要重试；等用户准备好文件并明确要求后再继续。';
    case 'not_file_input':
      return '目标不是文件上传入口。请先重新读取页面，选择正确的上传按钮。';
    case 'upload_failed':
      return '文件没有成功附加到页面。请让用户手动选择文件上传，不要在没有文件的情况下提交。';
    case 'file_generation_failed':
      return '文件没有生成成功。请调整文件名或内容后重新生成；如果仍然失败，请让用户自行准备文件。';
    case 'unsupported_action':
      return '当前桌面客户端版本不支持这个操作。请让用户把客户端升级到最新版本后再试，不要重复调用。';
    case 'form_open_failed':
      return '表单文件没有读取成功。请让用户确认文件能正常打开（支持 Word、Excel 和可填写 PDF，扫描件和图片 PDF 不支持）后重新选择。';
    case 'form_cancelled':
      return '用户取消了选择表单，本次没有填写任何内容。请不要重试；等用户准备好表单并明确要求后再继续。';
    case 'form_expired':
      return '这份表单已经失效（可能已经填写过，或上一次读取已经过期）。请重新用 open_form 让用户选择同一份表单，再按返回的新字段清单填写。';
    case 'form_field_blocked':
      return '表单里有密码、验证码或银行卡类字段，这类信息必须由用户本人填写，本次没有生成副本。请让用户手动填写这些字段。';
    case 'form_field_not_found':
      return '给出的字段在这份表单里都没有找到。请重新用 open_form 读取表单，按返回的字段 id 填写。';
    case 'form_fill_failed':
      return '已填写的副本没有生成成功。请不要反复重试，改为让用户手动填写原表单；如果用户愿意，也可以换一份 Word 或 Excel 表单再试。';
    case 'pdf_font_missing':
      return '这台电脑缺少填写 PDF 需要的中文字体，副本没有生成。请让用户手动填写这份 PDF，或改用 Word、Excel 格式的表单。';
    case 'desktop_upgrade_required':
      return '当前桌面客户端版本较旧，还不支持直接修改本机 Word/Excel 文件。请让用户把客户端升级到最新版本（客户端内检查更新）后再试，升级前不要改用其他方式自行改写用户文件。';
    case 'document_open_failed':
      return '这份文档没有读取成功。请让用户确认文件能正常打开（目前支持 Word .docx 与 Excel .xlsx）后重新用 open_document 选择。';
    case 'document_cancelled':
      return '用户取消了选择文档，本次没有做任何修改。请不要重试；等用户准备好文件并明确要求后再继续。';
    case 'document_expired':
      return '这份文档已经失效（可能已经修改过，或上一次读取已经过期）。请重新用 open_document 让用户选择同一份文档，再按返回的段落序号提交 edit_document。';
    case 'document_no_change':
      return '文档里没有找到需要修改的内容，本次没有生成副本，原文件也没有变化。请重新用 open_document 读取文档，确认要修改的段落或文字后再试，不要反复重试。';
    case 'document_edit_failed':
      return '修改副本没有生成成功。请不要反复重试，改为让用户手动修改原文档；如果用户愿意，也可以换一份 Word 或 Excel 文件再试。';
    case 'invalid_command':
      return '桌面客户端没有接受这条指令，参数不符合要求。请按提示修正后立即重新发送，不要重复发送同一条指令，也不要改为让用户手动修改。';
    case 'confirmation_unavailable':
      return isFormFill
        ? '桌面客户端无法弹出填写确认框，本次没有写入任何内容。请不要重试，改为让用户自己填写原表单。'
        : isDocumentEdit
          ? '桌面客户端无法弹出修改确认框，本次没有改动任何文件。请不要重试，改为让用户手动修改原文档。'
          : '桌面客户端无法弹出提交确认框，本次没有提交。请不要重试，改为让用户自己提交。';
    case 'handed_over':
      return '用户选择了自己提交，页面已交还给你本人，AI 不会重试或再次提交。请不要重试；等用户反馈结果后再继续。';
    case 'confirmation_declined':
      return isFormFill
        ? '用户取消了这次填写确认，没有生成副本，原文件也没有变化。请不要重试，也不要再次调用 fill_form；等用户明确要求后再继续。'
        : isDocumentEdit
          ? '用户取消了这次修改确认，没有生成副本，原文件也没有变化。请不要重试，也不要再次调用 edit_document；等用户明确要求后再继续。'
          : '用户取消了这次提交，页面没有变化。请不要重试，也不要再次提交；等用户明确要求后再继续。';
    case 'confirmation_timeout':
      return isFormFill
        ? '填写确认等待超过 5 分钟，已自动取消，本次没有生成副本。请不要重试；如需继续，请让用户重新发起并确认。'
        : isDocumentEdit
          ? '修改确认等待超过 5 分钟，已自动取消，本次没有生成副本。请不要重试；如需继续，请让用户重新发起并确认。'
          : '提交确认等待超过 5 分钟，已自动取消，本次没有提交。请不要重试；如需提交，请让用户重新发起并确认。';
    default:
      return undefined;
  }
};

const buildResumeHint = (resume: DesktopBrowserResumeState): string =>
  [
    `上一轮浏览器任务：${resume.goal}`,
    `上次停留页面：${resume.url}`,
    '请先读取当前页面，确认页面状态后再继续操作；如果不是同一个任务，请忽略这段提示。'
  ].join('\n');

/**
 * 创建智能体浏览器操作执行器。
 * 每个动作发送一条指令并等待桌面端回传结果；审计写入失败不影响主流程。
 */
export const createDesktopBrowserOperationExecutor = ({
  store = desktopCommandStore,
  identity,
  chatId,
  isStopped = () => false,
  audit = async (record) => {
    const { writeDesktopBrowserAudit } = await import('./browserAudit');
    await writeDesktopBrowserAudit(record);
  },
  sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
  resultTimeoutMs = DESKTOP_BROWSER_RESULT_TIMEOUT_MS
}: {
  store?: DesktopBrowserOperationStore;
  identity: DesktopBrowserIdentity;
  chatId: string;
  isStopped?: () => boolean;
  audit?: DesktopBrowserAuditWriter;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  resultTimeoutMs?: number;
}) => {
  let resumeLoaded = false;
  let cachedResume: DesktopBrowserResumeState | undefined;
  let resumeHintShown = false;

  const loadResume = async () => {
    if (resumeLoaded) return cachedResume;
    resumeLoaded = true;
    try {
      cachedResume = await store.getBrowserResume({ tmbId: identity.tmbId, chatId });
    } catch {
      cachedResume = undefined;
    }
    return cachedResume;
  };

  return async ({
    call,
    messages
  }: {
    call: ChatCompletionMessageToolCall;
    messages: ChatCompletionMessageParam[];
  }): Promise<ExecutorResult> => {
    const finish = async ({
      response,
      action,
      deviceId,
      url,
      ok,
      code,
      changed,
      stopped,
      confirmation
    }: {
      response: string;
      action: string;
      deviceId?: string;
      url?: string;
      ok: boolean;
      code?: string;
      changed?: boolean;
      stopped?: boolean;
      confirmation?: string;
    }): Promise<ExecutorResult> => {
      try {
        await audit({
          tmbId: identity.tmbId,
          uid: identity.uid,
          chatId,
          deviceId,
          action,
          url: url || undefined,
          ok,
          code,
          changed,
          stopped,
          confirmation,
          createdAt: now()
        });
      } catch {
        // 审计失败不能阻断用户的办事流程
      }
      return { response, usages: [] };
    };

    let args: BrowserOperationToolArgs;
    try {
      const parsed = JSON.parse(call.function.arguments || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return finish({
          response: '浏览器操作参数格式不正确，需要提供包含 action 的 JSON 对象。',
          action: 'unknown',
          ok: false,
          code: 'invalid_args'
        });
      }
      args = parsed as BrowserOperationToolArgs;
    } catch {
      return finish({
        response:
          '浏览器操作参数不是有效的 JSON。请检查引号与括号，并把改动拆小、分两次提交（一次 20 条以内），整理后立即重新发送，不要改为让用户手动修改文件。',
        action: 'unknown',
        ok: false,
        code: 'invalid_args'
      });
    }

    const action = typeof args.action === 'string' ? args.action : 'unknown';
    const target = typeof args.target === 'string' ? args.target : '';
    const requestUrl = action === 'navigate' ? sanitizeUrl(args.url) : '';
    const currentGoal = getLatestUserText(messages);

    if (isStopped()) {
      return finish({
        response: '你已停止本次操作，我没有向桌面客户端发送任何指令。',
        action,
        url: requestUrl,
        ok: false,
        code: 'stopped',
        stopped: true
      });
    }

    if (target && SENSITIVE_TARGET_PATTERN.test(target)) {
      return finish({
        response:
          '为保护你的账号安全，密码、验证码、银行卡和支付信息必须由你本人手动输入。请你在页面中自行填写后再继续。',
        action,
        url: requestUrl,
        ok: false,
        code: 'sensitive_blocked'
      });
    }

    if (action === 'navigate') {
      const url = typeof args.url === 'string' ? args.url : '';
      if (!isDesktopBrowserUrlOperable(url)) {
        return finish({
          response:
            '这个地址是本机或内网地址，为安全起见不能代为打开。请提供对外的网页地址，或者让用户在自己的浏览器里打开。',
          action,
          url: requestUrl,
          ok: false,
          code: 'not_allowed'
        });
      }
    }

    const deviceId = await store.getDeviceByOwner(identity.tmbId);
    if (!deviceId) {
      return finish({
        response: '没有找到与你账号关联的桌面客户端。请先打开桌面客户端并登录，然后再让我操作浏览器。',
        action,
        url: requestUrl,
        ok: false,
        code: 'device_missing'
      });
    }

    const online = await store.isDeviceOnline(deviceId);
    if (!online) {
      return finish({
        response: '你的桌面客户端当前不在线。请先打开桌面客户端并保持其运行，然后重试。',
        action,
        deviceId,
        url: requestUrl,
        ok: false,
        code: 'device_offline'
      });
    }

    // 鲁港通 - 文档修改依赖 0.6.0 起的桌面端，旧客户端直接引导升级而不是下发无法执行的指令
    if (isDesktopDocumentAction(action)) {
      const appVersion = await store.getDeviceAppVersionByOwner(identity.tmbId);
      if (!isDesktopDocumentVersionSupported(appVersion)) {
        return finish({
          response:
            '当前桌面客户端版本较旧，还不支持直接修改本机 Word/Excel 文件。请让用户把客户端升级到最新版本（客户端内检查更新）后再试。',
          action,
          deviceId,
          url: requestUrl,
          ok: false,
          code: 'desktop_upgrade_required'
        });
      }
    }

    let command: DesktopAiCommand;
    if (action === 'edit_document') {
      // 鲁港通 - 先归一化再下发：桌面端整条丢弃的指令在这里就修正或明确指出来
      const token = typeof args.token === 'string' ? args.token.trim() : '';
      if (!token) {
        return finish({
          response:
            '修改指令缺少 token。请先用 open_document 打开要修改的文档，再用返回的 token 立即重新发送 edit_document。',
          action,
          deviceId,
          url: requestUrl,
          ok: false,
          code: 'invalid_args'
        });
      }
      const normalized = normalizeEditDocumentOperations(args.operations);
      if (!normalized.ok) {
        return finish({
          response: `这条修改指令格式不正确：${normalized.message}。请修正后立即重新发送，不要改为让用户手动修改文件。`,
          action,
          deviceId,
          url: requestUrl,
          ok: false,
          code: 'invalid_args'
        });
      }
      command = { action, token, operations: normalized.operations };
    } else if (action === 'wait') {
      const seconds = typeof args.seconds === 'number' ? args.seconds : 1;
      await sleep(Math.max(1, Math.min(10, seconds)) * 1000);

      if (isStopped()) {
        return finish({
          response: '你已停止本次操作，我没有向桌面客户端发送任何指令。',
          action,
          deviceId,
          ok: false,
          code: 'stopped',
          stopped: true
        });
      }

      command = { action: 'read' };
    } else {
      command = args;
    }

    // 鲁港通 - 指令通道限制 128KB：超限时提前给出可操作提示，避免通用入队错误
    if (Buffer.byteLength(JSON.stringify(command), 'utf8') > DESKTOP_COMMAND_MAX_BYTES) {
      return finish({
        response:
          '本次操作携带的内容过多，无法发送到桌面客户端。请缩短文件正文、减少表格行数或精简填写内容后重试（正文最多 12000 字，表格合计最多 200 行）。',
        action,
        deviceId,
        url: requestUrl,
        ok: false,
        code: 'command_too_large'
      });
    }

    let envelope: DesktopCommandEnvelope;
    try {
      envelope = await store.enqueue({ deviceId, command });
    } catch {
      return finish({
        response: '浏览器操作指令发送失败，请稍后重试。',
        action,
        deviceId,
        url: requestUrl,
        ok: false,
        code: 'enqueue_failed'
      });
    }

    // 提交类点击等待用户在原生确认框做决定，上传与表单动作等待用户亲自选文件或确认填写
    const timeoutMs = isDesktopLongWaitAction(action)
      ? Math.max(resultTimeoutMs, DESKTOP_BROWSER_CLICK_RESULT_TIMEOUT_MS)
      : resultTimeoutMs;
    const result: DesktopCommandResult | undefined = await store.waitForResult({
      commandId: envelope.id,
      timeoutMs
    });

    if (!result) {
      return finish({
        response: `桌面客户端在 ${Math.round(timeoutMs / 1000)} 秒内没有返回结果。如果系统正在等你确认操作或选择文件，请先完成确认或选择文件；否则请让用户确认桌面客户端仍在前台运行，然后重试。`,
        action,
        deviceId,
        url: requestUrl,
        ok: false,
        code: 'timeout'
      });
    }

    const snapshot = result.snapshot;
    const resultUrl = snapshot?.url || requestUrl;
    // 鲁港通 - 表单与文档动作只处理本机文件，不改变页面位置，也不应覆盖或打断页面续跑状态
    const touchesPage =
      action !== 'open_form' &&
      action !== 'fill_form' &&
      action !== 'open_document' &&
      action !== 'edit_document' &&
      // read 读到的是右栏本机文件时同样不涉及网页
      !(action === 'read' && result.document);
    const resume = await loadResume();
    const hint =
      touchesPage && !resumeHintShown && resume && resume.goal !== currentGoal
        ? buildResumeHint(resume)
        : '';
    if (hint) resumeHintShown = true;

    const snapshotBlock = snapshot ? `\n\n${formatSnapshot(snapshot)}` : '';
    const prefix = hint ? `${hint}\n\n` : '';

    if (!result.ok) {
      const guidance =
        guidanceForCode(result.code, action) ??
        (result.stopped
          ? `${result.message ?? '操作已被桌面客户端停止。'}\n\n请先询问用户接下来怎么做，得到确认后再继续，不要自行重试。`
          : isDesktopDocumentAction(action)
            ? '操作没有成功。请按提示调整参数后立即重新发送，不要改为让用户手动修改文件。'
            : '浏览器操作没有成功。请先重新读取页面，确认页面状态后再试。');
      // 鲁港通 - 客户端会回传具体是哪一项不合法，原样带给模型才能照着改
      const detail =
        result.code === 'invalid_command' && result.message
          ? `\n错误原因：${result.message}`
          : '';
      const message = `${prefix}${guidance}${detail}${snapshotBlock}`;

      return finish({
        response: message,
        action,
        deviceId,
        url: resultUrl || resume?.url,
        ok: false,
        code: result.code || (result.stopped ? 'stopped' : 'failed'),
        changed: result.changed,
        stopped: result.stopped,
        confirmation: result.confirmation?.decision
      });
    }

    // 鲁港通 - 读取文件成功却没带回内容时不能说「操作已执行」，否则模型会误以为已经拿到提纲
    if (action === 'open_document' && !result.document) {
      return finish({
        response:
          '客户端没有返回文档内容，这次读取没有成功。请重新用 open_document 打开要修改的文件；如果反复没有返回内容，请让用户确认文件能正常打开后再试。',
        action,
        deviceId,
        url: resultUrl || resume?.url,
        ok: false,
        code: 'document_missing'
      });
    }

    const fileNote =
      result.file && action === 'generate_file'
        ? `文件已生成：${result.file.name}${result.file.folder ? `，保存在「${result.file.folder}」` : ''}。文件只保存在你的电脑上，不会上传到服务器，也不会进入知识库。请让用户确认内容后再用于上传。`
        : result.file && action === 'upload'
          ? `文件「${result.file.name}」已附加到页面。请让用户核对页面显示的文件是否正确。`
          : '';
    const formNote =
      result.form && action === 'open_form'
        ? formatFormSummary(result.form)
        : result.fill && result.file && action === 'fill_form'
          ? formatFillResult(result.file, result.fill)
          : '';
    const documentNote =
      result.document && (action === 'open_document' || action === 'read')
        ? formatDocumentSummary(
            result.document,
            action === 'read' ? 'read' : 'open_document',
            result.documentToken
          )
        : result.edit && result.file && action === 'edit_document'
          ? formatEditResult(result.file, result.edit)
          : '';
    const confirmationNote =
      result.confirmation?.required && result.confirmation.decision === 'allow'
        ? '你已确认，页面已提交并执行。本轮操作到此结束，不要再次提交。'
        : '';
    const successLead =
      fileNote ||
      formNote ||
      documentNote ||
      (confirmationNote ? `操作已执行。${confirmationNote}` : '操作已执行。');
    const changedNote =
      result.changed === false
        ? '\n页面没有检测到明显变化。如果操作没有生效，请先重新读取页面确认状态。'
        : '';
    const response = `${prefix}${successLead}${changedNote}${snapshotBlock}`;

    const continuation = isContinuationMessage(currentGoal);
    const goal = continuation
      ? resume?.goal || currentGoal
      : currentGoal || resume?.goal || '';
    const resumeUrl = resultUrl || resume?.url || '';

    if (touchesPage && goal && resumeUrl) {
      const nextResume: DesktopBrowserResumeState = {
        goal,
        url: resumeUrl,
        updatedAt: now()
      };
      try {
        await store.saveBrowserResume({
          tmbId: identity.tmbId,
          chatId,
          resume: nextResume
        });
        cachedResume = nextResume;
      } catch {
        // 续跑状态属于体验增强，写失败不应影响当前操作结果
      }
    }

    return finish({
      response,
      action,
      deviceId,
      url: resultUrl || resume?.url,
      ok: true,
      changed: result.changed,
      stopped: result.stopped,
      confirmation: result.confirmation?.decision
    });
  };
};

export {
  DESKTOP_BROWSER_CLICK_RESULT_TIMEOUT_MS,
  DESKTOP_BROWSER_RESUME_TTL_MS,
  DESKTOP_BROWSER_RESULT_TIMEOUT_MS,
  DESKTOP_BROWSER_UPLOAD_RESULT_TIMEOUT_MS
} from './constant';
