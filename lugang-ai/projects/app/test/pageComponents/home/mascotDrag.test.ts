import { describe, expect, it } from 'vitest';
import {
  clampMascotPoint,
  parseMascotPoint,
  serializeMascotPoint
} from '@/pageComponents/login/home/mascotDrag';

const heroRect = { left: 0, top: 0, width: 1000, height: 600 };
const mascotSize = { width: 160, height: 160 };

describe('史莱姆拖拽坐标换算', () => {
  it('区域内指针位置按 hero 归一化', () => {
    expect(clampMascotPoint({ pointerX: 500, pointerY: 300, heroRect, mascotSize })).toEqual({
      x: 0.5,
      y: 0.5
    });
  });

  it('四边越界时把史莱姆完整收进区域并保留边距', () => {
    expect(clampMascotPoint({ pointerX: -400, pointerY: -400, heroRect, mascotSize })).toEqual({
      x: 0.096,
      y: 0.16
    });
    expect(clampMascotPoint({ pointerX: 4000, pointerY: 4000, heroRect, mascotSize })).toEqual({
      x: 0.904,
      y: 0.84
    });
  });

  it('自定义边距生效', () => {
    expect(
      clampMascotPoint({ pointerX: -400, pointerY: -400, heroRect, mascotSize, margin: 0 })
    ).toEqual({ x: 0.08, y: 0.1333 });
  });

  it('hero 小于史莱姆时回到中心', () => {
    expect(
      clampMascotPoint({
        pointerX: 10,
        pointerY: 10,
        heroRect: { left: 0, top: 0, width: 100, height: 100 },
        mascotSize
      })
    ).toEqual({ x: 0.5, y: 0.5 });
  });

  it('计算基于 hero 的页面偏移', () => {
    expect(
      clampMascotPoint({
        pointerX: 700,
        pointerY: 500,
        heroRect: { left: 200, top: 100, width: 1000, height: 600 },
        mascotSize
      })
    ).toEqual({ x: 0.5, y: 0.6667 });
  });

  it('序列化后解析可往返一致', () => {
    const point = { x: 0.4321, y: 0.8765 };
    expect(parseMascotPoint(serializeMascotPoint(point))).toEqual(point);
    expect(serializeMascotPoint(parseMascotPoint(serializeMascotPoint(point))!)).toBe(
      serializeMascotPoint(point)
    );
  });

  it('非法存储值返回 null', () => {
    expect(parseMascotPoint(null)).toBeNull();
    expect(parseMascotPoint('')).toBeNull();
    expect(parseMascotPoint('abc')).toBeNull();
    expect(parseMascotPoint('0.4')).toBeNull();
    expect(parseMascotPoint('0.4,0.5,0.6')).toBeNull();
    expect(parseMascotPoint('NaN,0.5')).toBeNull();
  });

  it('越界存储值被收进 0–1', () => {
    expect(parseMascotPoint('-1,2')).toEqual({ x: 0, y: 1 });
  });
});
