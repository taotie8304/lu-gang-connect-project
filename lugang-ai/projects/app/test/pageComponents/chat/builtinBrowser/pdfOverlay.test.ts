import { describe, expect, it } from 'vitest';
import {
  findActivePdfChangeIndex,
  pdfOverlayBoxes,
  pdfOverlayTone
} from '@/pageComponents/chat/builtinBrowser/pdfOverlay';
import type {
  DesktopDocumentSnapshot,
  DesktopPdfOverlayItem
} from '@/pageComponents/chat/builtinBrowser/desktopBridge';

const item = (overrides: Partial<DesktopPdfOverlayItem>): DesktopPdfOverlayItem => ({
  index: 0,
  page: 1,
  label: '姓名：',
  value: '张三',
  status: 'pending',
  ...overrides
});

describe('pdfOverlayTone', () => {
  it('待确认用黄底、已应用用绿底', () => {
    expect(pdfOverlayTone('pending')).toBe('pending');
    expect(pdfOverlayTone('applied')).toBe('applied');
  });

  it('跳过与找不到标签的条目不参与标注', () => {
    expect(pdfOverlayTone('skipped')).toBeUndefined();
    expect(pdfOverlayTone('unavailable')).toBeUndefined();
  });
});

describe('pdfOverlayBoxes', () => {
  it('只取当前页的条目，标签与内容各生成一个标记块', () => {
    const boxes = pdfOverlayBoxes(
      [
        item({ index: 0, labelRect: { x: 0.1, y: 0.2, width: 0.2, height: 0.03 } }),
        item({
          index: 0,
          valueRect: { x: 0.35, y: 0.2, width: 0.25, height: 0.03 },
          value: '张三'
        }),
        item({ index: 1, page: 2, labelRect: { x: 0.1, y: 0.2, width: 0.2, height: 0.03 } })
      ],
      1
    );

    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toMatchObject({ kind: 'label', tone: 'pending', label: '姓名：' });
    expect(boxes[1]).toMatchObject({ kind: 'value', value: '张三' });
  });

  it('归一化矩形换算成百分比定位', () => {
    const boxes = pdfOverlayBoxes(
      [item({ labelRect: { x: 0.1, y: 0.25, width: 0.5, height: 0.04 } })],
      1
    );

    expect(boxes[0].style).toEqual({
      left: '10.000%',
      top: '25.000%',
      width: '50.000%',
      height: '4.000%'
    });
  });

  it('越界矩形收进页面内并保留最小可见尺寸', () => {
    const boxes = pdfOverlayBoxes(
      [item({ valueRect: { x: 0.98, y: -0.2, width: 0.4, height: 0 } })],
      1
    );

    expect(boxes[0].style.top).toBe('0.000%');
    expect(boxes[0].style.width).toBe('2.000%');
    expect(boxes[0].style.height).toBe('0.400%');
  });

  it('已应用条目改用绿色，跳过条目整条不画', () => {
    const boxes = pdfOverlayBoxes(
      [
        item({ index: 0, status: 'applied', labelRect: { x: 0.1, y: 0.1, width: 0.1, height: 0.02 } }),
        item({ index: 1, status: 'skipped', labelRect: { x: 0.1, y: 0.3, width: 0.1, height: 0.02 } }),
        item({ index: 2, status: 'unavailable', labelRect: { x: 0.1, y: 0.5, width: 0.1, height: 0.02 } })
      ],
      1
    );

    expect(boxes).toHaveLength(1);
    expect(boxes[0].tone).toBe('applied');
  });

  it('没有叠加信息时返回空列表', () => {
    expect(pdfOverlayBoxes(undefined, 1)).toEqual([]);
    expect(pdfOverlayBoxes([], 1)).toEqual([]);
  });
});

describe('findActivePdfChangeIndex', () => {
  it('返回第一个待确认条目', () => {
    const snapshot = {
      changes: [
        { index: 0, status: 'skipped' },
        { index: 1, status: 'pending' },
        { index: 2, status: 'pending' }
      ]
    } as DesktopDocumentSnapshot;

    expect(findActivePdfChangeIndex(snapshot)).toBe(1);
  });

  it('全部处理完时没有高亮条目', () => {
    const snapshot = {
      changes: [{ index: 0, status: 'applied' }]
    } as DesktopDocumentSnapshot;

    expect(findActivePdfChangeIndex(snapshot)).toBeUndefined();
  });
});
