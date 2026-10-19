// 鲁港通 - 桌面设备通道：用应用会话 Cookie 注册设备，长轮询取指令并回传结果
import type { DesktopAiState } from '../../shared/ipc';
import { parseAiCommand, type AiCommand } from './protocol';

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
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  pollTimeoutMs?: number;
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

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
    log
  } = options;
  const root = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const pollTimeoutMs = options.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;

  let polling = false;
  let generation = 0;
  let active: ActiveCommand | undefined;

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
  };

  const postResult = async (token: string, commandId: string, result: unknown) => {
    try {
      await fetchImpl(`${root}/api/proApi/desktop/result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ deviceId, commandId, result })
      });
    } catch (error) {
      // 回传失败由服务端等待超时兜底，客户端保持轮询
      log?.('desktop result post failed', error);
    }
  };

  const handleEnvelope = async (envelope: DeviceCommandEnvelope, token: string) => {
    const command = parseAiCommand(envelope.command);
    if (!command) {
      await postResult(token, envelope.id, {
        ok: false,
        code: 'invalid_command',
        message: '操作指令无效，已忽略'
      });
      return;
    }

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

      try {
        const response = await fetchImpl(
          `${root}/api/proApi/desktop/commands?deviceId=${encodeURIComponent(deviceId)}&timeoutMs=${pollTimeoutMs}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
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

        const data = (await response.json()) as { command?: unknown };
        const envelope = parseEnvelope(data?.command);
        if (envelope) {
          await handleEnvelope(envelope, token);
        }
      } catch (error) {
        log?.('desktop command poll failed', error);
        await sleep(RETRY_DELAY_MS);
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

    const data = (await response.json()) as { token?: unknown };
    if (typeof data?.token !== 'string' || !data.token) return false;

    tokenStore.save(data.token);
    stopPolling();
    startPolling();
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
        code: 'stopped',
        message: '用户已停止操作'
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
