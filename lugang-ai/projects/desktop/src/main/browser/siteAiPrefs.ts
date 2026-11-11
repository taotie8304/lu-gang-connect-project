// 鲁港通 - 站点级 AI 权限：按 origin 记住允许/仅读取/禁止，默认全放开，仅由用户主动收紧
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DesktopSiteAiMode } from '../../shared/ipc';

export const SITE_AI_MODES: DesktopSiteAiMode[] = ['allow', 'read_only', 'blocked'];

export const SITE_AI_MODE_LABELS: Record<DesktopSiteAiMode, string> = {
  allow: '允许操作',
  read_only: '仅读取',
  blocked: '禁止 AI'
};

export const SITE_AI_REJECT_MESSAGES = {
  read_only:
    '本站点已设为「仅读取」，AI 只能查看，不能点击或填写。需要 AI 操作时，请在地址栏右侧的盾牌徽标或「⋯ → 本站点 AI 权限」中改回「允许操作」。',
  blocked:
    '本站点已设为「禁止 AI 操作」，AI 不能打开或读取。你可以手动访问；需要 AI 操作时请改回「允许操作」。'
} as const;

/** 鲁港通 - 只影响网页动作；本机文件类动作与网页无关，永远放行 */
const LOCAL_ONLY_ACTIONS = new Set([
  'generate_file',
  'open_form',
  'fill_form',
  'open_document',
  'edit_document',
  'fill_pdf'
]);

// 鲁港通 - 「仅读取」允许阅读与导航；滚动属于阅读的一部分
const READ_ONLY_ACTIONS = new Set(['navigate', 'read', 'scroll', 'stop']);

export type SiteAiDecision =
  | { allowed: true }
  | { allowed: false; reason: 'read_only' | 'blocked' };

export const normalizeSiteOrigin = (input: string): string | null => {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.origin === 'null') return null;
    return url.origin;
  } catch {
    return null;
  }
};

export const evaluateSiteAiMode = (mode: DesktopSiteAiMode, action: string): SiteAiDecision => {
  if (mode === 'allow') return { allowed: true };
  if (LOCAL_ONLY_ACTIONS.has(action)) return { allowed: true };
  if (mode === 'blocked') {
    return action === 'stop' ? { allowed: true } : { allowed: false, reason: 'blocked' };
  }
  return READ_ONLY_ACTIONS.has(action)
    ? { allowed: true }
    : { allowed: false, reason: 'read_only' };
};

export const parseSiteAiPrefStore = (raw: unknown): Record<string, DesktopSiteAiMode> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, DesktopSiteAiMode> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value !== 'allow' && value !== 'read_only' && value !== 'blocked') continue;
    const origin = normalizeSiteOrigin(key);
    if (!origin || origin !== key) continue;
    result[origin] = value;
  }
  return result;
};

export const loadSiteAiPrefStore = (path: string): Record<string, DesktopSiteAiMode> => {
  try {
    return parseSiteAiPrefStore(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return {};
  }
};

export const saveSiteAiPrefStore = (path: string, store: Record<string, DesktopSiteAiMode>) => {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(store, null, 2), 'utf8');
  } catch {
    // 鲁港通 - 写入失败时本次会话仍按内存档位生效
  }
};
