import { describe, expect, it } from 'vitest';
import { cssRectToDip } from '../src/main/bounds';

const content = { width: 1920, height: 1080 };

describe('cssRectToDip', () => {
  it('缩放 1 时原样取整', () => {
    expect(cssRectToDip({ x: 100, y: 50, width: 400, height: 300 }, 1, content)).toEqual({
      x: 100,
      y: 50,
      width: 400,
      height: 300
    });
  });

  it('页面缩放 1.25 时按比例放大', () => {
    expect(cssRectToDip({ x: 100, y: 64, width: 400, height: 320 }, 1.25, content)).toEqual({
      x: 125,
      y: 80,
      width: 500,
      height: 400
    });
  });

  it('右侧与底部不超出内容区', () => {
    expect(cssRectToDip({ x: 1700, y: 1000, width: 400, height: 400 }, 1, content)).toEqual({
      x: 1700,
      y: 1000,
      width: 220,
      height: 80
    });
  });

  it('负坐标归零', () => {
    expect(cssRectToDip({ x: -20, y: -10, width: 400, height: 300 }, 1, content)).toEqual({
      x: 0,
      y: 0,
      width: 380,
      height: 290
    });
  });

  it('非法缩放按 1 处理', () => {
    expect(cssRectToDip({ x: 10, y: 10, width: 100, height: 100 }, 0, content)).toEqual({
      x: 10,
      y: 10,
      width: 100,
      height: 100
    });
  });
});
