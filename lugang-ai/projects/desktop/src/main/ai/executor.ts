// 鲁港通 - AI 指令执行器：定位、动作前安全拦截、动作后页面校验
import { isAiHostAllowed, isAiUrlAllowed } from './allowlist';
import { isHighRiskActionLabel, isSensitiveElement, matchAiTarget } from './matcher';
import { AI_STOP_MESSAGES } from './policy';
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
  | 'page_error';

export type AiCommandResult = {
  ok: boolean;
  code?: AiActionErrorCode;
  message?: string;
  snapshot?: AiPageSnapshot;
  changed?: boolean;
  stopped?: boolean;
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
  private readonly allowedHosts: string[];

  constructor(options: { driver: AiPageDriver; allowedHosts: string[] }) {
    this.driver = options.driver;
    this.allowedHosts = options.allowedHosts;
  }

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

    if (command.action === 'read') {
      const read = await this.readSnapshot({ fullText: command.fullText === true });
      if ('result' in read) return read.result;
      return { ok: true, snapshot: read.snapshot };
    }

    const initial = await this.readSnapshot();
    if ('result' in initial) return initial.result;

    if (command.action === 'scroll') return this.scroll(command, initial.snapshot);

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
      const label = [element.name, element.text, element.value].filter(Boolean).join(' ');
      if (isHighRiskActionLabel(label)) {
        return {
          ok: false,
          code: 'high_risk_blocked',
          message: AI_STOP_MESSAGES.high_risk_blocked,
          snapshot: located.snapshot
        };
      }
      return this.click(command, element, resolved, located.snapshot);
    }
    if (command.action === 'type') {
      return this.typeInto(command.text, command.expect, element, located.snapshot);
    }
    return this.select(command.option, element, located.snapshot);
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
    if (!isAiHostAllowed(parsed.hostname, this.allowedHosts)) {
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
    if (!snapshot.url || !isAiUrlAllowed(snapshot.url, this.allowedHosts)) {
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
