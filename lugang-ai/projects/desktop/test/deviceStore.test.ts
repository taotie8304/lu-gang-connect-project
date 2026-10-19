import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDeviceStore, type SafeStorageLike } from '../src/main/deviceStore';

const dirs: string[] = [];

const createFile = () => {
  const dir = mkdtempSync(join(tmpdir(), 'lugang-device-store-'));
  dirs.push(dir);
  return join(dir, 'device.json');
};

const createSafeStorage = (available = true): SafeStorageLike => ({
  isEncryptionAvailable: () => available,
  encryptString: (value) => Buffer.from(`enc:${value}`, 'utf8'),
  decryptString: (buffer) => buffer.toString('utf8').replace(/^enc:/, '')
});

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('桌面设备本地存储', () => {
  it('persists a generated device id across instances', () => {
    const filePath = createFile();
    const first = createDeviceStore({ filePath, safeStorage: createSafeStorage() });
    const second = createDeviceStore({ filePath, safeStorage: createSafeStorage() });

    expect(first.deviceId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(second.deviceId).toBe(first.deviceId);
  });

  it('encrypts the token before writing it to disk and decrypts it on load', () => {
    const filePath = createFile();
    const store = createDeviceStore({ filePath, safeStorage: createSafeStorage() });

    store.saveToken('lgd_secret-token');

    const onDisk = readFileSync(filePath, 'utf8');
    expect(onDisk).not.toContain('lgd_secret-token');
    const reloaded = createDeviceStore({ filePath, safeStorage: createSafeStorage() });
    expect(reloaded.loadToken()).toBe('lgd_secret-token');
  });

  it('keeps the token in memory only when encryption is unavailable', () => {
    const filePath = createFile();
    const store = createDeviceStore({
      filePath,
      safeStorage: createSafeStorage(false)
    });

    store.saveToken('lgd_memory-only');

    expect(store.loadToken()).toBe('lgd_memory-only');
    const onDisk = readFileSync(filePath, 'utf8');
    expect(onDisk).not.toContain('lgd_memory-only');
    const reloaded = createDeviceStore({
      filePath,
      safeStorage: createSafeStorage(false)
    });
    expect(reloaded.loadToken()).toBeUndefined();
  });

  it('clears the token from disk', () => {
    const filePath = createFile();
    const store = createDeviceStore({ filePath, safeStorage: createSafeStorage() });
    store.saveToken('lgd_secret-token');

    store.clearToken();

    expect(store.loadToken()).toBeUndefined();
    const reloaded = createDeviceStore({ filePath, safeStorage: createSafeStorage() });
    expect(reloaded.loadToken()).toBeUndefined();
    expect(reloaded.deviceId).toBe(store.deviceId);
  });
});
