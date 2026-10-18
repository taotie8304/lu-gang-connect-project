// 鲁港通 - 主窗口位置尺寸记忆：非法值回落默认，移出屏幕的坐标不恢复
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type WindowState = {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
};

export type DisplayWorkArea = { x: number; y: number; width: number; height: number };

export const DEFAULT_WINDOW_STATE: WindowState = { width: 1440, height: 900, isMaximized: false };
export const MIN_WINDOW_WIDTH = 1024;
export const MIN_WINDOW_HEIGHT = 700;
const MIN_VISIBLE_SIZE = 80;
const WINDOW_STATE_FILE = 'window-state.json';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const normalizeWindowState = (raw: unknown): WindowState => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_WINDOW_STATE };
  }
  const source = raw as Record<string, unknown>;
  const width = isFiniteNumber(source.width)
    ? Math.max(MIN_WINDOW_WIDTH, Math.round(source.width))
    : DEFAULT_WINDOW_STATE.width;
  const height = isFiniteNumber(source.height)
    ? Math.max(MIN_WINDOW_HEIGHT, Math.round(source.height))
    : DEFAULT_WINDOW_STATE.height;
  return {
    width,
    height,
    x: isFiniteNumber(source.x) ? Math.round(source.x) : undefined,
    y: isFiniteNumber(source.y) ? Math.round(source.y) : undefined,
    isMaximized: source.isMaximized === true
  };
};

export const isWindowStateVisible = (state: WindowState, displays: DisplayWorkArea[]): boolean => {
  const { x, y } = state;
  if (x === undefined || y === undefined) return true;
  return displays.some((area) => {
    const overlapWidth = Math.min(x + state.width, area.x + area.width) - Math.max(x, area.x);
    const overlapHeight = Math.min(y + state.height, area.y + area.height) - Math.max(y, area.y);
    return overlapWidth >= MIN_VISIBLE_SIZE && overlapHeight >= MIN_VISIBLE_SIZE;
  });
};

export const loadWindowState = (userDataDir: string): WindowState => {
  try {
    const raw = JSON.parse(readFileSync(join(userDataDir, WINDOW_STATE_FILE), 'utf8'));
    return normalizeWindowState(raw);
  } catch {
    return { ...DEFAULT_WINDOW_STATE };
  }
};

export const saveWindowState = (userDataDir: string, state: WindowState) => {
  try {
    mkdirSync(userDataDir, { recursive: true });
    writeFileSync(
      join(userDataDir, WINDOW_STATE_FILE),
      JSON.stringify(normalizeWindowState(state), null, 2),
      'utf8'
    );
  } catch {
    // 写入失败不影响使用，下次启动回落默认尺寸
  }
};
