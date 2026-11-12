// 鲁港通 - 价格页改版：额外 Credits 卡片展示口径（推荐档、深度问答估算、单价）
import { describe, expect, it } from 'vitest';
import { buildExtraPointsCardDisplay } from '@/pageComponents/price/extraPointsDisplay';

describe('buildExtraPointsCardDisplay', () => {
  it('三档积分包时只把中间一档标为推荐', () => {
    const first = buildExtraPointsCardDisplay({ index: 0, packageCount: 3, points: 1000, price: 10 });
    const middle = buildExtraPointsCardDisplay({ index: 1, packageCount: 3, points: 5000, price: 50 });
    const last = buildExtraPointsCardDisplay({ index: 2, packageCount: 3, points: 10000, price: 100 });

    expect(middle.recommended).toBe(true);
    expect(first.recommended).toBe(false);
    expect(last.recommended).toBe(false);
  });

  it('档位不是三档时不出现推荐标记', () => {
    expect(
      buildExtraPointsCardDisplay({ index: 1, packageCount: 2, points: 5000, price: 50 }).recommended
    ).toBe(false);
  });

  it('按 40 Credits/次向下取整估算可完成的深度问答次数', () => {
    expect(
      buildExtraPointsCardDisplay({ index: 0, packageCount: 3, points: 1000, price: 10 }).deepQaCount
    ).toBe(25);
    expect(
      buildExtraPointsCardDisplay({ index: 0, packageCount: 3, points: 1010, price: 10 }).deepQaCount
    ).toBe(25);
  });

  it('单价保留两位小数', () => {
    expect(
      buildExtraPointsCardDisplay({ index: 0, packageCount: 3, points: 1000, price: 10 }).unitPrice
    ).toBe('0.01');
    expect(
      buildExtraPointsCardDisplay({ index: 0, packageCount: 3, points: 3000, price: 100 }).unitPrice
    ).toBe('0.03');
  });

  it('异常数据不产生 NaN', () => {
    const display = buildExtraPointsCardDisplay({
      index: 0,
      packageCount: 3,
      points: 0,
      price: 10
    });
    expect(display.unitPrice).toBe('0.00');
    expect(display.deepQaCount).toBe(0);
  });
});
