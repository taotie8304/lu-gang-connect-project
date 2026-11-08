import { describe, expect, it } from 'vitest';
import {
  calcScrollOffset,
  calcScrollProgress,
  calcDriftOffset,
  calcFlowProgress,
  formatCount,
  resolveBillingAmount,
  shouldRevealImmediately
} from '@/pageComponents/login/home/homeFx';

describe('首页视差与滚动辅助函数', () => {
  it('阅读进度按可滚动高度计算并限制在 0 到 1', () => {
    expect(calcScrollProgress(0, 3000, 1000)).toBe(0);
    expect(calcScrollProgress(1000, 3000, 1000)).toBe(0.5);
    expect(calcScrollProgress(2000, 3000, 1000)).toBe(1);
    expect(calcScrollProgress(2600, 3000, 1000)).toBe(1);
  });

  it('内容不足一屏时进度固定为零', () => {
    expect(calcScrollProgress(120, 900, 1000)).toBe(0);
  });

  it('全局视差偏移等于滚动距离乘系数', () => {
    expect(calcScrollOffset(400, -0.1)).toBe(-40);
    expect(calcScrollOffset(0, -0.1)).toBe(0);
    expect(calcScrollOffset(300, 0.05)).toBe(15);
  });

  it('漂移位移以元素中心为基准并限制在正负一个屏幕内', () => {
    expect(calcDriftOffset({ top: 400, height: 200 }, 1000, -0.1)).toBe(0);
    expect(calcDriftOffset({ top: 1000, height: 200 }, 1000, -0.1)).toBe(-60);
    expect(calcDriftOffset({ top: -400, height: 200 }, 1000, -0.1)).toBe(80);
    expect(calcDriftOffset({ top: 20000, height: 200 }, 1000, -0.1)).toBe(-100);
  });

  it('首屏元素直接显示，屏外元素交给观察器渐入', () => {
    expect(shouldRevealImmediately(120, 900)).toBe(true);
    expect(shouldRevealImmediately(827, 900)).toBe(true);
    expect(shouldRevealImmediately(828, 900)).toBe(false);
  });

  it('流程线宽度随当前步骤按比例增加', () => {
    expect(calcFlowProgress(0, 4)).toBe(25);
    expect(calcFlowProgress(1, 4)).toBe(50);
    expect(calcFlowProgress(3, 4)).toBe(100);
    expect(calcFlowProgress(5, 4)).toBe(100);
  });

  it('统计数字按千分位取整显示', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(1200)).toBe('1,200');
    expect(formatCount(1199.6)).toBe('1,200');
  });

  it('计费切换按月付/年付取值', () => {
    expect(resolveBillingAmount(69, 690, 'month')).toBe(69);
    expect(resolveBillingAmount(69, 690, 'year')).toBe(690);
  });
});
