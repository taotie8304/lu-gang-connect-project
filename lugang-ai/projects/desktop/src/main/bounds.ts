// 鲁港通 - 把线上页面里的 CSS 矩形换算成 WebContentsView 需要的 DIP 矩形
import type { CssRect, DipRect } from '../shared/geometry';

export type { DipRect };

export const cssRectToDip = (
  rect: CssRect,
  zoomFactor: number,
  content: { width: number; height: number }
): DipRect => {
  const zoom = Number.isFinite(zoomFactor) && zoomFactor > 0 ? zoomFactor : 1;
  const x = Math.max(0, Math.round(rect.x * zoom));
  const y = Math.max(0, Math.round(rect.y * zoom));
  const right = Math.min(content.width, Math.round((rect.x + rect.width) * zoom));
  const bottom = Math.min(content.height, Math.round((rect.y + rect.height) * zoom));
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y)
  };
};
