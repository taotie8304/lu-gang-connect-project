// 鲁港通 - 桌面设备通道：用应用会话 Cookie 注册设备，长轮询取指令并回传结果
import type { DesktopAiState } from '../../shared/ipc';
import { parseAiCommandDetailed, type AiCommand } from './protocol';

export type DeviceChannelTokenStore = {
  load: () => string | undefined;
  save: (token: string) => void;
  clear: () => void;
};

export type DeviceCommandEnvelope = {
  id: string;
  createdAt: number;
  command: unknown;
};

export type DeviceChannelOptions = {
  baseUrl: string;
  deviceId: string;
  deviceName: string;
  appVersion: string;
  tokenStore: DeviceChannelTokenStore;
  getSessionCookie: () => Promise<string | undefined>;
  executeCommand: (command: AiCommand, context: { commandId: string }) => Promise<unknown>;
  stopExecution: () => DesktopAiState;
  /** 鲁港通 - 注册成功（拿到新设备令牌）后回调，用于补传本地待发的崩溃记录 */
  onRegistered?: (context: { token: string }) => void | Promise<void>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  pollTimeoutMs?: number;
  pollRequestTimeoutMs?: number;
  log?: (message: string, error?: unknown) => void;
};

export type DeviceChannel = {
  syncSession: () => Promise<{ registered: boolean }>;
  clearSession: () => Promise<void>;
  startPolling: () => void;
  stop: () => void;
  stopAi: () => Promise<DesktopAiState>;
};

type ActiveCommand = {
  commandId: string;
  token: string;
  stopped: boolean;
};

const SESSION_COOKIE_NAME = 'fastgpt_token';
const RETRY_DELAY_MS = 1000;
const DEFAULT_POLL_TIMEOUT_MS = 25_000;
// 鲁港通 - 长轮询请求比服务端等待多留 10 秒，超时后立即重连而不是永久挂起
const POLL_TIMEOUT_GRACE_MS = 10_000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// 鲁港通 - NextAPI 成功响应统一包裹为 { code, data }，设备通道需取内层数据
const unwrapApiData = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  return typeof record.code === 'number' && 'data' in record ? record.data : value;
};

const parseEnvelope = (value: unknown): DeviceCommandEnvelope | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || !record.id) return undefined;
  if (typeof record.createdAt !== 'number') return undefined;
  if (!record.command || typeof record.command !== 'object') return undefined;
  return { id: record.id, createdAt: record.createdAt, command: record.command };
};

const normalizeResult = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || typeof (value as { ok?: unknown }).ok !== 'boolean') {
    return { ok: false, code: 'page_error', message: '操作执行失败，请在客户端重试' };
  }
  return value as Record<string, unknown>;
};

/**
 * 设备通道由主进程独占：网页端只能触发同步与退出清理，拿不到设备令牌。
 * 长轮询、指令执行与结果回传全部在主进程完成。
 */
export const createDeviceChannel = (options: DeviceChannelOptions): DeviceChannel => {
  const {
    deviceId,
    deviceName,
    appVersion,
    tokenStore,
    getSessionCookie,
    executeCommand,
    stopExecution,
    onRegistered,
    log
  } = options;
  const root = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const pollTimeoutMs = options.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const pollRequestTimeoutMs =
    options.pollRequestTimeoutMs ?? pollTimeoutMs + POLL_TIMEOUT_GRACE_MS;

  let polling = false;
  let generation = 0;
  let active: ActiveCommand | undefined;
  let inFlight: AbortController | undefined;

  // 会话同步与退出清理串行执行，避免并发注册互相顶掉令牌
  let sessionChain: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = sessionChain.then(task, task);
    sessionChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };

  const stopPolling = () => {
    polling = false;
    generation += 1;
    // 鲁港通 - 停止轮询时立即中断挂起的请求，避免退出后仍占着长连接
    inFlight?.abort();
    inFlight = undefined;
  };

  const postResult = async (token: string, commandId: string, result: unknown) => {
    try {
      await fetchImpl(`${root}/api/proApi/desktop/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ deviceId, commandId, result }),
        // 鲁港通 - 回传必须有超时，网络半开时不能让指令处理一直挂着
        signal: AbortSignal.timeout(10_000)
      });
    } catch (error) {
      // 回传失败由服务端等待超时兜底，客户端保持轮询
      log?.('desktop result post failed', error);
    }
  };

  const handleEnvelope = async (envelope: DeviceCommandEnvelope, token: string) => {
    const parsed = parseAiCommandDetailed(envelope.command);
    if (!parsed.success) {
      await postResult(token, envelope.id, {
        ok: false,
        code: 'invalid_command',
        message: `操作指令无效：${parsed.message}`
      });
      return;
    }
    const command = parsed.command;

    const handle: ActiveCommand = { commandId: envelope.id, token, stopped: false };
    active = handle;

    let result: unknown;
    try {
      result = await executeCommand(command, { commandId: envelope.id });
    } catch (error) {
      log?.('desktop command execute failed', error);
      result = { ok: false, code: 'page_error', message: '操作执行失败，请在客户端重试' };
    }

    if (!handle.stopped) {
      await postResult(token, envelope.id, normalizeResult(result));
    }
    if (active === handle) active = undefined;
  };

  const pollLoop = async (current: number) => {
    while (polling && generation === current) {
      const token = tokenStore.load();
      if (!token) {
        stopPolling();
        return;
      }

      const controller = new AbortController();
      inFlight = controller;
      const timer = setTimeout(() => controller.abort(), pollRequestTimeoutMs);
      timer.unref?.();

      try {
        const response = await fetchImpl(
          `${root}/api/proApi/desktop/commands?deviceId=${encodeURIComponent(deviceId)}&timeoutMs=${pollTimeoutMs}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
          }
        );

        if (!polling || generation !== current) return;

        if (response.status === 401) {
          if (tokenStore.load() === token) tokenStore.clear();
          stopPolling();
          return;
        }

        if (!response.ok) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }

        const data = unwrapApiData(await response.json()) as { command?: unknown };
        const envelope = parseEnvelope(data?.command);
        if (envelope) {
          await handleEnvelope(envelope, token);
        }
      } catch (error) {
        if (!polling || generation !== current) return;
        log?.('desktop command poll failed', error);
        await sleep(RETRY_DELAY_MS);
      } finally {
        clearTimeout(timer);
        if (inFlight === controller) inFlight = undefined;
      }
    }
  };

  const startPolling = () => {
    if (polling || !tokenStore.load()) return;
    polling = true;
    const current = generation + 1;
    generation = current;
    void pollLoop(current);
  };

  const register = async (cookie: string) => {
    const response = await fetchImpl(`${root}/api/proApi/desktop/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${cookie}`
      },
      body: JSON.stringify({ deviceId, deviceName, appVersion })
    });

    if (!response.ok) return false;

    const data = unwrapApiData(await response.json()) as { token?: unknown };
    if (typeof data?.token !== 'string' || !data.token) return false;

    tokenStore.save(data.token);
    stopPolling();
    startPolling();
    // 鲁港通 - 注册成功即有机会补传本地崩溃记录；钩子失败不能影响设备通道本身
    try {
      void Promise.resolve(onRegistered?.({ token: data.token })).catch((error) => {
        log?.('desktop device registered hook failed', error);
      });
    } catch (error) {
      log?.('desktop device registered hook failed', error);
    }
    return true;
  };

  const syncSession = () =>
    enqueue(async () => {
      const cookie = (await getSessionCookie())?.trim();
      if (!cookie) {
        stopPolling();
        tokenStore.clear();
        return { registered: false };
      }

      try {
        const registered = await register(cookie);
        if (!registered && tokenStore.load()) startPolling();
        return { registered };
      } catch (error) {
        log?.('desktop device register failed', error);
        if (tokenStore.load()) startPolling();
        return { registered: false };
      }
    });

  const clearSession = () =>
    enqueue(async () => {
      stopPolling();

      if (active && !active.stopped) {
        active.stopped = true;
        stopExecution();
      }

      const token = tokenStore.load();
      try {
        if (token) {
          await fetchImpl(`${root}/api/proApi/desktop/revoke`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ deviceId })
          });
        }
      } catch (error) {
        log?.('desktop device revoke failed', error);
      } finally {
        tokenStore.clear();
      }
    });

  const stopAi = async () => {
    const state = stopExecution();
    const current = active;
    if (current && !current.stopped) {
      current.stopped = true;
      await postResult(current.token, current.commandId, {
        ok: false,
        stopped: true,
        // 鲁港通 - 把客户端的真实停止原因交给服务端，便于给出针对性的中文指引
        code: state.stopReason ?? 'stopped_by_user',
        message: state.message ?? '用户已停止操作'
      });
    }
    return state;
  };

  return {
    syncSession,
    clearSession,
    startPolling,
    stop: stopPolling,
    stopAi
  };
};
