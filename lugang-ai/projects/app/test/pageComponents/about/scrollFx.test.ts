import { describe, expect, it } from 'vitest';
import {
  calcParallaxOffset,
  calcScrollProgress,
  shouldRevealImmediately
} from '@/pageComponents/about/scrollFx';

describe('about 视差辅助函数', () => {
  it('元素中心与视口中心重合时位移为零', () => {
    expect(calcParallaxOffset({ top: 400, height: 200 }, 1000, 0.1)).toBe(0);
  });

  it('元素位于视口下方时按系数产生正位移', () => {
    expect(calcParallaxOffset({ top: 700, height: 200 }, 1000, 0.1)).toBe(30);
  });

  it('负系数会反向位移', () => {
    expect(calcParallaxOffset({ top: 700, height: 200 }, 1000, -0.1)).toBe(-30);
  });

  it('阅读进度按可滚动高度计算并限制在 0 到 1', () => {
    expect(calcScrollProgress(0, 3000, 1000)).toBe(0);
    expect(calcScrollProgress(1000, 3000, 1000)).toBe(0.5);
    expect(calcScrollProgress(2000, 3000, 1000)).toBe(1);
    expect(calcScrollProgress(2600, 3000, 1000)).toBe(1);
    expect(calcScrollProgress(120, 900, 1000)).toBe(0);
  });

  it('内容不足一屏时进度固定为零', () => {
    expect(calcScrollProgress(0, 800, 1000)).toBe(0);
    expect(calcScrollProgress(300, 800, 1000)).toBe(0);
  });

  it('首屏元素直接显示，屏外元素交给观察器渐入', () => {
    expect(shouldRevealImmediately(120, 900)).toBe(true);
    expect(shouldRevealImmediately(827, 900)).toBe(true);
    expect(shouldRevealImmediately(828, 900)).toBe(false);
    expect(shouldRevealImmediately(1400, 900)).toBe(false);
  });
});
