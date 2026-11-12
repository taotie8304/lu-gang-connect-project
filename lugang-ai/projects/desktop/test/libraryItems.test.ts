import { describe, expect, it } from 'vitest';
import {
  MAX_LIBRARY_ITEMS,
  classifyLibraryKind,
  mergeLibraryRecord,
  normalizeLibraryPath,
  pruneLibraryRecords,
  sanitizeOrigin,
  toDesktopLibraryItem,
  type LibraryRecord
} from '../src/main/library/items';

const record = (patch: Partial<LibraryRecord> = {}): LibraryRecord => ({
  id: 'r1',
  path: 'C:\\Users\\A\\Downloads\\鲁港通生成文件\\材料.docx',
  name: '材料.docx',
  kind: 'docx',
  source: 'ai',
  size: 1024,
  addedAt: 1000,
  usedAt: 2000,
  starred: false,
  ...patch
});

describe('资料库条目纯逻辑', () => {
  it('默认索引上限为 500 条', () => {
    expect(MAX_LIBRARY_ITEMS).toBe(500);
  });

  it('按扩展名归类格式', () => {
    expect(classifyLibraryKind('材料.docx')).toBe('docx');
    expect(classifyLibraryKind('预算.XLSX')).toBe('xlsx');
    expect(classifyLibraryKind('旧表.xls')).toBe('xlsx');
    expect(classifyLibraryKind('名单.csv')).toBe('xlsx');
    expect(classifyLibraryKind('通知.PDF')).toBe('pdf');
    expect(classifyLibraryKind('回执.png')).toBe('image');
    expect(classifyLibraryKind('照片.JPG')).toBe('image');
    expect(classifyLibraryKind('扫描.webp')).toBe('image');
    expect(classifyLibraryKind('打包.zip')).toBe('archive');
    expect(classifyLibraryKind('备份.tar.gz')).toBe('archive');
    expect(classifyLibraryKind('说明.txt')).toBe('other');
    expect(classifyLibraryKind('无扩展名')).toBe('other');
  });

  it('路径按 Windows 规则规范化后比较', () => {
    expect(normalizeLibraryPath('C:\\Users\\A\\材料.docx')).toBe('c:/users/a/材料.docx');
    expect(normalizeLibraryPath('c:/users/a/材料.docx')).toBe('c:/users/a/材料.docx');
    expect(normalizeLibraryPath('C:\\Users\\A\\材料.docx')).toBe(
      normalizeLibraryPath('c:/Users/A/材料.docx')
    );
  });

  it('下载来源只保留域名', () => {
    expect(sanitizeOrigin('https://www.gov.hk/path/a.pdf?x=1')).toBe('www.gov.hk');
    expect(sanitizeOrigin('http://Example.COM:8080/a')).toBe('example.com');
    expect(sanitizeOrigin('not a url')).toBeUndefined();
  });

  it('渲染层条目不带本机路径', () => {
    const item = toDesktopLibraryItem(record(), true);
    expect(item).toMatchObject({
      id: 'r1',
      name: '材料.docx',
      kind: 'docx',
      source: 'ai',
      size: 1024,
      starred: false,
      missing: true
    });
    expect('path' in item).toBe(false);
  });

  it('同路径再次登记只更新属性、不产生重复', () => {
    const first = mergeLibraryRecord([], record(), () => 'new-id');
    expect(first.created).toBe(true);
    expect(first.records).toHaveLength(1);

    const second = mergeLibraryRecord(
      first.records,
      record({
        id: 'ignored',
        path: 'c:/users/a/downloads/鲁港通生成文件/材料.docx',
        name: '材料-改名.docx',
        size: 2048,
        usedAt: 5000,
        origin: 'www.gov.hk',
        parentName: '原件.docx'
      }),
      () => 'another'
    );
    expect(second.created).toBe(false);
    expect(second.records).toHaveLength(1);
    expect(second.record).toMatchObject({
      id: 'new-id',
      name: '材料-改名.docx',
      size: 2048,
      usedAt: 5000,
      origin: 'www.gov.hk',
      parentName: '原件.docx',
      source: 'ai'
    });
  });

  it('已有收藏状态不会被后续登记覆盖', () => {
    const starred = record({ starred: true });
    const merged = mergeLibraryRecord(
      [starred],
      record({ path: 'c:/users/a/downloads/鲁港通生成文件/材料.docx' }),
      () => 'x'
    );
    expect(merged.record.starred).toBe(true);
  });

  it('超过上限时先淘汰最旧的未收藏记录', () => {
    const records: LibraryRecord[] = [
      record({ id: 'star-old', starred: true, usedAt: 1 }),
      record({ id: 'a', usedAt: 10 }),
      record({ id: 'b', usedAt: 30 }),
      record({ id: 'c', usedAt: 20 }),
      record({ id: 'star-new', starred: true, usedAt: 2 })
    ];
    const kept = pruneLibraryRecords(records, 3);
    expect(kept.map((item) => item.id).sort()).toEqual(['b', 'star-new', 'star-old']);
  });

  it('收藏记录全部超过上限时也全部保留', () => {
    const records = [record({ id: 'a', starred: true }), record({ id: 'b', starred: true })];
    expect(pruneLibraryRecords(records, 1)).toHaveLength(2);
  });
});
