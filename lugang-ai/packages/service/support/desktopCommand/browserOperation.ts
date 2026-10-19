// 鲁港通 - 智能体浏览器操作执行器（P2 阶段一）：
// 负责灰度判断、官方站点白名单、敏感字段拦截、设备在线检查、指令下发与快照格式化。
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall
} from '@fastgpt/global/core/ai/llm/type';
import type {
  DesktopAiCommand,
  DesktopBrowserResumeState,
  DesktopBrowserSnapshot,
  DesktopCommandEnvelope,
  DesktopCommandResult
} from '@fastgpt/global/support/desktopCommand/type';
import {
  DESKTOP_BROWSER_RESULT_TIMEOUT_MS,
  DESKTOP_BROWSER_RESUME_TTL_MS
} from './constant';
import {
  desktopCommandStore,
  type DesktopCommandStore
} from './store';

export const DESKTOP_BROWSER_ENABLED_ENV = 'LUGANG_DESKTOP_AI_BROWSER';
export const DESKTOP_BROWSER_ALLOWED_HOSTS_ENV = 'LUGANG_AI_ALLOWED_HOSTS';
export const DESKTOP_BROWSER_DEFAULT_ALLOWED_HOSTS = ['.gov.hk', '.gov.cn'];

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
  /密码|密碼|口令|验证码|驗證碼|动态码|動態碼|安全码|安全碼|password|passcode|passwd|otp|one[- ]?time|cvv|cvc|\bpin\b/i;

const CONTINUATION_PATTERN =
  /^(继续|繼續|接着|接著|往下|继续吧|繼續吧|继续填写|繼續填寫|continue|go on|keep going)[。.!！?？\s]*$/i;

const normalizeEntry = (entry: string): string => {
  const trimmed = entry.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('.') ? `.${trimmed.slice(1).replace(/\.$/, '')}` : trimmed.replace(/\.$/, '');
};

export const parseDesktopBrowserAllowedHosts = (
  raw: string | undefined = process.env[DESKTOP_BROWSER_ALLOWED_HOSTS_ENV]
): string[] => {
  const entries = (raw ?? '')
    .split(',')
    .map(normalizeEntry)
    .filter(Boolean);
  return entries.length > 0 ? entries : [...DESKTOP_BROWSER_DEFAULT_ALLOWED_HOSTS];
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

/** 仅允许 http(s) 且命中官方站点白名单；后缀匹配防止 gov.hk.evil.com 这类仿冒域名。 */
export const isDesktopBrowserUrlAllowed = (
  input: string,
  allowedHosts: string[] = parseDesktopBrowserAllowedHosts()
): boolean => {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return allowedHosts
      .map(normalizeEntry)
      .filter(Boolean)
      .some((entry) =>
        entry.startsWith('.') ? host === entry.slice(1) || host.endsWith(entry) : host === entry
      );
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

const guidanceForCode = (code?: string): string => {
  switch (code) {
    case 'not_found':
      return '找不到目标元素。页面可能已经变化，请先重新读取页面，再决定下一步操作。';
    case 'ambiguous':
      return '匹配到多个可能的元素。请改用元素引用（ref）重新操作。';
    case 'verification_failed':
      return '操作后没有检测到预期变化。请先重新读取页面，确认是否已经成功。';
    case 'page_error':
      return '页面加载失败或已被关闭。桌面客户端会尝试恢复；如果仍未恢复，请让用户重新打开页面。';
    case 'sensitive_blocked':
      return '该操作涉及密码、验证码或支付等敏感信息，必须由用户本人手动完成。';
    case 'high_risk_blocked':
      return '该操作可能触发支付或最终提交，已被安全策略拦截。请让用户本人确认后手动操作。';
    default:
      return '浏览器操作没有成功。请先重新读取页面，确认页面状态后再试。';
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
      stopped
    }: {
      response: string;
      action: string;
      deviceId?: string;
      url?: string;
      ok: boolean;
      code?: string;
      changed?: boolean;
      stopped?: boolean;
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
        response: '浏览器操作参数不是有效的 JSON，请重新整理参数后再试。',
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
          '为保护你的账号安全，密码、验证码和支付信息必须由你本人手动输入。请你在页面中自行填写后再继续。',
        action,
        url: requestUrl,
        ok: false,
        code: 'sensitive_blocked'
      });
    }

    if (action === 'navigate') {
      const url = typeof args.url === 'string' ? args.url : '';
      if (!isDesktopBrowserUrlAllowed(url)) {
        return finish({
          response:
            '当前只允许操作政府官方网站（如 gov.hk、gov.cn），该地址不在允许范围内。请提供官方办事页面地址。',
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

    let command: DesktopAiCommand;
    if (action === 'wait') {
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

    const result: DesktopCommandResult | undefined = await store.waitForResult({
      commandId: envelope.id,
      timeoutMs: resultTimeoutMs
    });

    if (!result) {
      return finish({
        response: `桌面客户端在 ${Math.round(resultTimeoutMs / 1000)} 秒内没有返回结果。请确认客户端仍在前台运行，然后重试。`,
        action,
        deviceId,
        url: requestUrl,
        ok: false,
        code: 'timeout'
      });
    }

    const snapshot = result.snapshot;
    const resultUrl = snapshot?.url || requestUrl;
    const resume = await loadResume();
    const hint =
      !resumeHintShown && resume && resume.goal !== currentGoal ? buildResumeHint(resume) : '';
    if (hint) resumeHintShown = true;

    const snapshotBlock = snapshot ? `\n\n${formatSnapshot(snapshot)}` : '';
    const prefix = hint ? `${hint}\n\n` : '';

    if (!result.ok) {
      const guidance = result.stopped
        ? '操作已被桌面客户端停止。请先重新读取页面，确认当前状态。'
        : guidanceForCode(result.code);
      const message = `${prefix}${guidance}${snapshotBlock}`;

      return finish({
        response: message,
        action,
        deviceId,
        url: resultUrl || resume?.url,
        ok: false,
        code: result.code || (result.stopped ? 'stopped' : 'failed'),
        changed: result.changed,
        stopped: result.stopped
      });
    }

    const changedNote =
      result.changed === false
        ? '\n页面没有检测到明显变化。如果操作没有生效，请先重新读取页面确认状态。'
        : '';
    const response = `${prefix}操作已执行。${changedNote}${snapshotBlock}`;

    const continuation = isContinuationMessage(currentGoal);
    const goal = continuation
      ? resume?.goal || currentGoal
      : currentGoal || resume?.goal || '';
    const resumeUrl = resultUrl || resume?.url || '';

    if (goal && resumeUrl) {
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
      stopped: result.stopped
    });
  };
};

export { DESKTOP_BROWSER_RESUME_TTL_MS, DESKTOP_BROWSER_RESULT_TIMEOUT_MS };
