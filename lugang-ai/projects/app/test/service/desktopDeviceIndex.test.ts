import { describe, expect, it } from 'vitest';
import {
  DESKTOP_DEVICE_INDEX_LIMIT,
  DESKTOP_HEARTBEAT_TTL_SECONDS,
  DESKTOP_TOKEN_TTL_MS
} from '@fastgpt/service/support/desktopCommand/constant';
import type { DesktopCommandStore } from '@fastgpt/service/support/desktopCommand/store';
import { createTestStore } from './desktopTestStore';

const register = (store: DesktopCommandStore, overrides: Record<string, string> = {}) =>
  store.register({
    deviceId: 'device_12345678',
    deviceName: '办公电脑',
    appVersion: '0.8.9',
    tmbId: 'tmb-1',
    userId: 'user-1',
    teamId: 'team-1',
    ...overrides
  });

describe('desktop device index', () => {
  it('lists a registered device with online state and without the token hash', async () => {
    const { store } = createTestStore();
    await register(store);

    const devices = await store.listDevices({ tmbId: 'tmb-1' });

    expect(devices).toHaveLength(1);
    expect(devices[0]).toEqual({
      deviceId: 'device_12345678',
      deviceName: '办公电脑',
      appVersion: '0.8.9',
      tmbId: 'tmb-1',
      online: true,
      registeredAt: 1000
    });
    expect(JSON.stringify(devices)).not.toContain('tokenHash');
  });

  it('keeps one entry per device and puts the latest registration first', async () => {
    const { store, advance } = createTestStore();
    await register(store, { deviceId: 'device_11111111', deviceName: '旧电脑' });
    advance(5_000);
    await register(store, { deviceId: 'device_22222222', deviceName: '新电脑' });
    advance(5_000);
    await register(store, { deviceId: 'device_11111111', deviceName: '换名电脑' });

    const devices = await store.listDevices();

    expect(devices.map((device) => device.deviceId)).toEqual([
      'device_11111111',
      'device_22222222'
    ]);
    expect(devices[0].deviceName).toBe('换名电脑');
    expect(devices[0].registeredAt).toBe(11_000);
  });

  it('filters the list by owner when a tmbId is given', async () => {
    const { store } = createTestStore();
    await register(store, { deviceId: 'device_11111111', tmbId: 'tmb-1' });
    await register(store, {
      deviceId: 'device_22222222',
      tmbId: 'tmb-2',
      userId: 'user-2'
    });

    const own = await store.listDevices({ tmbId: 'tmb-1' });
    const all = await store.listDevices();

    expect(own.map((device) => device.deviceId)).toEqual(['device_11111111']);
    expect(all).toHaveLength(2);
  });

  it('drops devices whose records have expired even when the index is still alive', async () => {
    const { store, advance } = createTestStore();
    await register(store, { deviceId: 'device_11111111', tmbId: 'tmb-1' });
    advance(DESKTOP_TOKEN_TTL_MS / 2);
    // 第二台设备刷新索引 TTL，第一台设备记录随时间先过期
    await register(store, { deviceId: 'device_22222222', tmbId: 'tmb-2', userId: 'user-2' });
    advance(DESKTOP_TOKEN_TTL_MS / 2 + 1);

    const devices = await store.listDevices();

    expect(devices.map((device) => device.deviceId)).toEqual(['device_22222222']);
  });

  it('marks a device offline once its heartbeat expires', async () => {
    const { store, advance } = createTestStore();
    await register(store);

    advance(DESKTOP_HEARTBEAT_TTL_SECONDS * 1000 + 1);

    const devices = await store.listDevices({ tmbId: 'tmb-1' });
    expect(devices[0].online).toBe(false);
  });

  it('removes the device from the index after revoke', async () => {
    const { store } = createTestStore();
    await register(store);

    await expect(store.revoke({ deviceId: 'device_12345678', tmbId: 'tmb-1' })).resolves.toBe(
      true
    );

    await expect(store.listDevices()).resolves.toEqual([]);
  });

  it('refuses a member revoking another member device', async () => {
    const { store } = createTestStore();
    await register(store, { tmbId: 'tmb-1' });

    await expect(
      store.revoke({ deviceId: 'device_12345678', tmbId: 'tmb-2' })
    ).resolves.toBe(false);
    expect(await store.listDevices()).toHaveLength(1);
  });

  it('lets an admin revoke any device by id without an owner check', async () => {
    const { store } = createTestStore();
    await register(store, { tmbId: 'tmb-1' });

    await expect(store.revoke({ deviceId: 'device_12345678' })).resolves.toBe(true);
    await expect(store.listDevices()).resolves.toEqual([]);
    await expect(store.getDeviceByOwner('tmb-1')).resolves.toBeUndefined();
  });

  it('caps the index at the configured limit', async () => {
    const { store } = createTestStore();

    for (let index = 0; index <= DESKTOP_DEVICE_INDEX_LIMIT; index += 1) {
      await register(store, { deviceId: `device_${String(index).padStart(8, '0')}` });
    }

    const devices = await store.listDevices();
    expect(devices).toHaveLength(DESKTOP_DEVICE_INDEX_LIMIT);
    expect(devices[0].deviceId).toBe(`device_${String(DESKTOP_DEVICE_INDEX_LIMIT).padStart(8, '0')}`);
  });

  it('ignores a corrupted index payload', async () => {
    const { store, redis } = createTestStore();
    await register(store);
    await redis.set({ key: 'desktop-command:v1:device-index', value: '{not-json' });

    await expect(store.listDevices()).resolves.toEqual([]);
  });
});
