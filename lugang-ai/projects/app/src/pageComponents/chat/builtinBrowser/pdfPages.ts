// 鲁港通 - PDF 页内预览纯计算：限页数与按容器宽度、设备像素比换算渲染倍率
export const PDF_PAGE_LIMIT = 30;
export const PDF_MAX_RENDER_SCALE = 3;

export const resolvePdfPageCount = (totalPages: number): number => {
  if (!Number.isFinite(totalPages) || totalPages <= 0) return 0;
  return Math.min(Math.floor(totalPages), PDF_PAGE_LIMIT);
};

// 鲁港通 - canvas 按 CSS 宽度等比放大，再乘设备像素比保证清晰度，超出上限按上限渲染
export const resolvePdfViewportScale = (input: {
  containerWidth: number;
  pageWidth: number;
  devicePixelRatio?: number;
}): number => {
  const { containerWidth, pageWidth } = input;
  if (!(containerWidth > 0) || !(pageWidth > 0)) return 1;
  const dpr = Math.min(Math.max(input.devicePixelRatio || 1, 1), 2);
  return Math.min(Math.max((containerWidth / pageWidth) * dpr, 0.1), PDF_MAX_RENDER_SCALE);
};
