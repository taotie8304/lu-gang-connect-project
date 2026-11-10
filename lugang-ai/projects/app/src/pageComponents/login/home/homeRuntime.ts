// 鲁港通 - 首页统计计数的一次性播放标记：语言切换导致页面重挂载时不重播
let statsAnimated = false;

export const hasStatsAnimated = () => statsAnimated;

export const markStatsAnimated = () => {
  statsAnimated = true;
};
