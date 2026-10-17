// 鲁港通 - 办事浏览器面板宽度计算（对齐 Qoder 右侧面板实测：窗口宽减保留区）
import {
  BUILTIN_BROWSER_PANEL_MAX_WIDTH,
  BUILTIN_BROWSER_PANEL_MIN_WIDTH,
  BUILTIN_BROWSER_PANEL_RESERVED_WIDTH
} from './constant';

/** 面板可拖拽的最大宽度：窗口宽 − 保留区（侧栏 + 最小聊天区），不超过云端视口上限 */
export const calcBuiltinBrowserPanelMaxWidth = (windowWidth: number) => {
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) {
    return BUILTIN_BROWSER_PANEL_MAX_WIDTH;
  }
  return Math.min(
    BUILTIN_BROWSER_PANEL_MAX_WIDTH,
    Math.max(
      BUILTIN_BROWSER_PANEL_MIN_WIDTH,
      Math.round(windowWidth - BUILTIN_BROWSER_PANEL_RESERVED_WIDTH)
    )
  );
};

/** 把面板宽度收敛到 [最小宽度, 当前窗口下的最大宽度] */
export const clampBuiltinBrowserPanelWidth = (width: number, windowWidth: number) => {
  const max = calcBuiltinBrowserPanelMaxWidth(windowWidth);
  return Math.min(max, Math.max(BUILTIN_BROWSER_PANEL_MIN_WIDTH, Math.round(width)));
};
