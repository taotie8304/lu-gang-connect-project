// 鲁港通 - 首页视差、滚动与计数的纯计算，便于单测覆盖

export type RectLike = { top: number; height: number };
export type BillingMode = 'month' | 'year';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
// 鲁港通 - 消除 -0 并保留一位小数，避免样式里出现浮点长尾
const normalizeShift = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return rounded === 0 ? 0 : rounded;
};

/** 鲁港通 - 阅读进度，限制在 0~1；页面不足一屏时返回 0 */
export const calcScrollProgress = (
  scrollY: number,
  scrollHeight: number,
  viewportHeight: number
) => {
  const total = scrollHeight - viewportHeight;
  if (total <= 0) return 0;
  return clamp(scrollY / total, 0, 1);
};

/** 鲁港通 - 全局装饰元素的视差位移 */
export const calcScrollOffset = (scrollY: number, speed: number) =>
  normalizeShift(scrollY * speed);

/** 鲁港通 - 相对视口中心的有界漂移，避免长页面漂出屏幕 */
export const calcDriftOffset = (rect: RectLike, viewportHeight: number, speed: number) => {
  const center = rect.top + rect.height / 2;
  const relative = clamp((center - viewportHeight / 2) / viewportHeight, -1, 1);
  return normalizeShift(relative * speed * viewportHeight);
};

/** 鲁港通 - 首屏元素直接显示，避免进入页面时先隐藏再淡入 */
export const shouldRevealImmediately = (top: number, viewportHeight: number) =>
  top < viewportHeight * 0.92;

/** 鲁港通 - 办理流程进度线宽度（百分比） */
export const calcFlowProgress = (index: number, total: number) =>
  clamp(((index + 1) / Math.max(total, 1)) * 100, 0, 100);

/** 鲁港通 - 统计数字千分位显示 */
export const formatCount = (value: number) => Math.round(value).toLocaleString('en-US');

/** 鲁港通 - 月付/年付切换时取对应价格 */
export const resolveBillingAmount = (month: number, year: number, mode: BillingMode) =>
  mode === 'year' ? year : month;
