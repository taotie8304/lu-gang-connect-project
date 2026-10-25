import { describe, expect, it, vi } from 'vitest';
import { ERROR_ENUM } from '@fastgpt/global/common/error/errorCode';
import {
  DESKTOP_BUSY_LONG_TTL_MS,
  DESKTOP_BUSY_TTL_MS,
  DESKTOP_HEARTBEAT_TTL_SECONDS,
  DESKTOP_QUEUE_TTL_MS,
  DESKTOP_RESULT_TTL_SECONDS,
  DESKTOP_TOKEN_PREFIX,
  DESKTOP_TOKEN_TTL_MS,
  getDesktopCommandBusyTtlMs
} from '@fastgpt/service/support/desktopCommand/constant';
import {
  createDesktopToken,
  hashDesktopToken,
  parseBearerToken
} from '@fastgpt/service/support/desktopCommand/token';
import type { DesktopCommandStore } from '@fastgpt/service/support/desktopCommand/store';
import { createTestStore as createStore } from './desktopTestStore';

const deviceId = 'device_12345678';

const register = (store: DesktopCommandStore, overrides: Record<string, string> = {}) =>
  store.register({
    deviceId,
    deviceName: '办公电脑',
    appVersion: '0.2.0',
    tmbId: 'tmb-1',
    userId: 'user-1',
    teamId: 'team-1',
    ...overrides
  });

const bearer = (token: string) => `Bearer ${token}`;

describe('desktop command token', () => {
  it('creates an opaque prefixed token that differs on every call', () => {
    const first = createDesktopToken();
    const second = createDesktopToken();

    expect(first.startsWith(DESKTOP_TOKEN_PREFIX)).toBe(true);
    expect(first).toMatch(/^lgd_[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it('hashes tokens deterministically into sha256 hex', () => {
    const token = 'lgd_test-token';

    expect(hashDesktopToken(token)).toBe(hashDesktopToken(token));
    expect(hashDesktopToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDesktopToken(token)).not.toBe(hashDesktopToken(`${token}-other`));
  });

  it('parses only a well formed bearer header', () => {
    expect(parseBearerToken('Bearer lgd_abc')).toBe('lgd_abc');
    expect(parseBearerToken('bearer lgd_abc')).toBe('lgd_abc');
    expect(parseBearerToken(['Bearer lgd_abc'])).toBe('lgd_abc');
    expect(parseBearerToken(undefined)).toBeUndefined();
    expect(parseBearerToken('Basic lgd_abc')).toBeUndefined();
    expect(parseBearerToken('Bearer')).toBeUndefined();
  });
});

describe('desktop command store registration', () => {
  it('returns the token once and persists hashed device, token and owner records', async () => {
    const { store, redis } = createStore();

    const result = await register(store);

    expect(result.token).toMatch(/^lgd_/);
    expect(result.expiresInMs).toBe(DESKTOP_TOKEN_TTL_MS);

    const device = JSON.parse((await redis.get(`desktop-command:v1:device:${deviceId}`))!);
    expect(device).toMatchObject({
      deviceId,
      deviceName: '办公电脑',
      appVersion: '0.2.0',
      tmbId: 'tmb-1',
      userId: 'user-1',
      teamId: 'team-1',
      tokenHash: hashDesktopToken(result.token)
    });
    expect(device.token).toBeUndefined();

    const tokenRecord = JSON.parse(
      (await redis.get(`desktop-command:v1:token:${device.tokenHash}`))!
    );
    expect(tokenRecord).toMatchObject({
      deviceId,
      tmbId: 'tmb-1',
      userId: 'user-1',
      teamId: 'team-1'
    });

    expect(await redis.get('desktop-command:v1:owner:tmb-1')).toBe(deviceId);
    expect(await redis.get(`desktop-command:v1:hb:${deviceId}`)).toBe('1');

    expect(redis.setCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: `desktop-command:v1:device:${deviceId}`,
          ttlMs: DESKTOP_TOKEN_TTL_MS
        }),
        expect.objectContaining({
          key: `desktop-command:v1:token:${device.tokenHash}`,
          ttlMs: DESKTOP_TOKEN_TTL_MS
        }),
        expect.objectContaining({
          key: 'desktop-command:v1:owner:tmb-1',
          ttlMs: DESKTOP_TOKEN_TTL_MS
        }),
        expect.objectContaining({
          key: `desktop-command:v1:hb:${deviceId}`,
          ttlMs: DESKTOP_HEARTBEAT_TTL_SECONDS * 1000
        })
      ])
    );
  });

  it('rotates the token and invalidates the previous one on re-register', async () => {
    const { store } = createStore();

    const first = await register(store);
    const second = await register(store);

    expect(second.token).not.toBe(first.token);
    await expect(
      store.authenticate({ deviceId, authorization: bearer(first.token) })
    ).rejects.toThrow(ERROR_ENUM.unAuthorization);
    await expect(
      store.authenticate({ deviceId, authorization: bearer(second.token) })
    ).resolves.toMatchObject({ tmbId: 'tmb-1', deviceId });
  });

  it('clears the previous owner mapping when the same device registers another account', async () => {
    const { store, redis } = createStore();

    await register(store);
    await register(store, { tmbId: 'tmb-2', userId: 'user-2' });

    expect(await redis.get('desktop-command:v1:owner:tmb-1')).toBeNull();
    expect(await redis.get('desktop-command:v1:owner:tmb-2')).toBe(deviceId);
  });

  it('rejects a missing, malformed, unknown or mismatched device token', async () => {
    const { store } = createStore();
    const { token } = await register(store);

    await expect(store.authenticate({ deviceId })).rejects.toThrow(
      ERROR_ENUM.unAuthorization
    );
    await expect(
      store.authenticate({ deviceId, authorization: 'Bearer not-a-desktop-token' })
    ).rejects.toThrow(ERROR_ENUM.unAuthorization);
    await expect(
      store.authenticate({ deviceId, authorization: 'Bearer lgd_unknown-token' })
    ).rejects.toThrow(ERROR_ENUM.unAuthorization);
    await expect(
      store.authenticate({
        deviceId: 'device_other_1234',
        authorization: bearer(token)
      })
    ).rejects.toThrow(ERROR_ENUM.unAuthorization);
  });

  it('reports online while the heartbeat is fresh and offline after it expires', async () => {
    const { store, advance } = createStore();
    await register(store);

    await expect(store.isDeviceOnline(deviceId)).resolves.toBe(true);

    advance(DESKTOP_HEARTBEAT_TTL_SECONDS * 1000);
    await expect(store.isDeviceOnline(deviceId)).resolves.toBe(false);
  });

  it('refreshes the heartbeat on every authenticated poll', async () => {
    const { store, advance } = createStore();
    const { token } = await register(store);

    advance(DESKTOP_HEARTBEAT_TTL_SECONDS * 1000 - 1);
    await store.authenticate({ deviceId, authorization: bearer(token) });
    advance(DESKTOP_HEARTBEAT_TTL_SECONDS * 1000 - 1);

    await expect(store.isDeviceOnline(deviceId)).resolves.toBe(true);
  });

  it('resolves the latest device for an owner and returns no unknown device', async () => {
    const { store } = createStore();
    await register(store);

    await expect(store.getDeviceByOwner('tmb-1')).resolves.toBe(deviceId);
    await expect(store.getDeviceByOwner('tmb-unknown')).resolves.toBeUndefined();
  });
});

describe('desktop command busy window', () => {
  it('keeps the device online while a taken command is still executing', async () => {
    const { store, advance } = createStore();
    await register(store);
    advance(DESKTOP_HEARTBEAT_TTL_SECONDS * 1000);
    await expect(store.isDeviceOnline(deviceId)).resolves.toBe(false);

    await store.markBusy(deviceId, DESKTOP_BUSY_LONG_TTL_MS);
    await expect(store.isDeviceOnline(deviceId)).resolves.toBe(true);

    advance(DESKTOP_BUSY_LONG_TTL_MS);
    await expect(store.isDeviceOnline(deviceId)).resolves.toBe(false);
  });

  it('marks the device busy when the client takes a command', async () => {
    const { store, redis, advance } = createStore();
    await store.enqueue({ deviceId, command: { action: 'click', ref: 'e12' } });
    advance(DESKTOP_HEARTBEAT_TTL_SECONDS * 1000);

    await store.waitForCommand({ deviceId, timeoutMs: 5_000 });

    expect(await redis.get(`desktop-command:v1:busy:${deviceId}`)).toBe('1');
    await expect(store.isDeviceOnline(deviceId)).resolves.toBe(true);
  });

  it('clears the busy marker once a result arrives', async () => {
    const { store, advance } = createStore();
    await register(store);
    advance(DESKTOP_HEARTBEAT_TTL_SECONDS * 1000);
    await store.markBusy(deviceId, DESKTOP_BUSY_LONG_TTL_MS);

    await store.clearBusy(deviceId);

    await expect(store.isDeviceOnline(deviceId)).resolves.toBe(false);
  });

  it('removes the busy marker on revoke', async () => {
    const { store, redis } = createStore();
    await register(store);
    await store.markBusy(deviceId, DESKTOP_BUSY_LONG_TTL_MS);

    await store.revoke({ deviceId, tmbId: 'tmb-1' });

    expect(await redis.get(`desktop-command:v1:busy:${deviceId}`)).toBeNull();
  });

  it('uses a long busy window for click and upload and a short one otherwise', () => {
    expect(getDesktopCommandBusyTtlMs('click')).toBe(DESKTOP_BUSY_LONG_TTL_MS);
    expect(getDesktopCommandBusyTtlMs('upload')).toBe(DESKTOP_BUSY_LONG_TTL_MS);
    expect(getDesktopCommandBusyTtlMs('read')).toBe(DESKTOP_BUSY_TTL_MS);
    expect(getDesktopCommandBusyTtlMs(undefined)).toBe(DESKTOP_BUSY_TTL_MS);
  });
});

describe('desktop command revocation', () => {
  it('removes the device, token, owner mapping and heartbeat on revoke', async () => {
    const { store, redis } = createStore();
    const { token } = await register(store);
    await store.enqueue({ deviceId, command: { action: 'browser.snapshot' } });

    await expect(store.revoke({ deviceId, tmbId: 'tmb-1' })).resolves.toBe(true);

    expect(await redis.get(`desktop-command:v1:device:${deviceId}`)).toBeNull();
    expect(await redis.get('desktop-command:v1:owner:tmb-1')).toBeNull();
    expect(await redis.get(`desktop-command:v1:hb:${deviceId}`)).toBeNull();
    expect(await redis.get(`desktop-command:v1:queue:${deviceId}`)).toBeNull();
    expect(await store.isDeviceOnline(deviceId)).toBe(false);
    await expect(
      store.authenticate({ deviceId, authorization: bearer(token) })
    ).rejects.toThrow(ERROR_ENUM.unAuthorization);
  });

  it('rejects revocation by another member without deleting the device', async () => {
    const { store } = createStore();
    const { token } = await register(store);

    await expect(store.revoke({ deviceId, tmbId: 'tmb-other' })).resolves.toBe(false);

    await expect(
      store.authenticate({ deviceId, authorization: bearer(token) })
    ).resolves.toMatchObject({ tmbId: 'tmb-1' });
  });

  it('returns false for an unknown device', async () => {
    const { store } = createStore();

    await expect(store.revoke({ deviceId, tmbId: 'tmb-1' })).resolves.toBe(false);
  });
});

describe('desktop command queue', () => {
  it('enqueues and dequeues commands in FIFO order', async () => {
    const { store, redis } = createStore();

    const first = await store.enqueue({
      deviceId,
      command: { action: 'browser.snapshot' }
    });
    const second = await store.enqueue({
      deviceId,
      command: { action: 'browser.click', ref: 'e1' }
    });

    expect(first.id).not.toBe(second.id);
    await expect(store.dequeue(deviceId)).resolves.toEqual(first);
    await expect(store.dequeue(deviceId)).resolves.toEqual(second);
    await expect(store.dequeue(deviceId)).resolves.toBeUndefined();
    expect(await redis.get(`desktop-command:v1:queue:${deviceId}`)).toBeNull();
  });

  it('sets the queue ttl when a command is enqueued', async () => {
    const { store, redis } = createStore();

    await store.enqueue({ deviceId, command: { action: 'browser.snapshot' } });

    expect(redis.setCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: `desktop-command:v1:queue:${deviceId}`,
          ttlMs: DESKTOP_QUEUE_TTL_MS
        })
      ])
    );
  });

  it('returns queued commands without waiting', async () => {
    const { store } = createStore();
    const envelope = await store.enqueue({
      deviceId,
      command: { action: 'browser.snapshot' }
    });

    await expect(store.waitForCommand({ deviceId, timeoutMs: 5_000 })).resolves.toEqual(
      envelope
    );
  });

  it('picks up a command that arrives during the long poll', async () => {
    const { store } = createStore();
    let enqueued = false;
    const originalSleep = (store as any).sleep as (ms: number) => Promise<void>;
    (store as any).sleep = async (ms: number) => {
      await originalSleep(ms);
      if (!enqueued) {
        enqueued = true;
        await store.enqueue({ deviceId, command: { action: 'browser.snapshot' } });
      }
    };

    const command = await store.waitForCommand({ deviceId, timeoutMs: 5_000 });

    expect(command?.command).toEqual({ action: 'browser.snapshot' });
    expect(enqueued).toBe(true);
  });

  it('stops long polling at the timeout and returns undefined', async () => {
    const { store } = createStore();
    const sleep = vi.spyOn(store as any, 'sleep');

    await expect(store.waitForCommand({ deviceId, timeoutMs: 1_500 })).resolves.toBeUndefined();
    expect(sleep).toHaveBeenCalledTimes(3);
  });
});

describe('desktop command result', () => {
  it('stores the first result and ignores duplicates', async () => {
    const { store } = createStore();
    const envelope = await store.enqueue({
      deviceId,
      command: { action: 'browser.snapshot' }
    });
    const result = { ok: true, changed: true };

    await expect(store.saveResult({ commandId: envelope.id, result })).resolves.toBe(true);
    await expect(
      store.saveResult({ commandId: envelope.id, result: { ok: false } })
    ).resolves.toBe(false);
    await expect(store.getResult(envelope.id)).resolves.toEqual(result);
  });

  it('expires results after the result ttl', async () => {
    const { store, advance } = createStore();
    const envelope = await store.enqueue({
      deviceId,
      command: { action: 'browser.snapshot' }
    });
    await store.saveResult({ commandId: envelope.id, result: { ok: true } });

    advance(DESKTOP_RESULT_TTL_SECONDS * 1000);

    await expect(store.getResult(envelope.id)).resolves.toBeUndefined();
  });
});
