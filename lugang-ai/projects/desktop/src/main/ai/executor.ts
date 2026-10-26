// 鲁港通 - AI 指令执行器：定位、动作前安全拦截、动作后页面校验
import { isAiPrivateHost, isAiSnapshotUrlAllowed } from './urlPolicy';
import {
  isConfirmableActionLabel,
  isPaymentActionLabel,
  isSensitiveElement,
  matchAiTarget
} from './matcher';
import { AI_STOP_MESSAGES, type AiStopReason } from './policy';
import type { AiCommand } from './protocol';
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
  | 'page_error';

export type AiFileFormat = 'docx' | 'xlsx' | 'pdf';

export type AiFileGeneratorInput = {
  format: AiFileFormat;
  fileName: string;
  title?: string;
  content?: string;
  rows?: string[][];
};

export type AiGeneratedFile = {
  name: string;
  format: AiFileFormat;
  folder: string;
  path: string;
};

export type AiFileGenerator = (input: AiFileGeneratorInput) => Promise<AiGeneratedFile>;

export type AiFilePicker = () => Promise<string | null>;

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

  constructor(options: {
    driver: AiPageDriver;
    generateFile?: AiFileGenerator;
    pickFile?: AiFilePicker;
    confirm?: AiConfirmer;
  }) {
    this.driver = options.driver;
    this.generateFile = options.generateFile;
    this.pickFile = options.pickFile;
    this.confirm = options.confirm;
  }

  cancelConfirmation = (reason?: AiConfirmCancelReason): void => {
    this.confirm?.cancel?.(reason);
  };

  async execute(command: AiCommand): Promise<AiCommandResult> {
    if (command.action === 'stop') return { ok: true, stopped: true };
    try {
      return await this.run(command);
    } catch {
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

    if (command.action === 'read') {
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
