// 鲁港通 - AI 指令执行器：定位、动作前安全拦截、动作后页面校验
import { randomUUID } from 'node:crypto';
import { AiDriverError } from './cdpDriver';
import { FormFillError, FormParseError } from './form/types';
import type {
  FilledFormCopy,
  FormFillValue,
  FormSummary,
  ParsedForm
} from './form/types';
import { toFormSummary } from './form/parse';
import type { EditedDocumentCopy } from './document/editTypes';
import { DocumentParseError } from './document/types';
import type { DocumentSummary, ParsedDocument } from './document/types';
import { toDocumentSummary } from './document/parse';
import { isAiPrivateHost, isAiSnapshotUrlAllowed } from './urlPolicy';
import {
  isConfirmableActionLabel,
  isPaymentActionLabel,
  isSensitiveElement,
  matchAiTarget
} from './matcher';
import { AI_STOP_MESSAGES, type AiStopReason } from './policy';
import type {
  AiCommand,
  DocumentEditOperation,
  GeneratedDocBlock,
  GeneratedSheet
} from './protocol';
import {
  normalizeAiSnapshot,
  snapshotChanged,
  snapshotContains,
  type AiPageElement,
  type AiPageScroll,
  type AiPageSnapshot
} from './snapshot';

export type AiActionErrorCode =
  | 'invalid_url'
  | 'not_allowed'
  | 'not_found'
  | 'ambiguous'
  | 'sensitive_blocked'
  | 'high_risk_blocked'
  | 'not_editable'
  | 'option_not_found'
  | 'verification_failed'
  | 'file_generation_failed'
  | 'cancelled_by_user'
  | 'not_file_input'
  | 'upload_failed'
  | 'confirmation_unavailable'
  | 'handed_over'
  | 'confirmation_declined'
  | 'confirmation_timeout'
  | 'unsupported_action'
  | 'form_open_failed'
  | 'form_not_fillable'
  | 'form_cancelled'
  | 'form_expired'
  | 'form_field_not_found'
  | 'form_field_blocked'
  | 'form_fill_failed'
  | 'pdf_font_missing'
  | 'pdf_readonly'
  | 'pdf_no_text_layer'
  | 'document_open_failed'
  | 'document_cancelled'
  | 'document_expired'
  | 'document_no_change'
  | 'document_edit_failed'
  | 'document_preview_unavailable'
  | 'timeout'
  | 'page_error';

export type AiFileFormat = 'docx' | 'xlsx' | 'pdf';

export type AiFileGeneratorInput = {
  format: AiFileFormat;
  fileName: string;
  title?: string;
  content?: string;
  rows?: string[][];
  blocks?: GeneratedDocBlock[];
  sheets?: GeneratedSheet[];
};

export type AiGeneratedFile = {
  name: string;
  format: AiFileFormat;
  folder: string;
  path: string;
};

export type AiFileGenerator = (input: AiFileGeneratorInput) => Promise<AiGeneratedFile>;

export type AiFilePicker = () => Promise<string | null>;

/** 鲁港通 - 表单打开与回填：路径与字段定位只留在本机，不进入指令结果 */
export type AiFormOpener = () => Promise<ParsedForm | null>;

/** 鲁港通 - 右栏已经打开的现成文件直接按路径读取，不再让用户重新选一遍 */
export type AiFormPathOpener = (path: string) => Promise<ParsedForm>;

export type AiFormFiller = (input: {
  form: ParsedForm;
  values: FormFillValue[];
}) => Promise<FilledFormCopy>;

export type AiFormConfirmItem = { label: string; value: string };

export type AiFormConfirmRequest = {
  fileName: string;
  format: ParsedForm['format'];
  items: AiFormConfirmItem[];
  total: number;
};

export type AiFormConfirmDecision = 'allow' | 'cancel' | 'timeout' | 'unavailable';

export type AiFormConfirmer = ((
  request: AiFormConfirmRequest
) => Promise<AiFormConfirmDecision>) & { cancel?: () => void };

export type AiFormFillInfo = {
  filled: number;
  skipped?: string[];
  warnings?: string[];
};

/** 鲁港通 - 文档打开与修改：路径与正文只留在本机，不进入指令结果 */
export type AiDocumentOpener = () => Promise<ParsedDocument | null>;

/** 鲁港通 - 改完后重新解析副本，让模型拿着新 token 接着改，不用再让用户选文件 */
export type AiDocumentReloader = (path: string) => Promise<ParsedDocument>;

/** 鲁港通 - 右栏正在查看的本机文件：Word/Excel 可直接继续修改，PDF 只读但可按路径读取表单域 */
export type AiActiveDocument =
  | { format: 'docx' | 'xlsx'; fileName: string; document: ParsedDocument }
  | { format: 'pdf'; fileName: string; path: string };

export type AiActiveDocumentReader = () => AiActiveDocument | undefined;

/** 鲁港通 - 回传给模型的文档信息：PDF 只给页码与标签提纲，改内容只能走 fill_pdf 叠加副本 */
export type AiPdfOutlineField = {
  page: number;
  label: string;
  section?: string;
};

export type AiDocumentInfo = Omit<DocumentSummary, 'format'> & {
  format: DocumentSummary['format'] | 'pdf';
  pdfPages?: number;
  pdfLabels?: string[];
  pdfFields?: AiPdfOutlineField[];
};

/** 鲁港通 - PDF 叠加填写条目：标签来自提纲，页码可选用于跨页表单 */
export type AiPdfOverlayEntry = {
  page?: number;
  label: string;
  value: string;
  section?: string;
};

/** 鲁港通 - 右栏 PDF 提纲：只读文本层标签，不把 PDF 正文整篇带出 */
export type AiPdfOutlineReader = (
  path: string
) => Promise<{ pages: number; labels: string[]; fields?: AiPdfOutlineField[] }>;

/** 鲁港通 - 右栏预览：用户只在源文件黄底标记里逐条确认后生成副本 */
export type AiDocumentPreviewOutcome =
  | { status: 'done'; copy: EditedDocumentCopy }
  | { status: 'no_change' }
  | { status: 'declined' | 'timeout' | 'unavailable' }
  | {
      status: 'failed';
      message: string;
      code?: 'pdf_no_text_layer' | 'pdf_font_missing' | 'document_edit_failed';
    };

export type AiDocumentPreviewer = ((input: {
  document: ParsedDocument;
  operations: DocumentEditOperation[];
}) => Promise<AiDocumentPreviewOutcome>) & {
  cancel?: () => void;
  /** 鲁港通 - PDF 叠加预览：与 Word/Excel 共用右栏逐条确认，字节只在主进程 */
  previewPdf?: (input: {
    path: string;
    fileName: string;
    entries: AiPdfOverlayEntry[];
  }) => Promise<AiDocumentPreviewOutcome>;
};

export type AiDocumentEditInfo = {
  applied: number;
  skipped?: string[];
  warnings?: string[];
};

export type AiFileInputState = {
  found: boolean;
  isFile?: boolean;
  multiple?: boolean;
  accept?: string;
  count?: number;
  names?: string[];
};

export type AiConfirmationDecision = 'allow' | 'handoff' | 'cancel' | 'timeout' | 'page_closed';

export type AiConfirmCancelReason = 'cancel' | 'page_closed';

export type AiConfirmer = ((request: {
  host: string;
  label: string;
  url?: string;
}) => Promise<AiConfirmationDecision>) & { cancel?: (reason?: AiConfirmCancelReason) => void };

export type AiConfirmationInfo = {
  required: true;
  decision: AiConfirmationDecision | 'unavailable';
  label: string;
};

export type AiFileResult = {
  name: string;
  format?: AiFileFormat | 'other';
  folder?: string;
};

export type AiCommandResult = {
  ok: boolean;
  code?: AiActionErrorCode | AiStopReason;
  message?: string;
  snapshot?: AiPageSnapshot;
  changed?: boolean;
  stopped?: boolean;
  file?: AiFileResult;
  confirmation?: AiConfirmationInfo;
  form?: FormSummary;
  formToken?: string;
  fill?: AiFormFillInfo;
  document?: AiDocumentInfo;
  documentToken?: string;
  edit?: AiDocumentEditInfo;
};

export type AiResolvedElement = {
  found: boolean;
  visible?: boolean;
  rect?: { x: number; y: number; width: number; height: number };
  value?: string;
  checked?: boolean;
};

export type AiPrepareInputResult = {
  ok: boolean;
  value?: string;
  reason?: 'not_found' | 'not_editable';
};

export type AiSelectOptionResult = {
  ok: boolean;
  value?: string;
  text?: string;
  reason?: 'not_found' | 'not_select' | 'option_not_found';
  options?: string[];
};

export type AiScrollResult = {
  before: AiPageScroll;
  after: AiPageScroll;
  changed: boolean;
};

export type AiPageDriver = {
  snapshot(options?: { fullText?: boolean }): Promise<AiPageSnapshot>;
  resolve(
    ref: string,
    options?: { scrollIntoView?: boolean }
  ): Promise<AiResolvedElement | null>;
  prepareInput(ref: string): Promise<AiPrepareInputResult>;
  selectOption(ref: string, option: string): Promise<AiSelectOptionResult>;
  scroll(
    direction: 'up' | 'down' | 'top' | 'bottom',
    amount?: number
  ): Promise<AiScrollResult>;
  clickAt(x: number, y: number): Promise<void>;
  insertText(text: string): Promise<void>;
  navigate(url: string): Promise<void>;
  fileInput(ref: string): Promise<AiFileInputState>;
  setFileInputFiles(ref: string, files: string[]): Promise<boolean>;
  settle(): Promise<void>;
};

type LocateResult =
  | {
      ok: true;
      element: AiPageElement;
      snapshot: AiPageSnapshot;
      resolved: AiResolvedElement;
    }
  | { ok: false; result: AiCommandResult };

type SnapshotResult = { snapshot: AiPageSnapshot } | { result: AiCommandResult };

const targetLabel = (request: { ref?: string; target?: string }): string =>
  request.target?.trim() || request.ref?.trim() || '目标元素';

const baseName = (filePath: string): string => filePath.split(/[\\/]/).pop() || filePath;

const actionLabel = (element: AiPageElement): string => {
  const parts = [element.name, element.text, element.value]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return [...new Set(parts)].join(' ');
};

const notFound = (request: { ref?: string; target?: string }, snapshot?: AiPageSnapshot) => ({
  ok: false as const,
  code: 'not_found' as const,
  message: `页面上没有找到「${targetLabel(request)}」。页面可能已更新或被用户操作改变，我会重新读取页面后再试。`,
  ...(snapshot ? { snapshot } : {})
});

const ambiguous = (
  request: { ref?: string; target?: string },
  snapshot?: AiPageSnapshot
) => ({
  ok: false as const,
  code: 'ambiguous' as const,
  message: `页面上有多个「${targetLabel(request)}」，无法确定要操作哪一个。请改用更具体的名称。`,
  ...(snapshot ? { snapshot } : {})
});

// 鲁港通 - 密码、验证码与银行卡类字段永久禁止自动填写
const FORM_BLOCKED_LABEL = /密码|验证码|动态码|银行卡|卡号|信用卡|cvv|安全码/i;
const MAX_FORM_TOKENS = 3;
const MAX_FORM_CONFIRM_ITEMS = 50;
const MAX_DOCUMENT_TOKENS = 3;
const MAX_PDF_TOKENS = 3;

const parseHttpUrl = (input: string): URL | null => {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
};

export class AiExecutor {
  private readonly driver: AiPageDriver;
  private readonly generateFile?: AiFileGenerator;
  private readonly pickFile?: AiFilePicker;
  private readonly confirm?: AiConfirmer;
  private readonly openForm?: AiFormOpener;
  private readonly openFormAtPath?: AiFormPathOpener;
  private readonly fillForm?: AiFormFiller;
  private readonly confirmForm?: AiFormConfirmer;
  private readonly openDocument?: AiDocumentOpener;
  private readonly readActiveDocument?: AiActiveDocumentReader;
  private readonly readPdfOutline?: AiPdfOutlineReader;
  private readonly reloadDocument?: AiDocumentReloader;
  private readonly previewDocument?: AiDocumentPreviewer;
  private readonly forms = new Map<string, ParsedForm>();
  private readonly documents = new Map<string, ParsedDocument>();
  private readonly pdfs = new Map<
    string,
    { path: string; fileName: string; pages: number; labels: string[] }
  >();

  constructor(options: {
    driver: AiPageDriver;
    generateFile?: AiFileGenerator;
    pickFile?: AiFilePicker;
    confirm?: AiConfirmer;
    openForm?: AiFormOpener;
    openFormAtPath?: AiFormPathOpener;
    fillForm?: AiFormFiller;
    confirmForm?: AiFormConfirmer;
    openDocument?: AiDocumentOpener;
    readActiveDocument?: AiActiveDocumentReader;
    readPdfOutline?: AiPdfOutlineReader;
    reloadDocument?: AiDocumentReloader;
    previewDocument?: AiDocumentPreviewer;
  }) {
    this.driver = options.driver;
    this.generateFile = options.generateFile;
    this.pickFile = options.pickFile;
    this.confirm = options.confirm;
    this.openForm = options.openForm;
    this.openFormAtPath = options.openFormAtPath;
    this.fillForm = options.fillForm;
    this.confirmForm = options.confirmForm;
    this.openDocument = options.openDocument;
    this.readActiveDocument = options.readActiveDocument;
    this.readPdfOutline = options.readPdfOutline;
    this.reloadDocument = options.reloadDocument;
    this.previewDocument = options.previewDocument;
  }

  cancelConfirmation = (reason?: AiConfirmCancelReason): void => {
    this.confirm?.cancel?.(reason);
  };

  cancelFormConfirmation = (): void => {
    this.confirmForm?.cancel?.();
  };

  cancelDocumentConfirmation = (): void => {
    this.previewDocument?.cancel?.();
  };

  async execute(command: AiCommand): Promise<AiCommandResult> {
    if (command.action === 'stop') return { ok: true, stopped: true };
    try {
      return await this.run(command);
    } catch (error) {
      // 鲁港通 - 页面驱动的超时/未打开页面等具体原因要透出，避免统一成一句泛化文案
      if (error instanceof AiDriverError) {
        return {
          ok: false,
          code: error.timeout ? 'timeout' : 'page_error',
          message: error.message
        };
      }
      return {
        ok: false,
        code: 'page_error',
        message: '无法读取当前页面，请确认页面已经打开并且加载完成。'
      };
    }
  }

  private async run(command: Exclude<AiCommand, { action: 'stop' }>): Promise<AiCommandResult> {
    if (command.action === 'navigate') return this.navigate(command.url);
    if (command.action === 'generate_file') return this.generateFileLocally(command);
    if (command.action === 'open_form') return this.openFormLocally();
    if (command.action === 'fill_form') return this.fillFormLocally(command);
    if (command.action === 'open_document') return this.openDocumentLocally();
    if (command.action === 'edit_document') return this.editDocumentLocally(command);
    if (command.action === 'fill_pdf') return this.fillPdfLocally(command);

    if (command.action === 'read') {
      // 鲁港通 - 右栏打开的是本机文件时直接读文件，不去读网页
      const local = await this.readActiveDocumentLocally();
      if (local) return local;
      const read = await this.readSnapshot({ fullText: command.fullText === true });
      if ('result' in read) return read.result;
      return { ok: true, snapshot: read.snapshot };
    }

    const initial = await this.readSnapshot();
    if ('result' in initial) return initial.result;

    if (command.action === 'scroll') return this.scroll(command, initial.snapshot);
    if (command.action === 'upload') return this.upload(command, initial.snapshot);

    const located = await this.locate(command, initial.snapshot);
    if (!located.ok) return located.result;
    const { element, resolved } = located;

    if (isSensitiveElement(element)) {
      return {
        ok: false,
        code: 'sensitive_blocked',
        message: AI_STOP_MESSAGES.sensitive_blocked,
        snapshot: located.snapshot
      };
    }
    if (command.action === 'click') {
      const label = actionLabel(element);
      if (isPaymentActionLabel(label)) {
        return {
          ok: false,
          code: 'high_risk_blocked',
          message: AI_STOP_MESSAGES.high_risk_blocked,
          snapshot: located.snapshot
        };
      }
      if (isConfirmableActionLabel(label)) {
        return this.confirmedClick(command, element, resolved, located.snapshot, label.trim());
      }
      return this.click(command, element, resolved, located.snapshot);
    }
    if (command.action === 'type') {
      return this.typeInto(command.text, command.expect, element, located.snapshot);
    }
    return this.select(command.option, element, located.snapshot);
  }

  private async generateFileLocally(
    command: Extract<AiCommand, { action: 'generate_file' }>
  ): Promise<AiCommandResult> {
    if (!this.generateFile) {
      return {
        ok: false,
        code: 'file_generation_failed',
        message: '当前客户端版本不支持本地生成文件，请升级到最新版本后重试。'
      };
    }
    const input: AiFileGeneratorInput = {
      format: command.format,
      fileName: command.fileName
    };
    if (command.title) input.title = command.title;
    if (command.content) input.content = command.content;
    if (command.rows?.length) input.rows = command.rows;
    if (command.blocks?.length) input.blocks = command.blocks;
    if (command.sheets?.length) input.sheets = command.sheets;

    try {
      const generated = await this.generateFile(input);
      return {
        ok: true,
        file: {
          name: generated.name,
          format: generated.format,
          folder: generated.folder
        }
      };
    } catch {
      return {
        ok: false,
        code: 'file_generation_failed',
        message: '文件没有生成成功，请重新生成一次；如果仍然失败，请手动准备文件后再上传。'
      };
    }
  }

  private async openFormLocally(): Promise<AiCommandResult> {
    // 鲁港通 - 右栏已经打开文件时直接按该文件读取，不再弹没有上下文的选择窗口
    const active = this.readActiveDocument?.();
    const activePath =
      active?.format === 'pdf' ? active.path : active?.document.path;
    if (activePath && this.openFormAtPath) {
      try {
        return this.registerForm(await this.openFormAtPath(activePath));
      } catch (error) {
        // 鲁港通 - 右栏这份文件本身不是可填写表单时要直接说清楚，不能换个窗口再问一次
        if (error instanceof FormParseError && error.code === 'form_not_fillable') {
          return {
            ok: false,
            code: 'form_not_fillable',
            message: `右栏的「${active?.fileName ?? '这份文件'}」${error.message}`
          };
        }
      }
    }

    if (!this.openForm) {
      return {
        ok: false,
        code: 'unsupported_action',
        message: '当前客户端版本不支持读取本机表单，请升级到最新版本后重试。'
      };
    }

    let form: ParsedForm | null;
    try {
      form = await this.openForm();
    } catch (error) {
      return {
        ok: false,
        code:
          error instanceof FormParseError && error.code === 'form_not_fillable'
            ? 'form_not_fillable'
            : 'form_open_failed',
        message:
          error instanceof FormParseError
            ? error.message
            : '这个表单文件没有读取成功，请确认文件能正常打开后再选一次。'
      };
    }
    if (!form) {
      return {
        ok: false,
        code: 'form_cancelled',
        message: '你取消了选择表单，已停止填写。需要继续时请告诉我。'
      };
    }

    return this.registerForm(form);
  }

  private registerForm(form: ParsedForm): AiCommandResult {
    const token = randomUUID();
    this.forms.set(token, form);
    // 鲁港通 - 只保留最近打开的几份表单，避免长期持有本机文件结构
    while (this.forms.size > MAX_FORM_TOKENS) {
      const oldest = this.forms.keys().next().value;
      if (!oldest) break;
      this.forms.delete(oldest);
    }

    return { ok: true, form: toFormSummary(form), formToken: token };
  }

  private async fillFormLocally(
    command: Extract<AiCommand, { action: 'fill_form' }>
  ): Promise<AiCommandResult> {
    const form = this.forms.get(command.token);
    if (!form) {
      return {
        ok: false,
        code: 'form_expired',
        message: '这份表单已经失效或还没有打开，请先让我重新读取表单，再按新的字段清单填写。'
      };
    }

    const byId = new Map(form.fields.map((field) => [field.id, field]));
    const values: FormFillValue[] = [];
    const skipped: string[] = [];
    let blocked = 0;
    let unknown = 0;

    for (const item of command.fields) {
      const field = byId.get(item.field);
      if (!field) {
        unknown += 1;
        skipped.push(`没有找到字段「${item.field}」，已跳过`);
        continue;
      }
      if (FORM_BLOCKED_LABEL.test(field.label)) {
        blocked += 1;
        skipped.push(`「${field.label}」属于密码、验证码或银行卡类信息，不会自动填写`);
        continue;
      }
      values.push({ id: field.id, value: item.value });
    }

    if (values.length === 0) {
      if (blocked > 0) {
        return {
          ok: false,
          code: 'form_field_blocked',
          message: AI_STOP_MESSAGES.sensitive_blocked
        };
      }
      return {
        ok: false,
        code: 'form_field_not_found',
        message:
          unknown > 0
            ? '你给的字段在这份表单里都没有找到，请让我重新读取表单后再填写。'
            : '这次没有可以填写的字段，请重新给出要填写的内容。'
      };
    }

    if (!this.confirmForm) {
      return {
        ok: false,
        code: 'confirmation_unavailable',
        message: '当前客户端无法弹出填写确认框，还没有写入任何内容。请升级到最新版本后再试。'
      };
    }

    // 鲁港通 - 写盘前先展示字段与内容，确认框只传摘要不传本机路径
    const items = values
      .filter((value) => value.value.trim().length > 0)
      .slice(0, MAX_FORM_CONFIRM_ITEMS)
      .map((value) => ({ label: byId.get(value.id)?.label ?? value.id, value: value.value }));

    let decision: AiFormConfirmDecision;
    try {
      decision = await this.confirmForm({
        fileName: form.name,
        format: form.format,
        items,
        total: values.length
      });
    } catch {
      decision = 'unavailable';
    }

    if (decision === 'cancel') {
      return {
        ok: false,
        code: 'confirmation_declined',
        message: '你取消了这次表单填写，没有生成任何文件。需要继续时请告诉我。'
      };
    }
    if (decision === 'timeout') {
      return {
        ok: false,
        code: 'confirmation_timeout',
        message: '等待填写确认超时，已取消这次填写，没有生成任何文件。需要继续时请告诉我。'
      };
    }
    if (decision === 'unavailable') {
      return {
        ok: false,
        code: 'confirmation_unavailable',
        message: '当前客户端无法弹出填写确认框，还没有写入任何内容。请升级到最新版本后再试。'
      };
    }

    if (!this.fillForm) {
      return {
        ok: false,
        code: 'form_fill_failed',
        message: '当前客户端版本不支持生成已填写的副本，请升级到最新版本后重试。'
      };
    }

    try {
      const copy = await this.fillForm({ form, values });
      this.forms.delete(command.token);
      const allSkipped = [...skipped, ...copy.skipped];
      return {
        ok: true,
        file: { name: copy.name, format: copy.format, folder: copy.folder },
        fill: {
          filled: copy.filled,
          ...(allSkipped.length > 0 ? { skipped: allSkipped } : {}),
          ...(copy.warnings.length > 0 ? { warnings: copy.warnings } : {})
        }
      };
    } catch (error) {
      if (error instanceof FormFillError && error.code === 'pdf_font_missing') {
        return { ok: false, code: 'pdf_font_missing', message: error.message };
      }
      return {
        ok: false,
        code: 'form_fill_failed',
        message:
          error instanceof FormFillError
            ? error.message
            : '填写副本没有生成成功，请重试一次；如果仍然失败，请手动填写原表单。'
      };
    }
  }

  // 鲁港通 - 只保留最近打开的几份文档，避免长期持有本机文件结构
  private storeDocument(document: ParsedDocument): string {
    const token = randomUUID();
    this.documents.set(token, document);
    while (this.documents.size > MAX_DOCUMENT_TOKENS) {
      const oldest = this.documents.keys().next().value;
      if (!oldest) break;
      this.documents.delete(oldest);
    }
    return token;
  }

  // 鲁港通 - PDF 令牌只记路径与标签提纲，正文与字节都不进令牌表
  private storePdf(pdf: {
    path: string;
    fileName: string;
    pages: number;
    labels: string[];
  }): string {
    const token = randomUUID();
    this.pdfs.set(token, pdf);
    while (this.pdfs.size > MAX_PDF_TOKENS) {
      const oldest = this.pdfs.keys().next().value;
      if (!oldest) break;
      this.pdfs.delete(oldest);
    }
    return token;
  }

  // 鲁港通 - 副本写好后重新读取它，让模型拿着新 token 接着改，用户不用再选一次文件
  private async continueAfterEdit(
    copy: EditedDocumentCopy
  ): Promise<Pick<AiCommandResult, 'document' | 'documentToken'>> {
    if (!this.reloadDocument) return {};
    try {
      const parsed = await this.reloadDocument(copy.path);
      return {
        document: toDocumentSummary(parsed),
        documentToken: this.storeDocument(parsed)
      };
    } catch {
      return {};
    }
  }

  private async openDocumentLocally(): Promise<AiCommandResult> {
    // 鲁港通 - 右栏已打开文件时直接读它（PDF 也一样），不再弹没有上下文的选择窗口
    const active = await this.readActiveDocumentLocally();
    if (active) return active;

    if (!this.openDocument) {
      return {
        ok: false,
        code: 'unsupported_action',
        message: '当前客户端版本不支持读取本机文档，请升级到最新版本后重试。'
      };
    }

    let document: ParsedDocument | null;
    try {
      document = await this.openDocument();
    } catch (error) {
      return {
        ok: false,
        code: 'document_open_failed',
        message:
          error instanceof DocumentParseError
            ? error.message
            : '这个文档没有读取成功，请确认文件能正常打开后再选一次。'
      };
    }
    if (!document) {
      return {
        ok: false,
        code: 'document_cancelled',
        message: '你取消了选择文档，已停止修改。需要继续时请告诉我。'
      };
    }

    const token = randomUUID();
    this.documents.set(token, document);
    // 鲁港通 - 只保留最近打开的几份文档，避免长期持有本机文件结构
    while (this.documents.size > MAX_DOCUMENT_TOKENS) {
      const oldest = this.documents.keys().next().value;
      if (!oldest) break;
      this.documents.delete(oldest);
    }

    return { ok: true, document: toDocumentSummary(document), documentToken: token };
  }

  private async readActiveDocumentLocally(): Promise<AiCommandResult | undefined> {
    if (!this.readActiveDocument) return undefined;
    let active: AiActiveDocument | undefined;
    try {
      active = this.readActiveDocument();
    } catch {
      return undefined;
    }
    if (!active) return undefined;

    // 鲁港通 - 右栏是 PDF 时不再回落 Word/Excel 选择框：读出标签提纲并发放叠加填写令牌
    if (active.format === 'pdf') {
      return this.readActivePdfLocally(active);
    }

    const token = randomUUID();
    this.documents.set(token, active.document);
    while (this.documents.size > MAX_DOCUMENT_TOKENS) {
      const oldest = this.documents.keys().next().value;
      if (!oldest) break;
      this.documents.delete(oldest);
    }
    return { ok: true, document: toDocumentSummary(active.document), documentToken: token };
  }

  // 鲁港通 - PDF 只读标签提纲；读不到也直接返回文件名，绝不弹文件选择框
  private async readActivePdfLocally(
    active: Extract<AiActiveDocument, { format: 'pdf' }>
  ): Promise<AiCommandResult> {
    if (!this.readPdfOutline) {
      return { ok: true, document: { format: 'pdf', name: active.fileName } };
    }
    try {
      const outline = await this.readPdfOutline(active.path);
      const token = this.storePdf({
        path: active.path,
        fileName: active.fileName,
        pages: outline.pages,
        labels: outline.labels
      });
      return {
        ok: true,
        document: {
          format: 'pdf',
          name: active.fileName,
          pdfPages: outline.pages,
          pdfLabels: outline.labels,
          ...(outline.fields ? { pdfFields: outline.fields } : {})
        },
        documentToken: token
      };
    } catch {
      return { ok: true, document: { format: 'pdf', name: active.fileName } };
    }
  }

  private async editDocumentLocally(
    command: Extract<AiCommand, { action: 'edit_document' }>
  ): Promise<AiCommandResult> {
    // 鲁港通 - PDF 不能像 Word/Excel 那样改写结构，只能叠加内容：把模型引到 fill_pdf
    if (this.pdfs.has(command.token)) {
      return {
        ok: false,
        code: 'pdf_readonly',
        message:
          'PDF 不能像 Word/Excel 那样直接改结构，也没有写入任何内容。请在原样副本上叠加内容：改用 fill_pdf，按 PDF 提纲里的标签逐条给出内容。'
      };
    }
    const document = this.documents.get(command.token);
    if (!document) {
      return {
        ok: false,
        code: 'document_expired',
        message: '这份文档已经失效或还没有打开，请先让我重新读取文档，再按修改清单操作。'
      };
    }

    // 鲁港通 - 修改只能在右栏源文件预览里确认，不存在第二套确认或写盘路径
    if (!this.previewDocument) {
      return {
        ok: false,
        code: 'document_preview_unavailable',
        message:
          '当前客户端版本还没有接入右栏文件预览，无法确认这次修改，也没有写入任何内容。请升级到最新版桌面客户端后重试。'
      };
    }

    let outcome: AiDocumentPreviewOutcome;
    try {
      outcome = await this.previewDocument({
        document,
        operations: command.operations
      });
    } catch {
      outcome = { status: 'unavailable' };
    }

    if (outcome.status === 'done') {
      this.documents.delete(command.token);
      const copy = outcome.copy;
      return {
        ok: true,
        file: { name: copy.name, format: copy.format, folder: copy.folder },
        edit: {
          applied: copy.applied,
          ...(copy.skipped.length > 0 ? { skipped: copy.skipped } : {}),
          ...(copy.warnings.length > 0 ? { warnings: copy.warnings } : {})
        },
        ...(await this.continueAfterEdit(copy))
      };
    }
    if (outcome.status === 'no_change') {
      return {
        ok: false,
        code: 'confirmation_declined',
        message: '你把这轮修改都跳过了，没有生成副本，原文件也没有变化。需要调整时请告诉我。'
      };
    }
    if (outcome.status === 'declined') {
      return {
        ok: false,
        code: 'confirmation_declined',
        message: '你取消了这次修改，没有生成任何副本。需要继续时请告诉我。'
      };
    }
    if (outcome.status === 'timeout') {
      return {
        ok: false,
        code: 'confirmation_timeout',
        message: '等待修改确认超时，已取消这次修改，没有生成任何副本。需要继续时请告诉我。'
      };
    }
    if (outcome.status === 'failed') {
      return {
        ok: false,
        code: 'document_edit_failed',
        message: outcome.message
      };
    }
    return {
      ok: false,
      code: 'document_preview_unavailable',
      message:
        '右栏没有接上这份文件的修改预览，已停止，没有生成副本，原文件也没有变化。请确认右栏打开的是这份文件后再试。'
    };
  }

  // 鲁港通 - PDF 叠加填写：走同一套右栏黄底逐条确认，只写副本、原文件不动
  private async fillPdfLocally(
    command: Extract<AiCommand, { action: 'fill_pdf' }>
  ): Promise<AiCommandResult> {
    const pdf = this.pdfs.get(command.token);
    if (!pdf) {
      return {
        ok: false,
        code: 'document_expired',
        message: '这份 PDF 已经失效或还没有打开，请先让我重新读取右栏里的 PDF，再按标签填写内容。'
      };
    }
    const previewPdf = this.previewDocument?.previewPdf;
    if (!previewPdf) {
      return {
        ok: false,
        code: 'document_preview_unavailable',
        message:
          '当前客户端版本还没有接入 PDF 叠加预览，无法确认这次填写，也没有写入任何内容。请升级到最新版桌面客户端后重试。'
      };
    }

    let outcome: AiDocumentPreviewOutcome;
    try {
      outcome = await previewPdf.call(this.previewDocument, {
        path: pdf.path,
        fileName: pdf.fileName,
        entries: command.entries
      });
    } catch {
      outcome = { status: 'unavailable' };
    }

    if (outcome.status === 'done') {
      this.pdfs.delete(command.token);
      const copy = outcome.copy;
      return {
        ok: true,
        file: { name: copy.name, format: copy.format, folder: copy.folder },
        edit: {
          applied: copy.applied,
          ...(copy.skipped.length > 0 ? { skipped: copy.skipped } : {}),
          ...(copy.warnings.length > 0 ? { warnings: copy.warnings } : {})
        }
      };
    }
    if (outcome.status === 'no_change') {
      return {
        ok: false,
        code: 'confirmation_declined',
        message: '你把这轮填写都跳过了，没有生成副本，原文件也没有变化。需要调整时请告诉我。'
      };
    }
    if (outcome.status === 'declined') {
      return {
        ok: false,
        code: 'confirmation_declined',
        message: '你取消了这次填写，没有生成任何副本。需要继续时请告诉我。'
      };
    }
    if (outcome.status === 'timeout') {
      return {
        ok: false,
        code: 'confirmation_timeout',
        message: '等待填写确认超时，已取消这次填写，没有生成任何副本。需要继续时请告诉我。'
      };
    }
    if (outcome.status === 'failed') {
      const code: AiActionErrorCode =
        outcome.code === 'pdf_no_text_layer'
          ? 'pdf_no_text_layer'
          : outcome.code === 'pdf_font_missing'
            ? 'pdf_font_missing'
            : 'document_edit_failed';
      return { ok: false, code, message: outcome.message };
    }
    return {
      ok: false,
      code: 'document_preview_unavailable',
      message:
        '右栏没有接上这份 PDF 的叠加预览，已停止，没有生成副本，原文件也没有变化。请确认右栏打开的是这份 PDF 后再试。'
    };
  }

  private async upload(
    command: Extract<AiCommand, { action: 'upload' }>,
    initial: AiPageSnapshot
  ): Promise<AiCommandResult> {
    const located = await this.locateFileInput(command, initial);
    if (!located.ok) return located.result;
    const { element, snapshot } = located;

    const state = await this.driver.fileInput(element.ref);
    if (!state.found) return notFound(command, snapshot);
    if (!state.isFile) {
      return {
        ok: false,
        code: 'not_file_input',
        message: `「${element.name || element.ref}」不是文件上传入口。请重新读取页面后选择正确的上传按钮。`,
        snapshot
      };
    }
    if (!this.pickFile) {
      return {
        ok: false,
        code: 'upload_failed',
        message: '当前客户端版本不支持选择本机文件，请升级到最新版本后重试，或手动选择文件上传。',
        snapshot
      };
    }

    const picked = await this.pickFile();
    if (!picked) {
      return {
        ok: false,
        code: 'cancelled_by_user',
        message: AI_STOP_MESSAGES.cancelled_by_user,
        snapshot
      };
    }

    const attached = await this.driver.setFileInputFiles(element.ref, [picked]);
    await this.driver.settle();
    const afterState = await this.driver.fileInput(element.ref);
    if (
      !attached ||
      !afterState.found ||
      !afterState.isFile ||
      (afterState.count ?? 0) < 1
    ) {
      return {
        ok: false,
        code: 'upload_failed',
        message: '文件没有成功附加到页面上。请手动选择文件上传，完成后告诉我继续。',
        snapshot
      };
    }

    const after = await this.readSnapshot();
    if ('result' in after) return after.result;
    return {
      ok: true,
      changed: snapshotChanged(snapshot, after.snapshot),
      snapshot: after.snapshot,
      file: { name: baseName(picked) }
    };
  }

  private async locateFileInput(
    request: { ref?: string; target?: string },
    initial: AiPageSnapshot
  ): Promise<
    | { ok: true; element: AiPageElement; snapshot: AiPageSnapshot }
    | { ok: false; result: AiCommandResult }
  > {
    let snapshot = initial;
    let match = matchAiTarget(snapshot.elements, request);
    if (match.kind === 'not_found') {
      const refreshed = await this.refreshSnapshot();
      if ('result' in refreshed) return { ok: false, result: refreshed.result };
      snapshot = refreshed.snapshot;
      match = matchAiTarget(snapshot.elements, request);
    }
    if (match.kind === 'not_found') return { ok: false, result: notFound(request, snapshot) };
    if (match.kind === 'ambiguous') {
      return { ok: false, result: ambiguous(request, snapshot) };
    }
    // 鲁港通 - 文件入口常被页面隐藏，不能再按可见矩形定位
    return { ok: true, element: match.element, snapshot };
  }

  private async confirmedClick(
    command: Extract<AiCommand, { action: 'click' }>,
    element: AiPageElement,
    resolved: AiResolvedElement,
    before: AiPageSnapshot,
    label: string
  ): Promise<AiCommandResult> {
    const host = parseHttpUrl(before.url)?.hostname ?? '';
    if (!this.confirm) {
      return {
        ok: false,
        code: 'confirmation_unavailable',
        message: AI_STOP_MESSAGES.confirmation_unavailable,
        snapshot: before,
        confirmation: { required: true, decision: 'unavailable', label }
      };
    }

    let decision: AiConfirmationDecision;
    try {
      decision = await this.confirm({ host, label, url: before.url });
    } catch {
      return {
        ok: false,
        code: 'confirmation_unavailable',
        message: AI_STOP_MESSAGES.confirmation_unavailable,
        snapshot: before,
        confirmation: { required: true, decision: 'unavailable', label }
      };
    }

    const confirmation: AiConfirmationInfo = { required: true, decision, label };
    if (decision === 'handoff') {
      return {
        ok: false,
        code: 'handed_over',
        message: AI_STOP_MESSAGES.handed_over,
        snapshot: before,
        confirmation
      };
    }
    if (decision === 'cancel') {
      return {
        ok: false,
        code: 'confirmation_declined',
        message: AI_STOP_MESSAGES.confirmation_declined,
        snapshot: before,
        confirmation
      };
    }
    if (decision === 'timeout') {
      return {
        ok: false,
        code: 'confirmation_timeout',
        message: AI_STOP_MESSAGES.confirmation_timeout,
        snapshot: before,
        confirmation
      };
    }
    // 鲁港通 - 页面被关闭时自动撤销本次提交，不再点击，也不等同于用户主动取消
    if (decision === 'page_closed') {
      return {
        ok: false,
        code: 'page_error',
        message: '页面被关闭，本次提交已自动取消，没有提交任何内容。页面恢复后我会重新读取页面再继续。',
        snapshot: before,
        confirmation
      };
    }
    // 鲁港通 - 用户确认只对当前这一步有效，点击后不再询问后续按钮
    try {
      const result = await this.click(command, element, resolved, before);
      return { ...result, confirmation };
    } catch {
      // 点击可能已经发出，必须保留确认记录，交由控制器停止并提示用户核对
      return {
        ok: false,
        code: 'page_error',
        message: AI_STOP_MESSAGES.submission_unconfirmed,
        confirmation
      };
    }
  }

  private async navigate(rawUrl: string): Promise<AiCommandResult> {
    const parsed = parseHttpUrl(rawUrl);
    if (!parsed) {
      return {
        ok: false,
        code: 'invalid_url',
        message: '网址格式无效，只支持 http 或 https 的网站地址。'
      };
    }
    if (isAiPrivateHost(parsed.hostname)) {
      return {
        ok: false,
        code: 'not_allowed',
        message: AI_STOP_MESSAGES.domain_not_allowed
      };
    }

    await this.driver.navigate(parsed.toString());
    await this.driver.settle();
    const after = await this.readSnapshot();
    if ('result' in after) return after.result;
    return { ok: true, changed: true, snapshot: after.snapshot };
  }

  private async click(
    command: Extract<AiCommand, { action: 'click' }>,
    _element: AiPageElement,
    resolved: AiResolvedElement,
    before: AiPageSnapshot
  ): Promise<AiCommandResult> {
    const rect = resolved.rect;
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return notFound(command, before);
    }
    await this.driver.clickAt(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await this.driver.settle();

    const after = await this.readSnapshot();
    if ('result' in after) return after.result;
    const changed = snapshotChanged(before, after.snapshot);
    if (command.expect && !snapshotContains(after.snapshot, command.expect)) {
      return {
        ok: false,
        code: 'verification_failed',
        message: `操作已执行，但没有在页面上看到预期结果「${command.expect}」。我会重新读取页面后再判断。`,
        changed,
        snapshot: after.snapshot
      };
    }
    return { ok: true, changed, snapshot: after.snapshot };
  }

  private async typeInto(
    text: string,
    expect: string | undefined,
    element: AiPageElement,
    before: AiPageSnapshot
  ): Promise<AiCommandResult> {
    const prepared = await this.driver.prepareInput(element.ref);
    if (!prepared.ok) {
      if (prepared.reason === 'not_editable') {
        return {
          ok: false,
          code: 'not_editable',
          message: `「${element.name || element.ref}」不是可输入的文字框，请改用点击或选择操作。`,
          snapshot: before
        };
      }
      return notFound({ ref: element.ref, target: element.name }, before);
    }

    await this.driver.insertText(text);
    await this.driver.settle();
    const verified = await this.driver.resolve(element.ref);
    const after = await this.readSnapshot();
    if ('result' in after) return after.result;

    if (
      verified?.found &&
      typeof verified.value === 'string' &&
      verified.value.trim() !== text.trim()
    ) {
      return {
        ok: false,
        code: 'verification_failed',
        message: '输入没有生效，页面上仍然是原来的内容。我会重新定位输入框后再试。',
        snapshot: after.snapshot
      };
    }
    if (expect && !snapshotContains(after.snapshot, expect)) {
      return {
        ok: false,
        code: 'verification_failed',
        message: `输入后没有在页面上看到预期结果「${expect}」。我会重新读取页面后再判断。`,
        snapshot: after.snapshot
      };
    }
    return {
      ok: true,
      changed: snapshotChanged(before, after.snapshot),
      snapshot: after.snapshot
    };
  }

  private async select(
    option: string,
    element: AiPageElement,
    before: AiPageSnapshot
  ): Promise<AiCommandResult> {
    const selected = await this.driver.selectOption(element.ref, option);
    if (!selected.ok) {
      if (selected.reason === 'option_not_found') {
        const options = (selected.options ?? []).slice(0, 8).join('、');
        return {
          ok: false,
          code: 'option_not_found',
          message: `「${element.name || element.ref}」中没有选项「${option}」。可选值：${options || '页面未提供'}`,
          snapshot: before
        };
      }
      return {
        ok: false,
        code: 'not_editable',
        message: `「${element.name || element.ref}」不是下拉选择框，请改用其他操作。`,
        snapshot: before
      };
    }

    await this.driver.settle();
    const after = await this.readSnapshot();
    if ('result' in after) return after.result;
    return {
      ok: true,
      changed: snapshotChanged(before, after.snapshot),
      snapshot: after.snapshot
    };
  }

  private async scroll(
    command: Extract<AiCommand, { action: 'scroll' }>,
    before: AiPageSnapshot
  ): Promise<AiCommandResult> {
    const result = await this.driver.scroll(command.direction, command.amount);
    await this.driver.settle();
    const after = await this.readSnapshot();
    if ('result' in after) return after.result;
    return {
      ok: true,
      changed: result.changed || snapshotChanged(before, after.snapshot),
      snapshot: after.snapshot
    };
  }

  private async locate(
    request: { ref?: string; target?: string },
    initial: AiPageSnapshot
  ): Promise<LocateResult> {
    let snapshot = initial;
    let match = matchAiTarget(snapshot.elements, request);

    if (match.kind === 'not_found') {
      const refreshed = await this.refreshSnapshot();
      if ('result' in refreshed) return { ok: false, result: refreshed.result };
      snapshot = refreshed.snapshot;
      match = matchAiTarget(snapshot.elements, request);
    }

    if (match.kind === 'not_found') return { ok: false, result: notFound(request, snapshot) };
    if (match.kind === 'ambiguous') {
      return { ok: false, result: ambiguous(request, snapshot) };
    }

    const first = await this.driver.resolve(match.element.ref, { scrollIntoView: true });
    if (first?.found && first.visible !== false) {
      return { ok: true, element: match.element, snapshot, resolved: first };
    }

    // 鲁港通 - 快照引用在页面重绘后可能指向别的元素，只按语义描述重定位，不做引用猜测
    if (!request.target) return { ok: false, result: notFound(request, snapshot) };
    const refreshed = await this.refreshSnapshot();
    if ('result' in refreshed) return { ok: false, result: refreshed.result };
    snapshot = refreshed.snapshot;
    const rematch = matchAiTarget(snapshot.elements, { target: request.target });
    if (rematch.kind === 'ambiguous') {
      return { ok: false, result: ambiguous(request, snapshot) };
    }
    if (rematch.kind === 'matched') {
      const again = await this.driver.resolve(rematch.element.ref, { scrollIntoView: true });
      if (again?.found && again.visible !== false) {
        return { ok: true, element: rematch.element, snapshot, resolved: again };
      }
    }
    return { ok: false, result: notFound(request, snapshot) };
  }

  private async refreshSnapshot(): Promise<SnapshotResult> {
    return this.readSnapshot();
  }

  private async readSnapshot(options?: { fullText?: boolean }): Promise<SnapshotResult> {
    const snapshot = normalizeAiSnapshot(await this.driver.snapshot(options), options);
    if (!isAiSnapshotUrlAllowed(snapshot.url)) {
      return {
        result: {
          ok: false,
          code: 'not_allowed',
          message: AI_STOP_MESSAGES.domain_not_allowed,
          snapshot
        }
      };
    }
    return { snapshot };
  }
}
