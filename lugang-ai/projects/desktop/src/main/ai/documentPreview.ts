// 鲁港通 - 文档预览会话：右栏逐条确认、全部应用、超时与副本生成都只在本机完成
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import type { DocumentEditOperation } from './protocol';
import type { EditedDocumentCopy } from './document/editTypes';
import type { ParsedDocument } from './document/types';
import { DocumentParseError } from './document/types';
import {
  buildPreviewChanges,
  computePreviewBlocks,
  extractDocxPreview,
  type DocxPreviewModel,
  type PreviewChange
} from './document/docxPreview';
import {
  buildXlsxPreviewChanges,
  computeXlsxPreviewSheets,
  extractXlsxPreview,
  MAX_XLSX_PREVIEW_COLUMNS,
  MAX_XLSX_PREVIEW_ROWS,
  MAX_XLSX_PREVIEW_SHEETS,
  type XlsxPreviewModel,
  type XlsxSheetView
} from './document/xlsxPreview';
import type {
  DesktopDocumentBlock,
  DesktopDocumentBytes,
  DesktopDocumentFormat,
  DesktopDocumentPreviewState,
  DesktopDocumentSnapshot,
  DesktopDocumentSummary
} from '../../shared/ipc';

const DEFAULT_REVIEW_TIMEOUT_MS = 5 * 60 * 1000;
// 鲁港通 - 右栏网页端要先轮询到标签、再认领审阅，给足 15 秒，不再回退任何文字确认窗
export const DEFAULT_CLAIM_TIMEOUT_MS = 15000;
const DEFAULT_MAX_SESSIONS = 3;
// 鲁港通 - PDF 预览整份读入内存，超过上限的只走系统默认程序打开
const DEFAULT_MAX_READ_BYTES = 40 * 1024 * 1024;

export type PreviewEditor = (input: {
  document: ParsedDocument;
  operations: DocumentEditOperation[];
}) => Promise<EditedDocumentCopy>;

export type LocalPreviewInput =
  | { format: 'docx' | 'xlsx'; document: ParsedDocument }
  | { format: 'pdf'; name: string; path: string };

/** 鲁港通 - 右栏当前显示的本机文件：Word/Excel 可继续修改，PDF 只读但保留路径供读取 */
export type ActiveViewDocument =
  | { format: 'docx' | 'xlsx'; fileName: string; document: ParsedDocument }
  | { format: 'pdf'; fileName: string; path: string };

export type DocumentPreviewOutcome =
  | { status: 'done'; copy: EditedDocumentCopy }
  | { status: 'no_change' }
  | { status: 'declined' }
  | { status: 'timeout' }
  | { status: 'unavailable' }
  | { status: 'failed'; message: string };

type Session = {
  token: string;
  mode: 'review' | 'view';
  format: DesktopDocumentFormat;
  fileName: string;
  state: DesktopDocumentPreviewState;
  changes: PreviewChange[];
  blocks: DesktopDocumentBlock[];
  operations: DocumentEditOperation[];
  document?: ParsedDocument;
  sourcePath?: string;
  sheets?: XlsxSheetView[];
  warnings: string[];
  copy?: { name: string; folder: string };
  copyPath?: string;
  message?: string;
  model?: DocxPreviewModel;
  xlsx?: XlsxPreviewModel;
  resolve?: (outcome: DocumentPreviewOutcome) => void;
  claimTimer?: ReturnType<typeof setTimeout>;
  reviewTimer?: ReturnType<typeof setTimeout>;
};

export type DocumentPreviewManagerOptions = {
  editDocument: PreviewEditor;
  openLocal?: () => Promise<LocalPreviewInput | null>;
  openCopy?: (path: string) => void | Promise<void>;
  emit?: (list: DesktopDocumentSummary[]) => void;
  timeoutMs?: number;
  claimTimeoutMs?: number;
  maxSessions?: number;
  maxReadBytes?: number;
};

const isOpenReview = (session: Session): boolean =>
  session.state === 'pending' || session.state === 'reviewing';

const xlsxPreviewWarnings = (model: XlsxPreviewModel): string[] => {
  const warnings: string[] = [];
  if (model.workbook.worksheets.length > MAX_XLSX_PREVIEW_SHEETS) {
    warnings.push(`工作表较多，预览只显示前 ${MAX_XLSX_PREVIEW_SHEETS} 个；副本仍会完整写入。`);
  }
  if (model.sheets.some((sheet) => sheet.truncatedRows || sheet.truncatedColumns)) {
    warnings.push(
      `部分工作表较大，预览只显示前 ${MAX_XLSX_PREVIEW_ROWS} 行、${MAX_XLSX_PREVIEW_COLUMNS} 列；副本仍会完整写入。`
    );
  }
  return warnings;
};

export class DocumentPreviewManager {
  private readonly sessions = new Map<string, Session>();
  private readonly editDocument: PreviewEditor;
  private readonly pickLocal?: () => Promise<LocalPreviewInput | null>;
  private readonly openCopyPath?: (path: string) => void | Promise<void>;
  private readonly emit: (list: DesktopDocumentSummary[]) => void;
  private readonly timeoutMs: number;
  private readonly claimTimeoutMs: number;
  private readonly maxSessions: number;
  private readonly maxReadBytes: number;
  private activeToken?: string;

  constructor(options: DocumentPreviewManagerOptions) {
    this.editDocument = options.editDocument;
    this.pickLocal = options.openLocal;
    this.openCopyPath = options.openCopy;
    this.emit = options.emit ?? (() => undefined);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_REVIEW_TIMEOUT_MS;
    this.claimTimeoutMs = options.claimTimeoutMs ?? DEFAULT_CLAIM_TIMEOUT_MS;
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.maxReadBytes = options.maxReadBytes ?? DEFAULT_MAX_READ_BYTES;
  }

  preview = (input: {
    document: ParsedDocument;
    operations: DocumentEditOperation[];
  }): Promise<DocumentPreviewOutcome> =>
    new Promise((resolve) => {
      const session: Session = {
        token: randomUUID(),
        mode: 'review',
        format: input.document.format,
        fileName: input.document.name,
        state: 'pending',
        changes: [],
        blocks: [],
        operations: input.operations,
        document: input.document,
        warnings: [...(input.document.warnings ?? [])],
        resolve
      };
      this.sessions.set(session.token, session);
      this.evict();
      this.emitList();

      // 鲁港通 - 15 秒内没有认领说明右栏网页端没接上，直接判不可用，绝不另弹确认窗
      session.claimTimer = setTimeout(() => {
        if (session.state !== 'pending') return;
        session.state = 'declined';
        this.finish(session, { status: 'unavailable' }, false);
      }, this.claimTimeoutMs);

      void this.loadReview(session);
    });

  openLocal = async (): Promise<DesktopDocumentSnapshot | null> => {
    if (!this.pickLocal) return null;
    let input: LocalPreviewInput | null = null;
    try {
      input = await this.pickLocal();
    } catch {
      return null;
    }
    if (!input) return null;

    const session: Session = {
      token: randomUUID(),
      mode: 'view',
      format: input.format,
      fileName: input.format === 'pdf' ? input.name : input.document.name,
      state: 'viewing',
      changes: [],
      blocks: [],
      operations: [],
      warnings: input.format === 'pdf' ? [] : [...(input.document.warnings ?? [])],
      sourcePath: input.format === 'pdf' ? input.path : input.document.path,
      ...(input.format === 'pdf' ? {} : { document: input.document })
    };
    this.sessions.set(session.token, session);
    this.evict();
    this.emitList();

    if (input.format === 'docx') {
      try {
        const model = await extractDocxPreview(input.document.path);
        session.model = model;
        session.blocks = computePreviewBlocks(model, [], []);
      } catch (error) {
        session.state = 'failed';
        session.message =
          error instanceof DocumentParseError
            ? error.message
            : '这个文档没有读取成功，请确认文件能正常打开后再选一次。';
      }
      this.emitList();
    } else if (input.format === 'xlsx') {
      try {
        const model = await extractXlsxPreview(input.document.path);
        session.xlsx = model;
        session.sheets = computeXlsxPreviewSheets(model, [], []);
        session.warnings = [...new Set([...session.warnings, ...xlsxPreviewWarnings(model)])];
      } catch (error) {
        session.state = 'failed';
        session.message =
          error instanceof DocumentParseError
            ? error.message
            : '这个表格没有读取成功，请确认文件能正常打开后再选一次。';
      }
      this.emitList();
    }

    return this.snapshot(session);
  };

  list = (): DesktopDocumentSummary[] =>
    [...this.sessions.values()].map((session) => ({
      token: session.token,
      mode: session.mode,
      format: session.format,
      fileName: session.fileName,
      state: session.state,
      total: session.changes.length,
      decided: session.changes.filter((change) => change.status !== 'pending').length
    }));

  // 鲁港通 - 网页端把右栏当前文件标签同步进来，null 表示当前显示的不是文件
  setActive = (token: string | null): void => {
    this.activeToken = token && this.sessions.has(token) ? token : undefined;
  };

  // 鲁港通 - 只返回仍在查看中的本机文件；审阅会话与读取失败的文件不参与
  readActiveDocument = (): ActiveViewDocument | undefined => {
    const session = this.activeToken ? this.sessions.get(this.activeToken) : undefined;
    if (!session || session.mode !== 'view' || session.state !== 'viewing') return undefined;
    const format = session.format;
    if (format === 'pdf') {
      if (!session.sourcePath) return undefined;
      return { format, fileName: session.fileName, path: session.sourcePath };
    }
    if (!session.document) return undefined;
    return { format, fileName: session.fileName, document: session.document };
  };

  get = (token: string): DesktopDocumentSnapshot | undefined => {
    const session = this.sessions.get(token);
    return session ? this.snapshot(session) : undefined;
  };

  claim = (token: string): DesktopDocumentSnapshot | undefined => {
    const session = this.sessions.get(token);
    if (!session) return undefined;
    if (session.state === 'pending') {
      session.state = 'reviewing';
      this.clearTimer(session, 'claimTimer');
      this.resetReviewTimer(session);
      this.emitList();
    }
    return this.snapshot(session);
  };

  decide = (
    token: string,
    index: number,
    decision: 'apply' | 'skip'
  ): DesktopDocumentSnapshot | undefined => {
    const session = this.sessions.get(token);
    if (!session) return undefined;
    if (session.state !== 'reviewing') return this.snapshot(session);

    const next = session.changes.find((change) => change.status === 'pending');
    if (!next || next.index !== index) return this.snapshot(session);

    next.status = decision === 'apply' ? 'applied' : 'skipped';
    this.afterDecision(session);
    return this.snapshot(session);
  };

  applyAll = (token: string): DesktopDocumentSnapshot | undefined => {
    const session = this.sessions.get(token);
    if (!session) return undefined;
    if (session.state !== 'reviewing') return this.snapshot(session);

    let changed = false;
    for (const change of session.changes) {
      if (change.status !== 'pending') continue;
      change.status = 'applied';
      changed = true;
    }
    if (changed) this.afterDecision(session);
    return this.snapshot(session);
  };

  close = (token: string): void => {
    const session = this.sessions.get(token);
    if (!session) return;
    if (session.mode === 'review' && isOpenReview(session)) {
      session.state = 'declined';
      this.finish(session, { status: 'declined' }, false);
      return;
    }
    if (session.state === 'finalizing') return;
    this.dropSession(token);
    this.emitList();
  };

  cancelAll = (): void => {
    for (const session of [...this.sessions.values()]) {
      if (session.mode === 'review' && isOpenReview(session)) {
        session.state = 'declined';
        this.finish(session, { status: 'declined' }, false);
        continue;
      }
      if (session.state === 'finalizing') continue;
      this.dropSession(session.token);
    }
    this.emitList();
  };

  openCopy = (token: string): boolean => {
    const session = this.sessions.get(token);
    if (!session?.copyPath || !this.openCopyPath) return false;
    void this.openCopyPath(session.copyPath);
    return true;
  };

  // 鲁港通 - 只给 PDF 查看会话发字节：网页端用内置渲染，原文件路径不出主进程
  readDocument = async (token: string): Promise<DesktopDocumentBytes | null> => {
    const session = this.sessions.get(token);
    if (session?.mode !== 'view' || session.format !== 'pdf' || !session.sourcePath) return null;
    try {
      const info = await stat(session.sourcePath);
      if (!info.isFile() || info.size > this.maxReadBytes) return null;
      const data = await readFile(session.sourcePath);
      return { name: session.fileName, data: new Uint8Array(data) };
    } catch {
      return null;
    }
  };

  // 鲁港通 - 查看会话可交回系统默认程序打开原文件，审阅中的文件不允许
  openExternal = (token: string): boolean => {
    const session = this.sessions.get(token);
    if (session?.mode !== 'view' || !session.sourcePath || !this.openCopyPath) return false;
    void this.openCopyPath(session.sourcePath);
    return true;
  };

  private loadReview = async (session: Session): Promise<void> => {
    if (!session.document) return;
    try {
      if (session.document.format === 'xlsx') {
        const model = await extractXlsxPreview(session.document.path);
        if (!isOpenReview(session)) return;
        session.xlsx = model;
        session.changes = buildXlsxPreviewChanges(model, session.operations);
        session.sheets = computeXlsxPreviewSheets(model, session.operations, session.changes);
        session.warnings = [...new Set([...session.warnings, ...xlsxPreviewWarnings(model)])];
        this.emitList();
        return;
      }
      const model = await extractDocxPreview(session.document.path);
      if (!isOpenReview(session)) return;
      session.model = model;
      session.changes = buildPreviewChanges(model, session.operations);
      session.blocks = computePreviewBlocks(model, session.operations, session.changes);
      this.emitList();
    } catch {
      // 鲁港通 - 文档过大或读取失败时不占用右栏，按不可用结束，绝不另开文字确认窗
      if (session.state !== 'pending' && session.state !== 'reviewing') return;
      session.state = 'declined';
      this.finish(session, { status: 'unavailable' }, false);
    }
  };

  private afterDecision(session: Session): void {
    if (session.xlsx) {
      session.sheets = computeXlsxPreviewSheets(session.xlsx, session.operations, session.changes);
    } else if (session.model) {
      session.blocks = computePreviewBlocks(session.model, session.operations, session.changes);
    } else {
      return;
    }

    if (session.changes.some((change) => change.status === 'pending')) {
      this.resetReviewTimer(session);
      this.emitList();
      return;
    }

    this.clearTimer(session, 'reviewTimer');
    session.state = 'finalizing';
    this.emitList();
    void this.finalize(session);
  }

  private finalize = async (session: Session): Promise<void> => {
    const applied = session.operations.filter(
      (_operation, index) => session.changes[index]?.status === 'applied'
    );
    if (applied.length === 0) {
      session.state = 'no_change';
      this.finish(session, { status: 'no_change' }, true);
      return;
    }

    try {
      const copy = await this.editDocument({
        document: session.document as ParsedDocument,
        operations: applied
      });
      session.state = 'done';
      session.copy = { name: copy.name, folder: copy.folder };
      session.copyPath = copy.path;
      this.finish(session, { status: 'done', copy }, true);
    } catch {
      session.state = 'failed';
      session.message = '副本没有生成成功，没有写入任何内容，原文件不受影响。请重试一次。';
      this.finish(session, { status: 'failed', message: session.message }, true);
    }
  };

  private finish = (
    session: Session,
    outcome: DocumentPreviewOutcome,
    keep: boolean
  ): void => {
    this.clearTimer(session, 'claimTimer');
    this.clearTimer(session, 'reviewTimer');
    if (!keep) this.dropSession(session.token);
    this.emitList();
    const resolve = session.resolve;
    session.resolve = undefined;
    resolve?.(outcome);
  };

  private resetReviewTimer(session: Session): void {
    this.clearTimer(session, 'reviewTimer');
    session.reviewTimer = setTimeout(() => {
      if (session.state !== 'reviewing') return;
      session.state = 'timeout';
      this.finish(session, { status: 'timeout' }, false);
    }, this.timeoutMs);
  }

  private clearTimer(session: Session, key: 'claimTimer' | 'reviewTimer'): void {
    const timer = session[key];
    if (timer) clearTimeout(timer);
    session[key] = undefined;
  }

  private evict(): void {
    while (this.sessions.size > this.maxSessions) {
      let candidate: Session | undefined;
      for (const session of this.sessions.values()) {
        if (session.state === 'finalizing') continue;
        candidate = session;
        break;
      }
      if (!candidate) break;
      if (candidate.mode === 'review' && isOpenReview(candidate)) {
        candidate.state = 'declined';
        this.finish(candidate, { status: 'declined' }, false);
      } else {
        this.dropSession(candidate.token);
        this.emitList();
      }
    }
  }

  private dropSession(token: string): void {
    this.sessions.delete(token);
    if (this.activeToken === token) this.activeToken = undefined;
  }

  private emitList(): void {
    this.emit(this.list());
  }

  private snapshot(session: Session): DesktopDocumentSnapshot {
    return {
      token: session.token,
      mode: session.mode,
      format: session.format,
      fileName: session.fileName,
      state: session.state,
      changes: session.changes.map((change) => ({
        index: change.index,
        target: change.target,
        ...(change.section ? { section: change.section } : {}),
        before: change.before,
        after: change.after,
        status: change.status,
        ...(change.note ? { note: change.note } : {})
      })),
      blocks: session.blocks.map((block) => ({
        ...block,
        ...(block.kind === 'table'
          ? {
              rows: block.rows.map((row) => [...row]),
              ...(block.cellMarks
                ? { cellMarks: block.cellMarks.map((mark) => ({ ...mark })) }
                : {})
            }
          : {})
      })),
      ...(session.sheets
        ? {
            sheets: session.sheets.map((sheet) => ({
              ...sheet,
              header: [...sheet.header],
              sampleRows: sheet.sampleRows.map((row) => [...row]),
              rows: sheet.rows.map((row) => [...row]),
              ...(sheet.cellMarks
                ? { cellMarks: sheet.cellMarks.map((mark) => ({ ...mark })) }
                : {}),
              ...(sheet.appendedRows
                ? {
                    appendedRows: sheet.appendedRows.map((row) => ({
                      ...row,
                      values: [...row.values]
                    }))
                  }
                : {})
            }))
          }
        : {}),
      warnings: [...session.warnings],
      ...(session.copy ? { copy: { ...session.copy } } : {}),
      ...(session.message ? { message: session.message } : {})
    };
  }
}
