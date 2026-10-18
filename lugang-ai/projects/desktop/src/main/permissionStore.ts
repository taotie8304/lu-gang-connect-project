// 鲁港通 - 站点权限记忆：按「来源|权限」持久化，默认拒绝
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type PermissionDecision = 'allow' | 'deny';

export const permissionKey = (origin: string, permission: string) => `${origin}|${permission}`;

export const parsePermissionStore = (raw: unknown): Record<string, PermissionDecision> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, PermissionDecision> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === 'allow' || value === 'deny') result[key] = value;
  }
  return result;
};

export const loadPermissionStore = (path: string): Record<string, PermissionDecision> => {
  try {
    return parsePermissionStore(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return {};
  }
};

export const savePermissionStore = (path: string, store: Record<string, PermissionDecision>) => {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(store, null, 2), 'utf8');
  } catch {
    // 鲁港通 - 写入失败时本次会话仍按内存决策生效
  }
};
