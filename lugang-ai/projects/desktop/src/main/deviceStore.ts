// 鲁港通 - 桌面设备本地存储：deviceId 持久化，设备令牌用 safeStorage 加密后落盘
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type SafeStorageLike = {
  isEncryptionAvailable: () => boolean;
  encryptString: (value: string) => Buffer;
  decryptString: (buffer: Buffer) => string;
};

type PersistedRecord = {
  deviceId: string;
  token?: string;
};

export type DeviceStoreOptions = {
  filePath: string;
  safeStorage: SafeStorageLike;
  log?: (message: string, error?: unknown) => void;
};

const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

const readRecord = (filePath: string): Partial<PersistedRecord> => {
  try {
    if (!existsSync(filePath)) return {};
    const value = JSON.parse(readFileSync(filePath, 'utf8'));
    return value && typeof value === 'object' ? (value as Partial<PersistedRecord>) : {};
  } catch {
    return {};
  }
};

export type DeviceStore = {
  deviceId: string;
  loadToken: () => string | undefined;
  saveToken: (token: string) => void;
  clearToken: () => void;
};

/**
 * 设备存储：
 * - deviceId 首次启动生成后持久化，重装前保持不变；
 * - 令牌只在 safeStorage 可用时加密落盘，否则仅保留在内存中，绝不写明文。
 */
export const createDeviceStore = ({ filePath, safeStorage, log }: DeviceStoreOptions): DeviceStore => {
  const record = readRecord(filePath);
  const deviceId =
    typeof record.deviceId === 'string' && DEVICE_ID_PATTERN.test(record.deviceId)
      ? record.deviceId
      : randomUUID();

  let token: string | undefined;
  if (typeof record.token === 'string' && record.token) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        token = safeStorage.decryptString(Buffer.from(record.token, 'base64'));
      }
    } catch (error) {
      log?.('device token decrypt failed', error);
    }
  }

  const persist = () => {
    let encryptedToken: string | undefined;
    try {
      if (token && safeStorage.isEncryptionAvailable()) {
        encryptedToken = safeStorage.encryptString(token).toString('base64');
      }
    } catch (error) {
      log?.('device token encrypt failed', error);
    }

    try {
      mkdirSync(dirname(filePath), { recursive: true });
      const next: PersistedRecord = {
        deviceId,
        ...(encryptedToken ? { token: encryptedToken } : {})
      };
      writeFileSync(filePath, JSON.stringify(next), 'utf8');
    } catch (error) {
      log?.('device store write failed', error);
    }
  };

  // 首次启动创建记录，并清掉无法解密的旧令牌
  persist();

  return {
    deviceId,
    loadToken: () => token,
    saveToken: (nextToken) => {
      token = nextToken;
      persist();
    },
    clearToken: () => {
      token = undefined;
      persist();
    }
  };
};
