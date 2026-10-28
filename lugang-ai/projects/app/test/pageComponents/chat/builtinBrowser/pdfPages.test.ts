import { describe, expect, it } from 'vitest';
import {
  PDF_PAGE_LIMIT,
  resolvePdfPageCount,
  resolvePdfViewportScale
} from '@/pageComponents/chat/builtinBrowser/pdfPages';

describe('resolvePdfPageCount', () => {
  it('超过上限时只渲染前若干页', () => {
    expect(PDF_PAGE_LIMIT).toBeGreaterThan(0);
    expect(resolvePdfPageCount(PDF_PAGE_LIMIT + 15)).toBe(PDF_PAGE_LIMIT);
  });

  it('未超过上限按总页数渲染', () => {
    expect(resolvePdfPageCount(12)).toBe(12);
    expect(resolvePdfPageCount(1)).toBe(1);
  });

  it('非法页数按 0 处理', () => {
    expect(resolvePdfPageCount(0)).toBe(0);
    expect(resolvePdfPageCount(-3)).toBe(0);
    expect(resolvePdfPageCount(Number.NaN)).toBe(0);
  });
});

describe('resolvePdfViewportScale', () => {
  it('按容器宽度放大并乘设备像素比', () => {
    expect(
      resolvePdfViewportScale({ containerWidth: 600, pageWidth: 400, devicePixelRatio: 2 })
    ).toBe(3);
  });

  it('放大倍率设上限，避免超大画布', () => {
    expect(
      resolvePdfViewportScale({ containerWidth: 2400, pageWidth: 400, devicePixelRatio: 2 })
    ).toBe(3);
  });

  it('窄容器时按比例缩小', () => {
    expect(
      resolvePdfViewportScale({ containerWidth: 400, pageWidth: 800, devicePixelRatio: 1 })
    ).toBe(0.5);
  });

  it('设备像素比限制在 1 到 2 之间', () => {
    expect(
      resolvePdfViewportScale({ containerWidth: 600, pageWidth: 600, devicePixelRatio: 0.5 })
    ).toBe(1);
    expect(
      resolvePdfViewportScale({ containerWidth: 600, pageWidth: 600, devicePixelRatio: 3 })
    ).toBe(2);
  });

  it('容器或页面宽度未知时保持 1 倍', () => {
    expect(
      resolvePdfViewportScale({ containerWidth: 0, pageWidth: 400, devicePixelRatio: 1 })
    ).toBe(1);
    expect(
      resolvePdfViewportScale({ containerWidth: 600, pageWidth: 0, devicePixelRatio: 1 })
    ).toBe(1);
  });
});
