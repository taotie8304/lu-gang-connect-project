// 鲁港通 - AI 桌面控制器：串联执行器与浏览器生命周期，负责自愈、停止与审计
import { randomUUID } from 'node:crypto';
import type {
  DesktopAiState,
  DesktopAiStep,
  DesktopAiStepStatus,
  DesktopSiteAiMode
} from '../../shared/ipc';
import {
  SITE_AI_REJECT_MESSAGES,
  evaluateSiteAiMode,
  normalizeSiteOrigin
} from '../browser/siteAiPrefs';
import { isAiUrlOperable } from './urlPolicy';
import { buildAiAuditRecord, type AiAuditRecord } from './audit';
import {
  AiExecutor,
  type AiActionErrorCode,
  type AiActiveDocumentReader,
  type AiCommandResult,
  type AiConfirmer,
  type AiDocumentOpener,
  type AiDocumentPreviewer,
  type AiDocumentReloader,
  type AiFailureHighlight,
  type AiFileGenerator,
  type AiFilePicker,
  type AiFormConfirmer,
  type AiFormFiller,
  type AiFormOpener,
  type AiFormPathOpener,
  type AiPageDriver,
  type AiPdfOutlineReader
} from './executor';
import {
  createAiSessionGuard,
  recordAiActionFailure,
  recordAiActionSuccess,
  recordAiUserStop,
  requestAiPageReopen,
  stopAiSession,
  type AiSessionGuard,
  type AiStopReason
} from './policy';
import type { AiCommand } from './protocol';

export const AI_SESSION_IDLE_MS = 10 * 60 * 1000;
export const AI_ACTION_TIMEOUT_MESSAGE =
  '页面响应超时，页面可能正在跳转或已经卡住，请稍后重试或换一种说法。';
export const AI_PAUSED_MESSAGE =
  '你已接管浏览器，AI 已暂停，页面状态都已保留。处理完成后点「让 AI 继续」即可接着操作。';

const DEFAULT_ACTION_TIMEOUT_MS = 20_000;
const DEFAULT_LONG_ACTION_TIMEOUT_MS = 320_000;
const AI_TIMELINE_MAX_STEPS = 50;
const AI_TIMELINE_SEND_STEPS = 30;
const AI_STEP_TARGET_MAX = 40;

// 鲁港通 - 与服务端长等待动作对齐：这些动作可能包含用户确认或等待加载
const LONG_WAIT_ACTIONS = new Set<AiCommand['action']>([
  'click',
  'upload',
  'open_form',
  'fill_form',
  'open_document',
  'edit_document',
  'fill_pdf'
]);

export type AiControllerBrowser = {
  openPanel(): unknown;
  navigate(url: string): boolean;
  activateTab?(id: number): unknown;
  setAiLockedTab?(id: number | null): unknown;
  /** 鲁港通 - 失败标注只画在页面视图上，由浏览器管理器注入与清除 */
  showFailureHighlight?(tabId: number, highlight: AiFailureHighlight): unknown;
  clearFailureHighlight?(tabId: number): unknown;
  /** 鲁港通 - 站点级 AI 权限按 origin 读取，默认允许 */
  getSiteAiMode?(origin: string): DesktopSiteAiMode;
  getState(): {
    panelOpen: boolean;
    activeTabId: number | null;
    tabs: { id: number; url: string; current: boolean; locked?: boolean }[];
  };
};

export type AiControllerOptions = {
  browser: AiControllerBrowser;
  driver: AiPageDriver;
  audit?: (record: AiAuditRecord) => Promise<void> | void;
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
  hasLocalDocuments?: () => boolean;
  actionTimeoutMs?: number;
  longActionTimeoutMs?: number;
  now?: () => number;
  idleMs?: number;
};

export type AiExecuteOptions = {
  resume?: boolean;
  commandId?: string;
};

export type AiTabClosedEvent = {
  id: number;
  url: string;
  active: boolean;
};

// 鲁港通 - 安全类拦截直接结束会话，其余失败按连续失败计数
const SECURITY_STOP_REASONS: Partial<
  Record<AiActionErrorCode | AiStopReason, AiStopReason>
> = {
  sensitive_blocked: 'sensitive_blocked',
  high_risk_blocked: 'high_risk_blocked',
  not_allowed: 'domain_not_allowed',
  cancelled_by_user: 'cancelled_by_user',
  handed_over: 'handed_over',
  confirmation_declined: 'confirmation_declined',
  confirmation_timeout: 'confirmation_timeout',
  confirmation_unavailable: 'confirmation_unavailable'
};

const MAX_REMEMBERED_FIELDS = 20;

// 鲁港通 - 时间线目标摘要只取元素描述或域名，截断 40 字，输入内容绝不进入
const trimStepTarget = (value?: string): string | undefined => {
  const text = value?.trim();
  if (!text) return undefined;
  return text.length > AI_STEP_TARGET_MAX ? `${text.slice(0, AI_STEP_TARGET_MAX)}…` : text;
};

const stepHost = (url?: string): string | undefined => {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
};

const resolveStepTarget = (command: AiCommand): string | undefined => {
  if (command.action === 'navigate') return trimStepTarget(stepHost(command.url));
  if (
    command.action === 'click' ||
    command.action === 'type' ||
    command.action === 'select' ||
    command.action === 'upload'
  ) {
    return trimStepTarget(command.target ?? command.ref);
  }
  return undefined;
};

export class AiController {
  private readonly browser: AiControllerBrowser;
  private readonly driver: AiPageDriver;
  private readonly executor: AiExecutor;
  private readonly auditRecord?: (record: AiAuditRecord) => Promise<void> | void;
  private readonly now: () => number;
  private readonly idleMs: number;
  private readonly actionTimeoutMs: number;
  private readonly longActionTimeoutMs: number;
  private readonly hasLocalDocuments?: () => boolean;
  private readonly readActiveDocument?: AiActiveDocumentReader;
  private readonly listeners = new Set<(state: DesktopAiState) => void>();
  private readonly typedFields = new Map<string, string>();
  private readonly steps: DesktopAiStep[] = [];
  private guard: AiSessionGuard = createAiSessionGuard();
  private sessionUrl: string | undefined;
  private sessionTabId: number | undefined;
  private sessionActiveUntil = 0;
  private lockedTabId: number | null = null;
  private paused = false;
  private activeStep: DesktopAiStep | undefined;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private reopening = false;
  private pageClosedRecently = false;
  private highlightTabId: number | undefined;

  constructor(options: AiControllerOptions) {
    this.browser = options.browser;
    this.driver = options.driver;
    this.auditRecord = options.audit;
    this.now = options.now ?? (() => Date.now());
    this.idleMs = options.idleMs ?? AI_SESSION_IDLE_MS;
    this.actionTimeoutMs = options.actionTimeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
    this.longActionTimeoutMs =
      options.longActionTimeoutMs ?? DEFAULT_LONG_ACTION_TIMEOUT_MS;
    this.hasLocalDocuments = options.hasLocalDocuments;
    this.readActiveDocument = options.readActiveDocument;
    this.executor = new AiExecutor({
      driver: options.driver,
      generateFile: options.generateFile,
      pickFile: options.pickFile,
      confirm: options.confirm ? this.wrapConfirm(options.confirm) : undefined,
      openForm: options.openForm,
      openFormAtPath: options.openFormAtPath,
      fillForm: options.fillForm,
      confirmForm: options.confirmForm ? this.wrapFormConfirm(options.confirmForm) : undefined,
      openDocument: options.openDocument,
      readActiveDocument: options.readActiveDocument,
      readPdfOutline: options.readPdfOutline,
      reloadDocument: options.reloadDocument,
      previewDocument: options.previewDocument
        ? this.wrapDocumentPreview(options.previewDocument)
        : undefined
    });
  }

  getState = (): DesktopAiState => {
    const status = this.guard.stopped
      ? 'stopped'
      : this.paused
        ? 'paused'
        : this.isSessionAlive()
          ? 'running'
          : 'idle';
    return {
      status,
      reopens: this.guard.pageReopens,
      ...(this.guard.stopReason ? { stopReason: this.guard.stopReason } : {}),
      ...(this.guard.stopMessage ? { message: this.guard.stopMessage } : {}),
      ...(this.sessionUrl ? { sessionUrl: this.sessionUrl } : {}),
      lockedTabId: this.lockedTabId,
      steps: this.steps.slice(-AI_TIMELINE_SEND_STEPS)
    };
  };

  subscribe = (listener: (state: DesktopAiState) => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  execute = async (
    command: AiCommand,
    options: AiExecuteOptions = {}
  ): Promise<AiCommandResult> => {
    const commandId = options.commandId ?? randomUUID();

    if (command.action === 'stop') {
      this.executor.cancelConfirmation();
      this.executor.cancelFormConfirmation();
      this.executor.cancelDocumentConfirmation();
      this.clearFailureHighlight();
      this.guard = recordAiUserStop(this.guard);
      this.paused = false;
      this.activeStep = undefined;
      this.sessionActiveUntil = 0;
      this.typedFields.clear();
      this.clearIdleTimer();
      this.releaseLock();
      this.pushStep({ action: 'stop', label: 'stop', status: 'ok' });
      this.emit();
      await this.auditCommand(command, commandId, { ok: true, stopped: true }, 0);
      return { ok: true, stopped: true, message: this.guard.stopMessage };
    }

    // 鲁港通 - 接管期间拒绝后续指令：不消耗连续失败次数，也不记为失败审计
    if (this.paused) {
      return { ok: false, code: 'user_handover', message: AI_PAUSED_MESSAGE };
    }

    // 鲁港通 - 进入下一次操作前先撤掉上一轮的失败标注，避免页面残留旧提示
    this.clearFailureHighlight();

    if (this.guard.stopped) {
      if (!options.resume) {
        return {
          ok: false,
          stopped: true,
          code: this.guard.stopReason,
          message: this.guard.stopMessage
        };
      }
      this.resetSession();
    } else if (!this.isSessionAlive()) {
      this.resetSession();
    }

    this.sessionActiveUntil = this.now() + this.idleMs;
    this.scheduleIdleRelease();
    const startedAt = this.now();
    // 鲁港通 - 表单与文档动作只处理本机文件，不应打开或切换办事浏览器
    const localOnly =
      command.action === 'open_form' ||
      command.action === 'fill_form' ||
      command.action === 'open_document' ||
      command.action === 'edit_document';
    // 鲁港通 - 右栏打开的是本机文件时直接读文件，不打开面板也不新建空白标签
    const readLocalFile = command.action === 'read' && this.hasActiveDocument();
    // 鲁港通 - 站点级 AI 权限：仅约束网页动作，本机文件动作与用户手动浏览不受影响
    if (!localOnly && !readLocalFile) {
      const rejection = this.siteAiRejection(command);
      if (rejection) {
        const step = this.beginStep(command);
        this.finishStep(step, rejection, false);
        this.emit();
        await this.auditCommand(command, commandId, rejection, this.now() - startedAt);
        return rejection;
      }
    }
    if (!localOnly) {
      // 鲁港通 - 右栏没有可读的网页时快速给出可操作指引，避免白等超时
      if (command.action === 'read' && !readLocalFile && !this.hasUsablePage()) {
        const result = this.localReadHint();
        await this.auditCommand(command, commandId, result, this.now() - startedAt);
        this.emit();
        return result;
      }
      if (!readLocalFile) this.ensurePanel();
    }
    const step = this.beginStep(command);
    this.emit();

    const result = await this.executeWithTimeout(command);

    // 鲁港通 - 执行中被接管：在途指令按 user_handover 回传，不改写会话状态
    if (this.paused) {
      this.finishStep(step, result, true);
      const handover: AiCommandResult = {
        ok: false,
        stopped: true,
        code: 'user_handover',
        message: AI_PAUSED_MESSAGE
      };
      await this.auditCommand(command, commandId, handover, this.now() - startedAt);
      this.emit();
      return handover;
    }

    this.capturePageState(result);
    if (!result.ok && result.highlight) this.showFailureHighlight(result.highlight);
    // 鲁港通 - 标注只是本机展示信息，上行给服务端与模型前剔除
    const upstreamResult = this.stripFailureHighlight(result);
    this.finishStep(step, upstreamResult, false);
    this.syncLock();
    const finalResult = this.applyResult(command, upstreamResult);
    if (this.guard.stopped) {
      this.clearIdleTimer();
      this.releaseLock();
    }
    await this.auditCommand(command, commandId, finalResult, this.now() - startedAt);
    this.emit();
    return finalResult;
  };

  stop = (): DesktopAiState => {
    this.executor.cancelConfirmation();
    this.executor.cancelFormConfirmation();
    this.executor.cancelDocumentConfirmation();
    this.clearFailureHighlight();
    this.guard = recordAiUserStop(this.guard);
    this.paused = false;
    this.activeStep = undefined;
    this.sessionActiveUntil = 0;
    this.typedFields.clear();
    this.clearIdleTimer();
    this.releaseLock();
    this.pushStep({ action: 'stop', label: 'stop', status: 'ok' });
    this.emit();
    return this.getState();
  };

  // 鲁港通 - 一键接管：只暂停后续动作，页面、滚动位置与已填内容全部保留
  pause = (): DesktopAiState => {
    if (this.paused || this.guard.stopped || !this.isSessionAlive()) return this.getState();
    this.executor.cancelConfirmation('cancel');
    this.executor.cancelFormConfirmation();
    this.executor.cancelDocumentConfirmation();
    this.clearFailureHighlight();
    this.paused = true;
    this.sessionActiveUntil = this.now() + this.idleMs;
    this.scheduleIdleRelease();
    this.setActiveStepStatus('paused');
    this.pushStep({ action: 'pause', label: 'pause', status: 'paused', url: this.sessionUrl });
    this.emit();
    return this.getState();
  };

  // 鲁港通 - 让 AI 继续：本地恢复会话，沿用原绑定标签与 URL；停止原因 handed_over 也可恢复
  resume = (): DesktopAiState => {
    const handedOver = this.guard.stopped && this.guard.stopReason === 'handed_over';
    if (!this.paused && !handedOver) return this.getState();
    this.paused = false;
    this.guard = handedOver ? createAiSessionGuard() : recordAiActionSuccess(this.guard);
    this.sessionActiveUntil = this.now() + this.idleMs;
    this.syncLock();
    this.scheduleIdleRelease();
    this.pushStep({ action: 'resume', label: 'resume', status: 'ok', url: this.sessionUrl });
    this.emit();
    return this.getState();
  };

  handleTabClosed = async (event: AiTabClosedEvent): Promise<void> => {
    if (!this.isSessionAlive() || this.reopening) return;
    if (this.sessionTabId !== undefined && event.id !== this.sessionTabId) return;
    // 鲁港通 - 页面消失时先撤销挂起的提交确认，避免确认窗卡住最长 5 分钟
    this.pageClosedRecently = true;
    this.executor.cancelConfirmation('page_closed');
    this.executor.cancelFormConfirmation();
    this.executor.cancelDocumentConfirmation();
    await this.reopenPage(event.url);
  };

  handlePanelClosed = async (): Promise<void> => {
    if (!this.isSessionAlive() || this.reopening) return;
    this.pageClosedRecently = true;
    this.executor.cancelConfirmation('page_closed');
    this.executor.cancelFormConfirmation();
    this.executor.cancelDocumentConfirmation();
    await this.reopenPage(this.sessionUrl);
  };

  private isSessionAlive(): boolean {
    return !this.guard.stopped && this.now() < this.sessionActiveUntil;
  }

  private resetSession() {
    this.guard = createAiSessionGuard();
    this.typedFields.clear();
    this.steps.length = 0;
    this.activeStep = undefined;
    this.paused = false;
    this.sessionUrl = undefined;
    this.sessionTabId = undefined;
    this.sessionActiveUntil = 0;
    this.pageClosedRecently = false;
    this.clearIdleTimer();
    this.releaseLock();
  }

  private ensurePanel() {
    const state = this.browser.getState();
    if (!state.panelOpen || state.tabs.length === 0) {
      this.browser.openPanel();
    }
    // 鲁港通 - 用户切到其他标签浏览后，AI 执行前自动切回绑定标签
    if (
      this.sessionTabId !== undefined &&
      this.browser.getState().tabs.some((tab) => tab.id === this.sessionTabId)
    ) {
      this.browser.activateTab?.(this.sessionTabId);
    }
    const next = this.browser.getState();
    this.sessionTabId = next.activeTabId ?? this.sessionTabId;
    this.syncLock();
  }

  private hasActiveDocument(): boolean {
    if (!this.readActiveDocument) return false;
    try {
      return Boolean(this.readActiveDocument());
    } catch {
      return false;
    }
  }

  private hasUsablePage(): boolean {
    return this.browser.getState().tabs.some((tab) => isAiUrlOperable(tab.url));
  }

  private localReadHint(): AiCommandResult {
    const message = this.hasLocalDocuments?.()
      ? '右栏里有文件，我可以直接读取。请先点开右栏的文件标签，再让我读取；也可以打开一个网页让我读取页面内容。'
      : '右栏没有可以读取的内容，请先在右栏打开一个网页或文件，再让我读取。';
    return { ok: false, code: 'page_error', message };
  }

  // 鲁港通 - 导航按目标站点判定，其余动作按当前绑定或活动标签判定
  private resolveSiteOrigin(command: AiCommand): string | null {
    if (command.action === 'navigate') return normalizeSiteOrigin(command.url);
    const state = this.browser.getState();
    const tab =
      state.tabs.find((item) => item.current) ??
      state.tabs.find((item) => item.id === this.sessionTabId);
    return normalizeSiteOrigin(tab?.url ?? '') ?? normalizeSiteOrigin(this.sessionUrl ?? '');
  }

  private siteAiRejection(command: AiCommand): AiCommandResult | undefined {
    if (!this.browser.getSiteAiMode) return undefined;
    const origin = this.resolveSiteOrigin(command);
    if (!origin) return undefined;
    const decision = evaluateSiteAiMode(this.browser.getSiteAiMode(origin), command.action);
    if (decision.allowed) return undefined;
    return {
      ok: false,
      code: decision.reason === 'blocked' ? 'site_blocked' : 'site_read_only',
      message: SITE_AI_REJECT_MESSAGES[decision.reason]
    };
  }

  // 鲁港通 - 失败标注只在本机页面视图上展示，随时可被下一次操作或停止动作撤掉
  private showFailureHighlight(highlight: AiFailureHighlight) {
    const tabId = this.browser.getState().activeTabId ?? this.sessionTabId;
    if (tabId === undefined) return;
    this.highlightTabId = tabId;
    this.browser.showFailureHighlight?.(tabId, highlight);
  }

  private clearFailureHighlight() {
    const tabId = this.highlightTabId;
    this.highlightTabId = undefined;
    if (tabId === undefined) return;
    this.browser.clearFailureHighlight?.(tabId);
  }

  private stripFailureHighlight(result: AiCommandResult): AiCommandResult {
    if (!result.highlight) return result;
    const copy = { ...result };
    delete copy.highlight;
    return copy;
  }

  // 鲁港通 - 指令看门狗：页面卡死时按时返回失败，避免整条指令通道被永久占住
  private async executeWithTimeout(command: AiCommand): Promise<AiCommandResult> {
    const timeoutMs = LONG_WAIT_ACTIONS.has(command.action)
      ? this.longActionTimeoutMs
      : this.actionTimeoutMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.executor.execute(command),
        new Promise<AiCommandResult>((resolve) => {
          timer = setTimeout(() => {
            this.executor.cancelConfirmation('cancel');
            this.executor.cancelFormConfirmation();
            this.executor.cancelDocumentConfirmation();
            resolve({
              ok: false,
              code: 'timeout',
              message: AI_ACTION_TIMEOUT_MESSAGE,
              highlight: { kind: 'page', message: AI_ACTION_TIMEOUT_MESSAGE }
            });
          }, timeoutMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private capturePageState(result: AiCommandResult) {
    const state = this.browser.getState();
    const current = state.tabs.find((tab) => tab.current) ?? state.tabs[0];
    if (current?.url && isAiUrlOperable(current.url)) {
      this.sessionUrl = current.url;
    } else if (result.snapshot?.url && isAiUrlOperable(result.snapshot.url)) {
      this.sessionUrl = result.snapshot.url;
    }
    this.sessionTabId = state.activeTabId ?? this.sessionTabId;
  }

  private applyResult(command: AiCommand, result: AiCommandResult): AiCommandResult {
    if (result.ok) {
      this.guard = recordAiActionSuccess(this.guard);
      this.pageClosedRecently = false;
      if (command.action === 'type' && command.target) {
        this.rememberField(command.target, command.text);
      }
      // 鲁港通 - 提交成功后本轮自动操作结束，不自动继续点击后续按钮
      if (command.action === 'click' && result.confirmation?.decision === 'allow') {
        this.guard = stopAiSession(this.guard, 'submitted');
        this.sessionActiveUntil = 0;
        return {
          ...result,
          stopped: true,
          code: this.guard.stopReason,
          message: this.guard.stopMessage
        };
      }
      return result;
    }

    if (
      result.confirmation?.decision === 'allow' &&
      (result.code === 'verification_failed' || result.code === 'page_error')
    ) {
      this.guard = stopAiSession(this.guard, 'submission_unconfirmed');
      this.sessionActiveUntil = 0;
      return {
        ...result,
        stopped: true,
        code: this.guard.stopReason,
        message: this.guard.stopMessage
      };
    }

    const securityReason = result.code ? SECURITY_STOP_REASONS[result.code] : undefined;
    if (securityReason) {
      this.guard = stopAiSession(this.guard, securityReason);
      return {
        ...result,
        stopped: true,
        code: this.guard.stopReason,
        message: this.guard.stopMessage
      };
    }

    // 鲁港通 - 站点偏好拦截是用户设置，不是页面故障，不消耗连续失败额度
    if (result.code === 'site_read_only' || result.code === 'site_blocked') {
      return result;
    }

    // 鲁港通 - 关页引起的读取失败不消耗连续失败额度，避免页面刚重开就误停
    if (this.pageClosedRecently && result.code === 'page_error') {
      this.pageClosedRecently = false;
      return result;
    }

    const failure = recordAiActionFailure(this.guard);
    this.guard = failure.next;
    if (failure.stop) {
      return {
        ...result,
        stopped: true,
        code: this.guard.stopReason,
        message: failure.message
      };
    }
    return result;
  }

  private rememberField(target: string, text: string) {
    if (!this.typedFields.has(target) && this.typedFields.size >= MAX_REMEMBERED_FIELDS) {
      const oldest = this.typedFields.keys().next().value;
      if (oldest !== undefined) this.typedFields.delete(oldest);
    }
    this.typedFields.set(target, text);
  }

  // 鲁港通 - 标签锁定以 AI 会话为准：会话有效时锁绑定标签，停止/接管结束/闲置到期即解锁
  private syncLock() {
    const target =
      this.sessionTabId !== undefined && !this.guard.stopped && this.isSessionAlive()
        ? this.sessionTabId
        : null;
    if (target === this.lockedTabId) return;
    this.lockedTabId = target;
    this.browser.setAiLockedTab?.(target);
  }

  private releaseLock() {
    if (this.lockedTabId === null) return;
    this.lockedTabId = null;
    this.browser.setAiLockedTab?.(null);
  }

  // 鲁港通 - 闲置到期必须解锁，否则用户再也关不掉这个标签
  private scheduleIdleRelease() {
    this.clearIdleTimer();
    if (this.guard.stopped) return;
    const delay = this.sessionActiveUntil - this.now();
    if (delay <= 0) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;
      if (this.guard.stopped || this.now() < this.sessionActiveUntil) return;
      this.sessionActiveUntil = 0;
      this.paused = false;
      this.activeStep = undefined;
      this.typedFields.clear();
      this.releaseLock();
      this.emit();
    }, delay);
    (this.idleTimer as { unref?: () => void }).unref?.();
  }

  private clearIdleTimer() {
    if (!this.idleTimer) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }

  private pushStep(input: Omit<DesktopAiStep, 'id' | 'at'>): DesktopAiStep {
    const step: DesktopAiStep = { id: randomUUID(), at: this.now(), ...input };
    this.steps.push(step);
    if (this.steps.length > AI_TIMELINE_MAX_STEPS) {
      this.steps.splice(0, this.steps.length - AI_TIMELINE_MAX_STEPS);
    }
    return step;
  }

  private beginStep(command: AiCommand): DesktopAiStep {
    const target = resolveStepTarget(command);
    this.activeStep = this.pushStep({
      action: command.action,
      label: command.action,
      ...(target ? { target } : {}),
      status: 'running'
    });
    return this.activeStep;
  }

  private finishStep(step: DesktopAiStep, result: AiCommandResult, paused: boolean) {
    step.status = paused ? 'paused' : result.ok ? 'ok' : 'failed';
    if (!result.ok && result.code) step.code = result.code;
    if (this.activeStep === step) this.activeStep = undefined;
  }

  private setActiveStepStatus(status: DesktopAiStepStatus) {
    if (!this.activeStep) return;
    this.activeStep.status = status;
    this.emit();
  }

  // 鲁港通 - 等待用户确认期间把当前步骤标成「等待确认」，包装后必须保留 cancel 入口
  private wrapConfirm(confirm: AiConfirmer): AiConfirmer {
    const wrapped = (async (request) => {
      this.setActiveStepStatus('confirming');
      try {
        return await confirm(request);
      } finally {
        if (this.activeStep?.status === 'confirming') this.setActiveStepStatus('running');
      }
    }) as AiConfirmer;
    wrapped.cancel = (reason) => confirm.cancel?.(reason);
    return wrapped;
  }

  private wrapFormConfirm(confirmForm: AiFormConfirmer): AiFormConfirmer {
    const wrapped = (async (request) => {
      this.setActiveStepStatus('confirming');
      try {
        return await confirmForm(request);
      } finally {
        if (this.activeStep?.status === 'confirming') this.setActiveStepStatus('running');
      }
    }) as AiFormConfirmer;
    wrapped.cancel = () => confirmForm.cancel?.();
    return wrapped;
  }

  private wrapDocumentPreview(preview: AiDocumentPreviewer): AiDocumentPreviewer {
    const markConfirming = async <T>(run: () => Promise<T>): Promise<T> => {
      this.setActiveStepStatus('confirming');
      try {
        return await run();
      } finally {
        if (this.activeStep?.status === 'confirming') this.setActiveStepStatus('running');
      }
    };
    const wrapped = ((input) => markConfirming(() => preview(input))) as AiDocumentPreviewer;
    wrapped.cancel = () => preview.cancel?.();
    if (preview.previewPdf) {
      const previewPdf = preview.previewPdf.bind(preview);
      wrapped.previewPdf = (input) => markConfirming(() => previewPdf(input));
    }
    return wrapped;
  }

  private async reopenPage(fallbackUrl?: string): Promise<void> {
    const targetUrl = this.sessionUrl ?? fallbackUrl;
    if (!targetUrl || !isAiUrlOperable(targetUrl)) {
      this.guard = stopAiSession(this.guard, 'domain_not_allowed');
      this.sessionActiveUntil = 0;
      this.clearIdleTimer();
      this.releaseLock();
      await this.auditReopen(false, targetUrl);
      this.emit();
      return;
    }

    const decision = requestAiPageReopen(this.guard);
    this.guard = decision.next;
    if (!decision.allowed) {
      this.sessionActiveUntil = 0;
      this.clearIdleTimer();
      this.releaseLock();
      await this.auditReopen(false, targetUrl);
      this.emit();
      return;
    }

    this.reopening = true;
    try {
      this.browser.openPanel();
      if (!this.browser.navigate(targetUrl)) {
        throw new Error('navigate rejected');
      }
      await this.driver.settle();
      const state = this.browser.getState();
      this.sessionTabId = state.activeTabId ?? undefined;
      this.sessionUrl = targetUrl;
      this.sessionActiveUntil = this.now() + this.idleMs;
      this.syncLock();
      this.scheduleIdleRelease();
      await this.restoreFields();
      await this.auditReopen(true, targetUrl);
    } catch {
      const failure = recordAiActionFailure(this.guard);
      this.guard = failure.next;
      if (failure.stop) {
        this.sessionActiveUntil = 0;
        this.clearIdleTimer();
        this.releaseLock();
      }
      await this.auditReopen(false, targetUrl);
    } finally {
      this.reopening = false;
      this.emit();
    }
  }

  // 鲁港通 - 重开页面后只恢复 AI 成功输入过的非敏感字段，恢复失败不阻断会话
  private async restoreFields(): Promise<void> {
    for (const [target, text] of [...this.typedFields]) {
      try {
        await this.executor.execute({ action: 'type', target, text });
      } catch {
        // 单个字段恢复失败按尽力而为处理
      }
    }
  }

  private async auditCommand(
    command: AiCommand,
    commandId: string,
    result: AiCommandResult,
    durationMs: number
  ): Promise<void> {
    if (!this.auditRecord) return;
    const outcome = result.ok
      ? result.stopped
        ? 'stopped'
        : 'ok'
      : result.code && SECURITY_STOP_REASONS[result.code]
        ? 'blocked'
        : result.stopped
          ? 'stopped'
          : 'failed';
    const record = buildAiAuditRecord({
      commandId,
      action: command.action,
      outcome,
      errorCode: result.code,
      url: this.sessionUrl ?? result.snapshot?.url,
      target: 'target' in command ? command.target : undefined,
      durationMs,
      confirmation: result.confirmation,
      now: new Date(this.now())
    });
    try {
      await this.auditRecord(record);
    } catch {
      // 审计写入失败不影响用户操作
    }
  }

  private async auditReopen(ok: boolean, url?: string): Promise<void> {
    if (!this.auditRecord) return;
    const record = buildAiAuditRecord({
      commandId: randomUUID(),
      action: 'reopen',
      outcome: ok ? 'ok' : 'failed',
      url,
      reopen: true,
      now: new Date(this.now())
    });
    try {
      await this.auditRecord(record);
    } catch {
      // 审计写入失败不影响用户操作
    }
  }

  private emit() {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // 单个订阅者异常不影响其他订阅者
      }
    }
  }
}
