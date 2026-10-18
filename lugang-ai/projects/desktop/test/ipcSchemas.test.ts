import { describe, expect, it } from 'vitest';
import {
  booleanSchema,
  createTabSchema,
  cssRectSchema,
  navigateUrlSchema,
  tabIdSchema
} from '../src/main/ipcSchemas';

describe('cssRectSchema', () => {
  it('接受合法矩形', () => {
    expect(cssRectSchema.parse({ x: 1, y: 2, width: 3, height: 4 })).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4
    });
  });

  it('拒绝负宽高与无穷值', () => {
    expect(cssRectSchema.safeParse({ x: 0, y: 0, width: -1, height: 10 }).success).toBe(false);
    expect(
      cssRectSchema.safeParse({ x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 10 }).success
    ).toBe(false);
  });

  it('拒绝缺字段', () => {
    expect(cssRectSchema.safeParse({ x: 0, y: 0, width: 10 }).success).toBe(false);
  });
});

describe('tabIdSchema', () => {
  it('接受正整数', () => {
    expect(tabIdSchema.parse(12)).toBe(12);
  });

  it('拒绝 0、负数与小数', () => {
    expect(tabIdSchema.safeParse(0).success).toBe(false);
    expect(tabIdSchema.safeParse(-3).success).toBe(false);
    expect(tabIdSchema.safeParse(1.5).success).toBe(false);
  });
});

describe('navigateUrlSchema', () => {
  it('去首尾空白', () => {
    expect(navigateUrlSchema.parse('  https://a.com  ')).toBe('https://a.com');
  });

  it('拒绝空串与超长输入', () => {
    expect(navigateUrlSchema.safeParse('   ').success).toBe(false);
    expect(navigateUrlSchema.safeParse(`https://a.com/${'a'.repeat(2048)}`).success).toBe(false);
  });
});

describe('booleanSchema', () => {
  it('只接受布尔值', () => {
    expect(booleanSchema.parse(true)).toBe(true);
    expect(booleanSchema.safeParse('true').success).toBe(false);
  });
});

describe('createTabSchema', () => {
  it('允许无参数', () => {
    expect(createTabSchema.parse(undefined)).toBeUndefined();
  });

  it('允许带网址', () => {
    expect(createTabSchema.parse({ url: 'https://a.com' })).toEqual({ url: 'https://a.com' });
  });

  it('拒绝空网址', () => {
    expect(createTabSchema.safeParse({ url: '' }).success).toBe(false);
  });
});
