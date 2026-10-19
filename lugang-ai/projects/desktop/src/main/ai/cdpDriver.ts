// 鲁港通 - CDP 页面驱动：把受控动作翻译成 Chrome DevTools Protocol 指令
import type {
  AiFileInputState,
  AiPageDriver,
  AiPrepareInputResult,
  AiResolvedElement,
  AiScrollResult,
  AiSelectOptionResult
} from './executor';
import {
  buildAiFileStateExpression,
  buildAiPrepareInputExpression,
  buildAiResolveExpression,
  buildAiScrollExpression,
  buildAiSelectExpression,
  buildAiSnapshotExpression
} from './pageScript';
import { normalizeAiSnapshot, type AiPageScroll, type AiPageSnapshot } from './snapshot';

export type AiCdpSession = {
  sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown>;
};

export type CdpPageDriverOptions = {
  getSession: () => AiCdpSession | null;
  navigate: (url: string) => Promise<void>;
  settleMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

type EvaluatePayload = {
  result?: { value?: unknown };
  exceptionDetails?: unknown;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const normalizeScroll = (raw: unknown, fallback?: AiPageScroll): AiPageScroll => {
  const record =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const num = (value: unknown, backup = 0) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : backup;
  return {
    x: num(record.x, fallback?.x ?? 0),
    y: num(record.y, fallback?.y ?? 0),
    viewportWidth: num(record.viewportWidth, fallback?.viewportWidth ?? 0),
    viewportHeight: num(record.viewportHeight, fallback?.viewportHeight ?? 0),
    pageHeight: num(record.pageHeight, fallback?.pageHeight ?? 0)
  };
};

const normalizeRect = (raw: unknown): AiResolvedElement['rect'] => {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  const num = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : NaN;
  const x = num(record.x);
  const y = num(record.y);
  const width = num(record.width);
  const height = num(record.height);
  if ([x, y, width, height].some((value) => Number.isNaN(value))) return undefined;
  return { x, y, width, height };
};

const isCommandError = (error: unknown): error is Error =>
  error instanceof Error && error.name === 'AiDriverError';

export class AiDriverError extends Error {
  readonly code = 'page_error';

  constructor(message: string) {
    super(message);
    this.name = 'AiDriverError';
  }
}

export class CdpPageDriver implements AiPageDriver {
  private readonly getSession: () => AiCdpSession | null;
  private readonly navigateUrl: (url: string) => Promise<void>;
  private readonly settleMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: CdpPageDriverOptions) {
    this.getSession = options.getSession;
    this.navigateUrl = options.navigate;
    this.settleMs = options.settleMs ?? 250;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async snapshot(options: { fullText?: boolean } = {}): Promise<AiPageSnapshot> {
    const raw = await this.evaluate<unknown>(buildAiSnapshotExpression(options));
    return normalizeAiSnapshot(raw, options);
  }

  async resolve(
    ref: string,
    options: { scrollIntoView?: boolean } = {}
  ): Promise<AiResolvedElement | null> {
    const raw = await this.evaluate<unknown>(buildAiResolveExpression(ref, options));
    if (typeof raw !== 'object' || raw === null) return null;
    const record = raw as Record<string, unknown>;
    if (record.found !== true) return null;
    return {
      found: true,
      visible: record.visible !== false,
      rect: normalizeRect(record.rect),
      ...(typeof record.value === 'string' ? { value: record.value } : {}),
      ...(typeof record.checked === 'boolean' ? { checked: record.checked } : {})
    };
  }

  async prepareInput(ref: string): Promise<AiPrepareInputResult> {
    const raw = await this.evaluate<unknown>(buildAiPrepareInputExpression(ref));
    const record =
      typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    if (record.ok === true) {
      return {
        ok: true,
        ...(typeof record.value === 'string' ? { value: record.value } : {})
      };
    }
    const reason = record.reason === 'not_editable' ? 'not_editable' : 'not_found';
    return { ok: false, reason };
  }

  async selectOption(ref: string, option: string): Promise<AiSelectOptionResult> {
    const raw = await this.evaluate<unknown>(buildAiSelectExpression(ref, option));
    const record =
      typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    if (record.ok === true) {
      return {
        ok: true,
        ...(typeof record.value === 'string' ? { value: record.value } : {}),
        ...(typeof record.text === 'string' ? { text: record.text } : {})
      };
    }
    const reason =
      record.reason === 'not_select'
        ? 'not_select'
        : record.reason === 'option_not_found'
          ? 'option_not_found'
          : 'not_found';
    return {
      ok: false,
      reason,
      ...(Array.isArray(record.options)
        ? {
            options: record.options.filter(
              (item): item is string => typeof item === 'string'
            )
          }
        : {})
    };
  }

  async scroll(
    direction: 'up' | 'down' | 'top' | 'bottom',
    amount?: number
  ): Promise<AiScrollResult> {
    const raw = await this.evaluate<unknown>(buildAiScrollExpression(direction, amount));
    const record =
      typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const before = normalizeScroll(record.before);
    const after = normalizeScroll(record.after, before);
    return {
      before,
      after,
      changed:
        record.changed === true || before.x !== after.x || before.y !== after.y
    };
  }

  async clickAt(x: number, y: number): Promise<void> {
    const session = this.requireSession();
    const point = { x: Math.round(x), y: Math.round(y) };
    await session.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...point,
      button: 'none'
    });
    await session.sendCommand('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...point,
      button: 'left',
      clickCount: 1
    });
    await session.sendCommand('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...point,
      button: 'left',
      clickCount: 1
    });
  }

  async insertText(text: string): Promise<void> {
    const session = this.requireSession();
    // 鲁港通 - Windows 客户端：全选后再插入，确保替换用户或上一轮留下的旧内容
    await session.sendCommand('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      modifiers: 2,
      windowsVirtualKeyCode: 65,
      nativeVirtualKeyCode: 65,
      key: 'a',
      code: 'KeyA'
    });
    await session.sendCommand('Input.dispatchKeyEvent', {
      type: 'keyUp',
      modifiers: 2,
      windowsVirtualKeyCode: 65,
      nativeVirtualKeyCode: 65,
      key: 'a',
      code: 'KeyA'
    });
    await session.sendCommand('Input.insertText', { text });
  }

  async navigate(url: string): Promise<void> {
    await this.navigateUrl(url);
    await this.settle();
  }

  async fileInput(ref: string): Promise<AiFileInputState> {
    const raw = await this.evaluate<unknown>(buildAiFileStateExpression(ref));
    const record =
      typeof raw === 'object' && raw !== null && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    if (record.found !== true) return { found: false };
    return {
      found: true,
      isFile: record.isFile === true,
      ...(typeof record.multiple === 'boolean' ? { multiple: record.multiple } : {}),
      ...(typeof record.accept === 'string' ? { accept: record.accept } : {}),
      ...(typeof record.count === 'number' ? { count: record.count } : {}),
      ...(Array.isArray(record.names)
        ? {
            names: record.names.filter(
              (item): item is string => typeof item === 'string'
            )
          }
        : {})
    };
  }

  async setFileInputFiles(ref: string, files: string[]): Promise<boolean> {
    if (!/^e\d{1,4}$/.test(ref) || files.length === 0) return false;
    const session = this.requireSession();
    const documentPayload = (await session.sendCommand('DOM.getDocument', {
      depth: 1
    })) as { root?: { nodeId?: unknown } } | undefined;
    const rootId = documentPayload?.root?.nodeId;
    if (typeof rootId !== 'number' || rootId <= 0) return false;
    const query = (await session.sendCommand('DOM.querySelector', {
      nodeId: rootId,
      selector: `[data-lugang-ai-ref="${ref}"]`
    })) as { nodeId?: unknown } | undefined;
    const nodeId = query?.nodeId;
    if (typeof nodeId !== 'number' || nodeId <= 0) return false;
    await session.sendCommand('DOM.setFileInputFiles', { nodeId, files });
    return true;
  }

  async settle(): Promise<void> {
    await this.sleep(this.settleMs);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const state = await this.evaluate<string>('document.readyState');
        if (state === 'complete') return;
      } catch (error) {
        if (!isCommandError(error)) throw error;
      }
      await this.sleep(200);
    }
  }

  private requireSession(): AiCdpSession {
    const session = this.getSession();
    if (!session) throw new AiDriverError('当前没有可操作的页面，请先打开浏览器页面。');
    return session;
  }

  private async evaluate<T>(expression: string): Promise<T> {
    const session = this.requireSession();
    const payload = (await session.sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    })) as EvaluatePayload | undefined;
    if (!payload || payload.exceptionDetails) {
      throw new AiDriverError('页面脚本执行失败，页面可能正在跳转，请稍后重试。');
    }
    return payload.result?.value as T;
  }
}
