import { describe, expect, it, vi } from 'vitest';
import type { DesktopAiState } from '../src/shared/ipc';
import { createDeviceChannel, type DeviceChannelTokenStore } from '../src/main/ai/deviceChannel';

const BASE_URL = 'https://www.airscend.com';
const DEVICE_ID = '4b8a5f0e-1111-4222-8333-444444444444';
const COMMAND_ID = '0f0f0f0f-1111-4222-8333-444444444444';

const idleState: DesktopAiState = { status: 'idle', reopens: 0 };
const stoppedState: DesktopAiState = { status: 'stopped', reopens: 0, stopReason: 'stopped_by_user' };

type FetchCall = { url: string; init?: RequestInit };

const jsonResponse = (body: unknown, init?: { status?: number }) =>
  ({
    ok: (init?.status ?? 200) < 400,
    status: init?.status ?? 200,
    json: async () => body
  }) as Response;

const createTokenStore = (
  initial?: string
): DeviceChannelTokenStore & { token: string | undefined; cleared: number } => {
  const store = {
    token: initial,
    cleared: 0,
    load: () => store.token,
    save: (token: string) => {
      store.token = token;
    },
    clear: () => {
      store.token = undefined;
      store.cleared += 1;
    }
  };
  return store;
};

const createChannel = (
  options: {
    responses?: Array<Response | (() => Response | Promise<Response>)>;
    route?: (url: string) => Response | undefined;
    token?: string;
    cookie?: string | undefined;
    execute?: (command: unknown, context: { commandId: string }) => Promise<unknown>;
  } = {}
) => {
  const calls: FetchCall[] = [];
  const responses = [...(options.responses ?? [])];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (options.route) {
      const routed = options.route(url);
      if (routed) return routed;
    }
    const next = responses.shift();
    // 队列耗尽后挂起，模拟长轮询等待，避免测试里的轮询空转。
    if (!next) return new Promise<Response>(() => undefined);
    return typeof next === 'function' ? next() : next;
  });
  const tokenStore = createTokenStore(options.token);
  const executeCommand = vi.fn(
    options.execute ??
      (async () => ({
        ok: true as const,
        changed: true
      }))
  );
  const stopExecution = vi.fn(() => stoppedState);
  const sleep = vi.fn(async () => undefined);

  const channel = createDeviceChannel({
    baseUrl: BASE_URL,
    deviceId: DEVICE_ID,
    appVersion: '0.2.0',
    deviceName: '办公电脑',
    tokenStore,
    getSessionCookie: async () => options.cookie,
    executeCommand,
    stopExecution,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep,
    pollTimeoutMs: 25_000
  });

  return {
    channel,
    calls,
    tokenStore,
    executeCommand,
    stopExecution,
    sleep,
    fetchImpl
  };
};

const flush = async () => {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
};

describe('桌面设备通道 · 注册与令牌', () => {
  it('registers with the app session cookie and starts polling with the device token', async () => {
    const harness = createChannel({
      cookie: 'session-cookie-value',
      responses: [
        jsonResponse({ token: 'lgd_device-token', expiresInMs: 1000 }),
        jsonResponse({ command: null })
      ]
    });

    await expect(harness.channel.syncSession()).resolves.toEqual({ registered: true });

    expect(harness.calls[0].url).toBe(`${BASE_URL}/api/proApi/desktop/register`);
    expect(harness.calls[0].init?.method).toBe('POST');
    expect(harness.calls[0].init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      Cookie: 'fastgpt_token=session-cookie-value'
    });
    expect(JSON.parse(String(harness.calls[0].init?.body))).toEqual({
      deviceId: DEVICE_ID,
      deviceName: '办公电脑',
      appVersion: '0.2.0'
    });
    expect(harness.tokenStore.token).toBe('lgd_device-token');

    await vi.waitFor(() => expect(harness.calls.length).toBeGreaterThanOrEqual(2));
    expect(harness.calls[1].url).toContain(`/api/proApi/desktop/commands?deviceId=${DEVICE_ID}`);
    expect(harness.calls[1].init?.headers).toMatchObject({
      Authorization: 'Bearer lgd_device-token'
    });

    harness.channel.stop();
  });

  it('does not register without a login cookie and clears any stale token', async () => {
    const harness = createChannel({ token: 'lgd_stale', cookie: undefined });

    await expect(harness.channel.syncSession()).resolves.toEqual({ registered: false });

    expect(harness.calls).toHaveLength(0);
    expect(harness.tokenStore.token).toBeUndefined();
    expect(harness.tokenStore.cleared).toBe(1);
  });

  it('keeps polling off when registration fails', async () => {
    const harness = createChannel({
      cookie: 'session-cookie-value',
      responses: [jsonResponse({ error: 'server' }, { status: 500 })]
    });

    await expect(harness.channel.syncSession()).resolves.toEqual({ registered: false });

    expect(harness.tokenStore.token).toBeUndefined();
    await flush();
    expect(harness.calls).toHaveLength(1);
  });

  it('stops polling and drops the token when the server rejects it', async () => {
    const harness = createChannel({
      cookie: 'session-cookie-value',
      responses: [
        jsonResponse({ token: 'lgd_device-token', expiresInMs: 1000 }),
        jsonResponse({ error: 'unAuthorization' }, { status: 401 }),
        jsonResponse({ command: null })
      ]
    });

    await harness.channel.syncSession();
    await vi.waitFor(() => expect(harness.tokenStore.cleared).toBe(1));

    expect(harness.tokenStore.token).toBeUndefined();
    harness.channel.stop();
  });
});

describe('桌面设备通道 · 指令执行', () => {
  it('executes a polled command and posts its result with the command id', async () => {
    const harness = createChannel({
      cookie: 'session-cookie-value',
      responses: [
        jsonResponse({ token: 'lgd_device-token', expiresInMs: 1000 }),
        jsonResponse({
          command: {
            id: COMMAND_ID,
            createdAt: 1_700_000_000_000,
            command: { action: 'click', target: '下一步' }
          }
        }),
        jsonResponse({ accepted: true }),
        jsonResponse({ command: null })
      ]
    });

    await harness.channel.syncSession();

    await vi.waitFor(() => expect(harness.calls.length).toBeGreaterThanOrEqual(3));
    expect(harness.executeCommand).toHaveBeenCalledWith(
      { action: 'click', target: '下一步' },
      { commandId: COMMAND_ID }
    );

    const resultCall = harness.calls[2];
    expect(resultCall.url).toBe(`${BASE_URL}/api/proApi/desktop/result`);
    expect(resultCall.init?.headers).toMatchObject({
      Authorization: 'Bearer lgd_device-token'
    });
    expect(JSON.parse(String(resultCall.init?.body))).toEqual({
      deviceId: DEVICE_ID,
      commandId: COMMAND_ID,
      result: { ok: true, changed: true }
    });

    harness.channel.stop();
  });

  it('returns an error result for a malformed command without executing it', async () => {
    const harness = createChannel({
      cookie: 'session-cookie-value',
      responses: [
        jsonResponse({ token: 'lgd_device-token', expiresInMs: 1000 }),
        jsonResponse({
          command: {
            id: COMMAND_ID,
            createdAt: 1_700_000_000_000,
            command: { action: 'submit' }
          }
        }),
        jsonResponse({ accepted: true }),
        jsonResponse({ command: null })
      ]
    });

    await harness.channel.syncSession();

    await vi.waitFor(() => expect(harness.calls.length).toBeGreaterThanOrEqual(3));
    expect(harness.executeCommand).not.toHaveBeenCalled();
    const result = JSON.parse(String(harness.calls[2].init?.body)).result;
    expect(result).toMatchObject({ ok: false, code: 'invalid_command' });

    harness.channel.stop();
  });
});

describe('桌面设备通道 · 用户停止', () => {
  it('stops the running command and reports it to the server before the action settles', async () => {
    let settleCommand: (value: unknown) => void = () => undefined;
    const executing = new Promise((resolve) => {
      settleCommand = resolve;
    });
    const harness = createChannel({
      cookie: 'session-cookie-value',
      responses: [
        jsonResponse({ token: 'lgd_device-token', expiresInMs: 1000 }),
        jsonResponse({
          command: {
            id: COMMAND_ID,
            createdAt: 1_700_000_000_000,
            command: { action: 'read' }
          }
        }),
        jsonResponse({ accepted: true }),
        jsonResponse({ command: null })
      ],
      execute: () => executing
    });

    await harness.channel.syncSession();
    await vi.waitFor(() => expect(harness.executeCommand).toHaveBeenCalledTimes(1));

    await expect(harness.channel.stopAi()).resolves.toEqual(stoppedState);
    expect(harness.stopExecution).toHaveBeenCalledTimes(1);

    await vi.waitFor(() =>
      expect(
        harness.calls.some((call) => call.url.endsWith('/api/proApi/desktop/result'))
      ).toBe(true)
    );
    const resultCall = harness.calls.find((call) => call.url.endsWith('/desktop/result'))!;
    expect(JSON.parse(String(resultCall.init?.body))).toEqual({
      deviceId: DEVICE_ID,
      commandId: COMMAND_ID,
      result: expect.objectContaining({ ok: false, stopped: true, code: 'stopped' })
    });

    settleCommand({ ok: true, changed: true });
    await flush();
    const resultCalls = harness.calls.filter((call) => call.url.endsWith('/desktop/result'));
    expect(resultCalls).toHaveLength(1);

    harness.channel.stop();
  });

  it('still stops the local session when no command is running', async () => {
    const harness = createChannel({ cookie: 'session-cookie-value' });

    await expect(harness.channel.stopAi()).resolves.toEqual(stoppedState);

    expect(harness.stopExecution).toHaveBeenCalledTimes(1);
    expect(harness.calls).toHaveLength(0);
  });
});

describe('桌面设备通道 · 退出清理', () => {
  it('revokes the device with its own token and stops polling', async () => {
    let commandCalls = 0;
    const harness = createChannel({
      token: 'lgd_saved-token',
      route: (url) => {
        if (url.endsWith('/api/proApi/desktop/revoke')) return jsonResponse({ revoked: true });
        if (url.includes('/api/proApi/desktop/commands?')) {
          commandCalls += 1;
          return jsonResponse({ command: null });
        }
        return undefined;
      }
    });
    harness.channel.startPolling();
    await vi.waitFor(() => expect(commandCalls).toBeGreaterThanOrEqual(1));

    await harness.channel.clearSession();

    expect(harness.tokenStore.token).toBeUndefined();
    expect(harness.tokenStore.cleared).toBe(1);
    const revokeCall = harness.calls.find((call) => call.url.endsWith('/desktop/revoke'))!;
    expect(revokeCall.init?.method).toBe('POST');
    expect(revokeCall.init?.headers).toMatchObject({
      Authorization: 'Bearer lgd_saved-token'
    });
    expect(JSON.parse(String(revokeCall.init?.body))).toEqual({ deviceId: DEVICE_ID });

    const pollsAfterRevoke = commandCalls;
    await flush();
    expect(commandCalls).toBe(pollsAfterRevoke);
  });

  it('clears local state even when the revoke request fails', async () => {
    const harness = createChannel({
      cookie: 'session-cookie-value',
      token: 'lgd_saved-token',
      responses: [jsonResponse({ error: 'server' }, { status: 500 })]
    });

    await expect(harness.channel.clearSession()).resolves.toBeUndefined();

    expect(harness.tokenStore.token).toBeUndefined();
    expect(harness.tokenStore.cleared).toBe(1);
  });
});
