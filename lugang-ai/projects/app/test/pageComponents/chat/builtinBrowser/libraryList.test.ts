import { describe, expect, it } from 'vitest';
import type { DesktopLibraryItem } from '@/pageComponents/chat/builtinBrowser/desktopBridge';
import {
  canContinueLibraryItem,
  filterLibraryItems,
  formatLibrarySize,
  formatLibraryTime,
  libraryContinueLabel,
  libraryCounts,
  libraryGroupLabel,
  libraryImageMime,
  libraryKindBadge,
  libraryKindFilter,
  libraryLocationLabel,
  librarySourceLabel,
  resolveLibraryMenuPosition,
  sortLibraryItems
} from '@/pageComponents/chat/builtinBrowser/libraryList';

const item = (patch: Partial<DesktopLibraryItem>): DesktopLibraryItem => ({
  id: 'f1',
  name: '文件.docx',
  kind: 'docx',
  source: 'ai',
  size: 1024,
  addedAt: 0,
  usedAt: 0,
  starred: false,
  missing: false,
  ...patch
});

describe('资料库列表纯逻辑', () => {
  it('按文件名搜索忽略大小写，按类型筛选归入其他', () => {
    const items = [
      item({ id: '1', name: '申请说明.docx', kind: 'docx' }),
      item({ id: '2', name: 'Budget.XLSX', kind: 'xlsx' }),
      item({ id: '3', name: '照片.png', kind: 'image' }),
      item({ id: '4', name: '材料.zip', kind: 'archive' })
    ];

    expect(filterLibraryItems(items, { keyword: 'budget', filter: 'all' }).map((i) => i.id)).toEqual(['2']);
    expect(filterLibraryItems(items, { keyword: '  ', filter: 'other' }).map((i) => i.id)).toEqual(['3', '4']);
    expect(filterLibraryItems(items, { keyword: '', filter: 'docx' }).map((i) => i.id)).toEqual(['1']);
  });

  it('收藏始终置顶，其余按最近使用降序', () => {
    const items = [
      item({ id: 'a', usedAt: 30 }),
      item({ id: 'b', usedAt: 10, starred: true }),
      item({ id: 'c', usedAt: 20 })
    ];

    expect(sortLibraryItems(items, 'recent').map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('名称按中文排序，大小按降序', () => {
    const items = [
      item({ id: 'a', name: '丙.docx', size: 300 }),
      item({ id: 'b', name: '甲.docx', size: 100 }),
      item({ id: 'c', name: '乙.docx', size: 200 })
    ];

    expect(sortLibraryItems(items, 'name').map((i) => i.name)).toEqual(['丙.docx', '甲.docx', '乙.docx']);
    expect(sortLibraryItems(items, 'size').map((i) => i.id)).toEqual(['a', 'c', 'b']);
  });

  it('排序不修改原数组', () => {
    const items = [item({ id: 'a', usedAt: 1 }), item({ id: 'b', usedAt: 2 })];
    const sorted = sortLibraryItems(items, 'recent');

    expect(sorted.map((i) => i.id)).toEqual(['b', 'a']);
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('统计全部与四类数量，图片与压缩包计入其他', () => {
    const items = [
      item({ kind: 'docx' }),
      item({ kind: 'xlsx' }),
      item({ kind: 'pdf' }),
      item({ kind: 'image' }),
      item({ kind: 'archive' }),
      item({ kind: 'other' })
    ];

    expect(libraryCounts(items)).toEqual({ all: 6, docx: 1, xlsx: 1, pdf: 1, other: 3 });
  });

  it('格式归类：文档三类单列，其余归其他', () => {
    expect(libraryKindFilter('docx')).toBe('docx');
    expect(libraryKindFilter('xlsx')).toBe('xlsx');
    expect(libraryKindFilter('pdf')).toBe('pdf');
    expect(libraryKindFilter('image')).toBe('other');
    expect(libraryKindFilter('archive')).toBe('other');
    expect(libraryKindFilter('other')).toBe('other');
  });

  it('格式徽标：文档用字母，图片与压缩包用短词', () => {
    expect(libraryKindBadge('docx')).toBe('W');
    expect(libraryKindBadge('xlsx')).toBe('X');
    expect(libraryKindBadge('pdf')).toBe('P');
    expect(libraryKindBadge('image')).toBe('图');
    expect(libraryKindBadge('archive')).toBe('ZIP');
    expect(libraryKindBadge('other')).toBe('文件');
  });

  it('大小格式化保留 PB 级兜底与一位小数', () => {
    expect(formatLibrarySize(860)).toBe('860 B');
    expect(formatLibrarySize(2048)).toBe('2 KB');
    expect(formatLibrarySize(1887436)).toBe('1.8 MB');
    expect(formatLibrarySize(40265318)).toBe('38.4 MB');
  });

  it('来源文案与保存位置描述不暴露绝对路径', () => {
    expect(librarySourceLabel('ai')).toBe('AI 生成');
    expect(librarySourceLabel('download')).toBe('网页下载');
    expect(librarySourceLabel('edit')).toBe('编辑副本');
    expect(librarySourceLabel('import')).toBe('本机导入');
    expect(libraryLocationLabel('ai')).toContain('鲁港通生成文件');
    expect(libraryLocationLabel('edit')).toContain('鲁港通生成文件');
    expect(libraryLocationLabel('download')).toContain('下载');
    expect(libraryLocationLabel('import')).toContain('原位置');
  });

  it('可继续修改：Word/Excel 为继续修改，PDF 为用 AI 填写，其余不可', () => {
    expect(canContinueLibraryItem('docx')).toBe(true);
    expect(canContinueLibraryItem('xlsx')).toBe(true);
    expect(canContinueLibraryItem('pdf')).toBe(true);
    expect(canContinueLibraryItem('image')).toBe(false);
    expect(canContinueLibraryItem('archive')).toBe(false);
    expect(libraryContinueLabel('docx')).toBe('继续修改');
    expect(libraryContinueLabel('pdf')).toBe('用 AI 填写');
  });

  it('时间分组与展示：今天显示时刻，昨天带前缀，更早显示日期', () => {
    const now = new Date(2026, 10, 12, 15, 0, 0).getTime();
    const today = new Date(2026, 10, 12, 10, 24, 0).getTime();
    const yesterday = new Date(2026, 10, 11, 18, 42, 0).getTime();
    const earlier = new Date(2026, 10, 10, 9, 0, 0).getTime();

    expect(libraryGroupLabel(today, now)).toBe('今天');
    expect(libraryGroupLabel(yesterday, now)).toBe('昨天');
    expect(libraryGroupLabel(earlier, now)).toBe('更早');
    expect(formatLibraryTime(today, now)).toBe('10:24');
    expect(formatLibraryTime(yesterday, now)).toBe('昨天 18:42');
    expect(formatLibraryTime(earlier, now)).toBe('11 月 10 日');
  });

  it('图片 MIME 按扩展名给出，未知退回通用二进制', () => {
    expect(libraryImageMime('船票.PNG')).toBe('image/png');
    expect(libraryImageMime('a.jpg')).toBe('image/jpeg');
    expect(libraryImageMime('a.jpeg')).toBe('image/jpeg');
    expect(libraryImageMime('a.gif')).toBe('image/gif');
    expect(libraryImageMime('a.webp')).toBe('image/webp');
    expect(libraryImageMime('a.bmp')).toBe('image/bmp');
    expect(libraryImageMime('a.svg')).toBe('image/svg+xml');
    expect(libraryImageMime('a.bin')).toBe('application/octet-stream');
  });

  it('行菜单贴住锚点右下角，底部放不下时翻到上方', () => {
    expect(
      resolveLibraryMenuPosition(
        { right: 400, top: 100, bottom: 120 },
        { width: 800, height: 600 },
        { width: 168, height: 240 }
      )
    ).toEqual({ left: 232, top: 124 });
    expect(
      resolveLibraryMenuPosition(
        { right: 780, top: 100, bottom: 120 },
        { width: 800, height: 600 },
        { width: 168, height: 240 }
      )
    ).toEqual({ left: 612, top: 124 });
    expect(
      resolveLibraryMenuPosition(
        { right: 400, top: 500, bottom: 520 },
        { width: 800, height: 600 },
        { width: 168, height: 240 }
      )
    ).toEqual({ left: 232, top: 256 });
  });
});
