// 鲁港通 - AI 桌面控制器：串联执行器与浏览器生命周期，负责自愈、停止与审计
import { randomUUID } from 'node:crypto';
import type { DesktopAiState } from '../../shared/ipc';
import { isAiUrlAllowed } from './allowlist';
import { buildAiAuditRecord, type AiAuditRecord } from './audit';
import {
  AiExecutor,
  type AiActionErrorCode,
  type AiCommandResult,
  type AiConfirmer,
  type AiFileGenerator,
  type AiFilePicker,
  type AiPageDriver
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

export type AiControllerBrowser = {
  openPanel(): unknown;
  navigate(url: string): boolean;
  getState(): {
    panelOpen: boolean;
    activeTabId: number | null;
    tabs: { id: number; url: string; current: boolean }[];
  };
};

export type AiControllerOptions = {
  browser: AiControllerBrowser;
  driver: AiPageDriver;
  allowedHosts: string[];
  audit?: (record: AiAuditRecord) => Promise<void> | void;
  generateFile?: AiFileGenerator;
  pickFile?: AiFilePicker;
  confirm?: AiConfirmer;
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

export class AiController {
  private readonly browser: AiControllerBrowser;
  private readonly driver: AiPageDriver;
  private readonly executor: AiExecutor;
  private readonly allowedHosts: string[];
  private readonly auditRecord?: (record: AiAuditRecord) => Promise<void> | void;
  private readonly now: () => number;
  private readonly idleMs: number;
  private readonly listeners = new Set<(state: DesktopAiState) => void>();
  private readonly typedFields = new Map<string, string>();
  private guard: AiSessionGuard = createAiSessionGuard();
  private sessionUrl: string | undefined;
  private sessionTabId: number | undefined;
  private sessionActiveUntil = 0;
  private reopening = false;
  private pageClosedRecently = false;

  constructor(options: AiControllerOptions) {
    this.browser = options.browser;
    this.driver = options.driver;
    this.allowedHosts = options.allowedHosts;
    this.auditRecord = options.audit;
    this.now = options.now ?? (() => Date.now());
    this.idleMs = options.idleMs ?? AI_SESSION_IDLE_MS;
    this.executor = new AiExecutor({
      driver: options.driver,
      allowedHosts: options.allowedHosts,
      generateFile: options.generateFile,
      pickFile: options.pickFile,
      confirm: options.confirm
    });
  }

  getState = (): DesktopAiState => {
    const status = this.guard.stopped
      ? 'stopped'
      : this.isSessionAlive()
        ? 'running'
        : 'idle';
    return {
      status,
      reopens: this.guard.pageReopens,
      ...(this.guard.stopReason ? { stopReason: this.guard.stopReason } : {}),
      ...(this.guard.stopMessage ? { message: this.guard.stopMessage } : {}),
      ...(this.sessionUrl ? { sessionUrl: this.sessionUrl } : {})
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
      this.guard = recordAiUserStop(this.guard);
      this.sessionActiveUntil = 0;
      this.typedFields.clear();
      this.emit();
      await this.auditCommand(command, commandId, { ok: true, stopped: true }, 0);
      return { ok: true, stopped: true, message: this.guard.stopMessage };
    }

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
    this.ensurePanel();
    this.emit();

    const startedAt = this.now();
    const result = await this.executor.execute(command);
    this.capturePageState(result);
    const finalResult = this.applyResult(command, result);
    await this.auditCommand(command, commandId, finalResult, this.now() - startedAt);
    this.emit();
    return finalResult;
  };

  stop = (): DesktopAiState => {
    this.executor.cancelConfirmation();
    this.guard = recordAiUserStop(this.guard);
    this.sessionActiveUntil = 0;
    this.typedFields.clear();
    this.emit();
    return this.getState();
  };

  handleTabClosed = async (event: AiTabClosedEvent): Promise<void> => {
    if (!this.isSessionAlive() || this.reopening) return;
    if (this.sessionTabId !== undefined && event.id !== this.sessionTabId) return;
    // 鲁港通 - 页面消失时先撤销挂起的提交确认，避免确认窗卡住最长 5 分钟
    this.pageClosedRecently = true;
    this.executor.cancelConfirmation('page_closed');
    await this.reopenPage(event.url);
  };

  handlePanelClosed = async (): Promise<void> => {
    if (!this.isSessionAlive() || this.reopening) return;
    this.pageClosedRecently = true;
    this.executor.cancelConfirmation('page_closed');
    await this.reopenPage(this.sessionUrl);
  };

  private isSessionAlive(): boolean {
    return !this.guard.stopped && this.now() < this.sessionActiveUntil;
  }

  private resetSession() {
    this.guard = createAiSessionGuard();
    this.typedFields.clear();
    this.sessionUrl = undefined;
    this.sessionTabId = undefined;
    this.sessionActiveUntil = 0;
    this.pageClosedRecently = false;
  }

  private ensurePanel() {
    const state = this.browser.getState();
    if (!state.panelOpen || state.tabs.length === 0) {
      this.browser.openPanel();
    }
    const next = this.browser.getState();
    this.sessionTabId = next.activeTabId ?? this.sessionTabId;
  }

  private capturePageState(result: AiCommandResult) {
    const state = this.browser.getState();
    const current = state.tabs.find((tab) => tab.current) ?? state.tabs[0];
    if (current?.url && isAiUrlAllowed(current.url, this.allowedHosts)) {
      this.sessionUrl = current.url;
    } else if (result.snapshot?.url && isAiUrlAllowed(result.snapshot.url, this.allowedHosts)) {
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

  private async reopenPage(fallbackUrl?: string): Promise<void> {
    const targetUrl = this.sessionUrl ?? fallbackUrl;
    if (!targetUrl || !isAiUrlAllowed(targetUrl, this.allowedHosts)) {
      this.guard = stopAiSession(this.guard, 'domain_not_allowed');
      this.sessionActiveUntil = 0;
      await this.auditReopen(false, targetUrl);
      this.emit();
      return;
    }

    const decision = requestAiPageReopen(this.guard);
    this.guard = decision.next;
    if (!decision.allowed) {
      this.sessionActiveUntil = 0;
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
      await this.restoreFields();
      await this.auditReopen(true, targetUrl);
    } catch {
      const failure = recordAiActionFailure(this.guard);
      this.guard = failure.next;
      if (failure.stop) this.sessionActiveUntil = 0;
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
