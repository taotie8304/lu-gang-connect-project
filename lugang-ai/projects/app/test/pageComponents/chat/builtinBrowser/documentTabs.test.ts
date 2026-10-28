import { describe, expect, it } from 'vitest';
import {
  canReviewNow,
  diffPreviewText,
  findPendingChange,
  resolveActiveDocToken,
  resolveDocPanelView,
  resolveReviewProgress
} from '@/pageComponents/chat/builtinBrowser/documentTabs';
import type {
  DesktopDocumentSnapshot,
  DesktopDocumentSummary
} from '@/pageComponents/chat/builtinBrowser/desktopBridge';

const summary = (overrides: Partial<DesktopDocumentSummary>): DesktopDocumentSummary => ({
  token: 'token-a',
  mode: 'view',
  format: 'docx',
  fileName: '计划.docx',
  state: 'viewing',
  total: 0,
  decided: 0,
  ...overrides
});

const snapshot = (overrides: Partial<DesktopDocumentSnapshot>): DesktopDocumentSnapshot => ({
  token: 'token-a',
  mode: 'review',
  format: 'docx',
  fileName: '计划.docx',
  state: 'reviewing',
  changes: [],
  blocks: [],
  warnings: [],
  ...overrides
});

describe('resolveDocPanelView', () => {
  it('文件标签激活时优先进文档视图', () => {
    expect(
      resolveDocPanelView({ activeDocToken: 'token-a', status: 'loading', currentTabUrl: '' })
    ).toBe('doc');
    expect(
      resolveDocPanelView({
        activeDocToken: 'token-a',
        status: 'active',
        currentTabUrl: 'https://a.com'
      })
    ).toBe('doc');
  });

  it('空白标签就绪后显示落地页', () => {
    expect(
      resolveDocPanelView({ activeDocToken: null, status: 'active', currentTabUrl: 'about:blank' })
    ).toBe('landing');
    expect(
      resolveDocPanelView({ activeDocToken: null, status: 'active', currentTabUrl: '' })
    ).toBe('landing');
  });

  it('有网页或无会话时保持浏览器画面', () => {
    expect(
      resolveDocPanelView({
        activeDocToken: null,
        status: 'active',
        currentTabUrl: 'https://www.gov.hk'
      })
    ).toBe('browser');
    expect(
      resolveDocPanelView({ activeDocToken: null, status: 'loading', currentTabUrl: '' })
    ).toBe('browser');
  });
});

describe('resolveActiveDocToken', () => {
  it('当前文件仍在列表里就保持激活', () => {
    expect(
      resolveActiveDocToken([summary({ token: 'a' }), summary({ token: 'b' })], 'b')
    ).toBe('b');
  });

  it('当前文件被关闭后自动认领新的待审会话', () => {
    expect(
      resolveActiveDocToken(
        [
          summary({ token: 'view', mode: 'view', state: 'viewing' }),
          summary({ token: 'review', mode: 'review', state: 'pending', total: 2 })
        ],
        'closed'
      )
    ).toBe('review');
  });

  it('没有待审会话且当前失效时回到空', () => {
    expect(resolveActiveDocToken([summary({ token: 'view' })], 'closed')).toBeNull();
    expect(resolveActiveDocToken([], undefined)).toBeNull();
  });
});

describe('diffPreviewText', () => {
  it('内容一致时不产生差异段', () => {
    expect(diffPreviewText('2024年计划', '2024年计划')).toEqual([
      { kind: 'same', text: '2024年计划' }
    ]);
  });

  it('中间替换只标出真正变化的片段', () => {
    expect(diffPreviewText('目标：2023年完成一期。', '目标：2024年完成一期。')).toEqual([
      { kind: 'same', text: '目标：202' },
      { kind: 'removed', text: '3' },
      { kind: 'added', text: '4' },
      { kind: 'same', text: '年完成一期。' }
    ]);
  });

  it('新插入的段落整段计为新增', () => {
    expect(diffPreviewText('', '备注：待补充。')).toEqual([
      { kind: 'added', text: '备注：待补充。' }
    ]);
  });

  it('被删除的文字整段计为删除并保留后续公共内容', () => {
    expect(diffPreviewText('预算：100 万元。', '预算：万元。')).toEqual([
      { kind: 'same', text: '预算：' },
      { kind: 'removed', text: '100 ' },
      { kind: 'same', text: '万元。' }
    ]);
  });

  it('两段都为空时不输出空段', () => {
    expect(diffPreviewText('', '')).toEqual([]);
  });
});

describe('resolveReviewProgress', () => {
  it('按已决定条数计算百分比', () => {
    const value = snapshot({
      changes: [
        { index: 0, target: '第 1 段', before: 'a', after: 'b', status: 'applied' },
        { index: 1, target: '第 2 段', before: 'c', after: 'd', status: 'pending' },
        { index: 2, target: '第 3 段', before: 'e', after: 'f', status: 'pending' }
      ]
    });
    expect(resolveReviewProgress(value)).toEqual({ total: 3, decided: 1, percent: 33 });
  });

  it('全部决定后为 100%', () => {
    const value = snapshot({
      changes: [
        { index: 0, target: '文末', before: '', after: 'x', status: 'skipped' },
        { index: 1, target: '文末', before: '', after: 'y', status: 'applied' }
      ]
    });
    expect(resolveReviewProgress(value)).toEqual({ total: 2, decided: 2, percent: 100 });
  });

  it('没有改动时返回零进度', () => {
    expect(resolveReviewProgress(snapshot({}))).toEqual({ total: 0, decided: 0, percent: 0 });
  });
});

describe('findPendingChange', () => {
  it('只返回第一条待处理改动', () => {
    const value = snapshot({
      changes: [
        { index: 0, target: '第 1 段', before: 'a', after: 'b', status: 'skipped' },
        { index: 1, target: '第 2 段', before: 'c', after: 'd', status: 'pending' },
        { index: 2, target: '第 3 段', before: 'e', after: 'f', status: 'pending' }
      ]
    });
    expect(findPendingChange(value)).toMatchObject({ index: 1, target: '第 2 段' });
  });

  it('全部处理后返回空', () => {
    expect(
      findPendingChange(
        snapshot({
          changes: [{ index: 0, target: '第 1 段', before: 'a', after: 'b', status: 'applied' }]
        })
      )
    ).toBeNull();
  });
});

describe('canReviewNow', () => {
  it('只有审阅中且为修改会话时可操作', () => {
    expect(canReviewNow(snapshot({ state: 'reviewing' }))).toBe(true);
    expect(canReviewNow(snapshot({ state: 'pending' }))).toBe(false);
    expect(canReviewNow(snapshot({ state: 'finalizing' }))).toBe(false);
    expect(canReviewNow(snapshot({ state: 'viewing', mode: 'view' }))).toBe(false);
  });
});
