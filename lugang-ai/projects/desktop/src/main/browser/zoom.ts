// 鲁港通 - 页面缩放档位与按站点记忆：与浏览数据清理解耦，清理 Cookie 不影响缩放
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const ZOOM_LEVELS = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200] as const;

export const DEFAULT_ZOOM_PERCENT = 100;

const isHttpOrigin = (value: string) =>
  value.startsWith('http://') || value.startsWith('https://');

export const clampZoomPercent = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_ZOOM_PERCENT;
  return Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], Math.max(ZOOM_LEVELS[0], Math.round(value)));
};

/** 任意百分比吸附到最近档位：页内 Ctrl+滚轮与快捷键共用同一组档位 */
export const normalizeZoomPercent = (value: number): number => {
  const clamped = clampZoomPercent(value);
  let best: number = ZOOM_LEVELS[0];
  for (const level of ZOOM_LEVELS) {
    if (Math.abs(level - clamped) < Math.abs(best - clamped)) best = level;
  }
  return best;
};

export const stepZoomPercent = (current: number, direction: 'in' | 'out'): number => {
  const value = normalizeZoomPercent(current);
  if (direction === 'in') {
    const next = ZOOM_LEVELS.find((level) => level > value);
    return next ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  }
  const lower = [...ZOOM_LEVELS].reverse().find((level) => level < value);
  return lower ?? ZOOM_LEVELS[0];
};

export const parseZoomStore = (raw: unknown): Record<string, number> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, number> = {};
  for (const [origin, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isHttpOrigin(origin) || typeof value !== 'number') continue;
    result[origin] = normalizeZoomPercent(value);
  }
  return result;
};

export const loadZoomStore = (path: string): Record<string, number> => {
  try {
    return parseZoomStore(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return {};
  }
};

export const saveZoomStore = (path: string, store: Record<string, number>) => {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(store, null, 2), 'utf8');
  } catch {
    // 鲁港通 - 写入失败时本次会话仍按内存档位生效
  }
};
