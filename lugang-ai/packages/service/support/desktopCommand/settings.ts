// 鲁港通 - 桌面 AI 操控远程开关（纯逻辑）：
// 管理员保存的开关存数据库后下一次提问即生效；未保存过时回落环境变量。
import type {
  DesktopSwitchMode,
  DesktopSwitchState
} from '@fastgpt/global/support/desktopCommand/type';
import {
  DESKTOP_BROWSER_ENABLED_ENV,
  isDesktopBrowserEnabledForUser,
  type DesktopBrowserIdentity
} from './browserOperation';

export const DESKTOP_SWITCH_KEY = 'browser-switch';
export const DESKTOP_SWITCH_ACCOUNT_LIMIT = 100;

export type DesktopSwitchConfig = {
  mode: DesktopSwitchMode;
  accounts: string[];
};

export type DesktopSwitchRecord = DesktopSwitchConfig & {
  updatedAt?: Date | number;
  updatedBy?: string;
};

export type DesktopSwitchReader = () => Promise<DesktopSwitchRecord | undefined>;

const DISABLED_VALUES = ['off', 'false', '0', 'no', 'disabled'];

const loadDesktopSwitch: DesktopSwitchReader = async () => {
  const { readDesktopSwitch } = await import('./settingsStore');
  return readDesktopSwitch();
};

/** 名单统一小写去重，界面回显与命中判断保持同一口径。 */
export const normalizeDesktopSwitchAccounts = (accounts: readonly string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const account of accounts) {
    const value = account.trim().toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= DESKTOP_SWITCH_ACCOUNT_LIMIT) break;
  }
  return result;
};

/** 数据库开关映射成现有纯函数认识的 raw 字符串。 */
export const desktopSwitchToRaw = (config: DesktopSwitchConfig): string =>
  config.mode === 'list' ? config.accounts.join(',') : config.mode;

/** 旧环境变量反向解析，供管理页展示当前实际生效的开关。 */
export const desktopRawToSwitch = (raw?: string): DesktopSwitchConfig => {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value || DISABLED_VALUES.includes(value)) return { mode: 'off', accounts: [] };
  if (value === 'all' || value === '*') return { mode: 'all', accounts: [] };
  return { mode: 'list', accounts: normalizeDesktopSwitchAccounts(value.split(',')) };
};

export const buildDesktopSwitchConfig = ({
  mode,
  accounts = []
}: {
  mode: DesktopSwitchMode;
  accounts?: string[];
}): DesktopSwitchConfig => ({
  mode,
  accounts: mode === 'list' ? normalizeDesktopSwitchAccounts(accounts) : []
});

export const desktopSwitchToState = ({
  record,
  envRaw = process.env[DESKTOP_BROWSER_ENABLED_ENV]
}: {
  record?: DesktopSwitchRecord;
  envRaw?: string;
}): DesktopSwitchState => {
  if (!record) {
    return { ...desktopRawToSwitch(envRaw), source: 'env' };
  }

  return {
    mode: record.mode,
    accounts: record.mode === 'list' ? normalizeDesktopSwitchAccounts(record.accounts) : [],
    source: 'database',
    ...(record.updatedAt !== undefined
      ? { updatedAt: new Date(record.updatedAt).getTime() }
      : {}),
    ...(record.updatedBy ? { updatedBy: record.updatedBy } : {})
  };
};

/**
 * 每次请求读一次开关文档；读库失败时回落环境变量，避免数据库抖动导致功能不可用。
 * root 不查库、始终可用，防止管理员把自己关在门外。
 */
export const isDesktopBrowserEnabledForUserAsync = async (
  identity: DesktopBrowserIdentity & { username?: string },
  {
    read = loadDesktopSwitch,
    envRaw = process.env[DESKTOP_BROWSER_ENABLED_ENV]
  }: { read?: DesktopSwitchReader; envRaw?: string } = {}
): Promise<boolean> => {
  if ((identity.username ?? '').trim().toLowerCase() === 'root') return true;

  let record: DesktopSwitchRecord | undefined;
  try {
    record = await read();
  } catch {
    record = undefined;
  }

  return isDesktopBrowserEnabledForUser(identity, record ? desktopSwitchToRaw(record) : envRaw);
};
