// 鲁港通 - CDP 页面驱动：把受控动作翻译成 Chrome DevTools Protocol 指令
import type {
  AiFileInputState,
  AiPageDriver,
  AiPrepareInputResult,
  AiResolvedElement,
  AiScreenCapture,
  AiScrollResult,
  AiSelectOptionResult
} from './executor';
import {
  buildAiFileStateExpression,
  buildAiMaskSensitiveExpression,
  buildAiPrepareInputExpression,
  buildAiResolveExpression,
  buildAiScrollExpression,
  buildAiSelectExpression,
  buildAiSnapshotExpression,
  buildAiUnmaskExpression
} from './pageScript';
import { normalizeAiSnapshot, type AiPageScroll, type AiPageSnapshot } from './snapshot';

export type AiCdpSession = {
  sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown>;
};

export type CdpPageDriverOptions = {
  getSession: () => AiCdpSession | null;
  navigate: (url: string) => Promise<void>;
  settleMs?: number;
  commandTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_COMMAND_TIMEOUT_MS = 8000;
const MAX_SCREENSHOT_BYTES = 512 * 1024;
const MAX_SCREENSHOT_EDGE = 1600;
const SCREENSHOT_QUALITIES = [70, 55, 40] as const;
const SCREENSHOT_FAILED_MESSAGE = '页面截图失败，可能页面正在跳转或已经关闭。请稍后再试。';
export const AI_CDP_TIMEOUT_MESSAGE = '页面响应超时，页面可能正在跳转或已经卡住，请稍后重试。';

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

const normalizeCovered = (raw: unknown): AiResolvedElement['coveredBy'] => {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  const text = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;
  const tag = text(record.tag);
  const role = text(record.role);
  const name = text(record.name);
  if (!tag && !role && !name) return undefined;
  const rect = normalizeRect(record.rect);
  return {
    ...(tag ? { tag } : {}),
    ...(role ? { role } : {}),
    ...(name ? { name } : {}),
    ...(rect ? { rect } : {})
  };
};

const isCommandError = (error: unknown): error is AiDriverError =>
  error instanceof Error && error.name === 'AiDriverError';

export class AiDriverError extends Error {
  readonly code = 'page_error';
  readonly timeout: boolean;

  constructor(message: string, options: { timeout?: boolean } = {}) {
    super(message);
    this.name = 'AiDriverError';
    this.timeout = options.timeout === true;
  }
}

export class CdpPageDriver implements AiPageDriver {
  private readonly getSession: () => AiCdpSession | null;
  private readonly navigateUrl: (url: string) => Promise<void>;
  private readonly settleMs: number;
  private readonly commandTimeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: CdpPageDriverOptions) {
    this.getSession = options.getSession;
    this.navigateUrl = options.navigate;
    this.settleMs = options.settleMs ?? 250;
    this.commandTimeoutMs = options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
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
    const coveredBy = normalizeCovered(record.covered);
    return {
      found: true,
      visible: record.visible !== false,
      rect: normalizeRect(record.rect),
      ...(coveredBy ? { coveredBy } : {}),
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

  // 鲁港通 - 截图前先打码；任何一步失败都放弃本次截图，绝不上传未打码图片
  async captureScreen(): Promise<AiScreenCapture> {
    const session = this.requireSession();
    // 鲁港通 - 每次截图独立 token：看门狗提前放弃后，慢截图的收尾只解除自己的遮罩，不会误删下一条指令的遮罩
    const captureToken = `shot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    let masked = false;
    try {
      const mask = await this.evaluate<{ ok?: boolean }>(
        buildAiMaskSensitiveExpression(captureToken)
      );
      if (!mask || mask.ok !== true) throw new AiDriverError(SCREENSHOT_FAILED_MESSAGE);
      masked = true;

      const metrics = (await session.sendCommand('Page.getLayoutMetrics')) as
        | {
            cssVisualViewport?: {
              pageX?: number;
              pageY?: number;
              clientWidth?: number;
              clientHeight?: number;
            };
          }
        | undefined;
      const viewport = metrics?.cssVisualViewport ?? {};
      const x = Math.max(0, Math.round(viewport.pageX ?? 0));
      const y = Math.max(0, Math.round(viewport.pageY ?? 0));
      const width = Math.max(1, Math.round(viewport.clientWidth ?? 0));
      const height = Math.max(1, Math.round(viewport.clientHeight ?? 0));
      // 鲁港通 - Chromium 输出位图 = CSS px × devicePixelRatio，长边上限必须按设备像素算
      let dpr = 1;
      try {
        const ratio = await this.evaluate<unknown>('globalThis.devicePixelRatio || 1');
        if (typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0) dpr = ratio;
      } catch {
        // 读不到设备像素比时按 1 处理，截图流程继续
      }
      const scale = Math.min(1, MAX_SCREENSHOT_EDGE / (Math.max(width, height) * dpr));
      const pixelWidth = Math.max(1, Math.round(width * scale * dpr));
      const pixelHeight = Math.max(1, Math.round(height * scale * dpr));

      for (const quality of SCREENSHOT_QUALITIES) {
        const shot = (await session.sendCommand('Page.captureScreenshot', {
          format: 'jpeg',
          quality,
          fromSurface: true,
          clip: { x, y, width, height, scale }
        })) as { data?: string } | undefined;
        const data = typeof shot?.data === 'string' ? shot.data : '';
        if (!data) continue;
        if (Buffer.byteLength(data, 'base64') <= MAX_SCREENSHOT_BYTES) {
          return { mime: 'image/jpeg', base64: data, width: pixelWidth, height: pixelHeight };
        }
      }

      throw new AiDriverError(SCREENSHOT_FAILED_MESSAGE);
    } catch (error) {
      if (error instanceof AiDriverError) throw error;
      throw new AiDriverError(SCREENSHOT_FAILED_MESSAGE);
    } finally {
      if (masked) {
        try {
          await this.evaluate(buildAiUnmaskExpression(captureToken));
        } catch {
          // 页面已跳转或关闭时遮罩随页面消失
        }
      }
    }
  }

  async settle(): Promise<void> {
    await this.sleep(this.settleMs);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const state = await this.evaluate<string>('document.readyState');
        if (state === 'complete') return;
      } catch (error) {
        if (!isCommandError(error)) throw error;
        // 鲁港通 - 页面无响应时不再重试，避免把等待时间成倍拉长
        if (error.timeout) return;
      }
      await this.sleep(200);
    }
  }

  private requireSession(): AiCdpSession {
    const session = this.getSession();
    if (!session) throw new AiDriverError('当前没有可操作的页面，请先打开浏览器页面。');
    return {
      sendCommand: (method, params) => this.sendWithTimeout(session, method, params)
    };
  }

  // 鲁港通 - 页面命令必须有超时：页面卡住或从未渲染时 CDP 会一直不回包
  private async sendWithTimeout(
    session: AiCdpSession,
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        session.sendCommand(method, params),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new AiDriverError(AI_CDP_TIMEOUT_MESSAGE, { timeout: true })),
            this.commandTimeoutMs
          );
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
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
