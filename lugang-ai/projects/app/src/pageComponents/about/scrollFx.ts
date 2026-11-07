// 鲁港通 - 关于页视差与渐入的纯计算，便于单测覆盖

export type RectLike = { top: number; height: number };

/** 鲁港通 - 元素中心相对视口中心的偏移量乘以视差系数 */
export const calcParallaxOffset = (rect: RectLike, viewportHeight: number, factor: number) =>
  (rect.top + rect.height / 2 - viewportHeight / 2) * factor;

/** 鲁港通 - 阅读进度，限制在 0~1；页面不足一屏时返回 0 */
export const calcScrollProgress = (scrollY: number, scrollHeight: number, viewportHeight: number) => {
  const total = scrollHeight - viewportHeight;
  if (total <= 0) return 0;
  return Math.min(Math.max(scrollY / total, 0), 1);
};

/** 鲁港通 - 首屏元素直接显示，避免进入页面时先隐藏再淡入 */
export const shouldRevealImmediately = (top: number, viewportHeight: number) =>
  top < viewportHeight * 0.92;
