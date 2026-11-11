import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAX_DOWNLOAD_ROWS,
  buildDownloadFilePath,
  sanitizeFileBaseName,
  trimDownloadRows
} from '../src/main/browser/downloads';

type Row = { id: string; status: 'progressing' | 'completed' | 'cancelled' | 'interrupted'; startedAt: number };

const row = (id: string, status: Row['status'], startedAt: number): Row => ({
  id,
  status,
  startedAt
});

describe('trimDownloadRows', () => {
  it('未超过上限时按开始时间返回', () => {
    const rows = [row('b', 'completed', 2), row('a', 'progressing', 1)];
    expect(trimDownloadRows(rows).map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('超出上限优先移除最早的已结束项', () => {
    const rows = Array.from({ length: MAX_DOWNLOAD_ROWS + 2 }, (_, index) =>
      row(`r${index}`, index === 0 ? 'progressing' : 'completed', index)
    );
    const kept = trimDownloadRows(rows).map((item) => item.id);
    expect(kept).toHaveLength(MAX_DOWNLOAD_ROWS);
    expect(kept).not.toContain('r1');
    expect(kept).not.toContain('r2');
    expect(kept).toContain('r0');
    expect(kept).toContain('r6');
  });

  it('全部进行中时移除最早的进行中项', () => {
    const rows = Array.from({ length: MAX_DOWNLOAD_ROWS + 1 }, (_, index) =>
      row(`r${index}`, 'progressing', index)
    );
    const kept = trimDownloadRows(rows).map((item) => item.id);
    expect(kept).toHaveLength(MAX_DOWNLOAD_ROWS);
    expect(kept).not.toContain('r0');
  });
});

describe('sanitizeFileBaseName', () => {
  it('去掉 Windows 非法字符并折叠空白', () => {
    expect(sanitizeFileBaseName('政府 服务: 指南/2026?.pdf')).toBe('政府 服务 指南 2026 .pdf');
  });

  it('去掉开头点号，避免生成隐藏文件', () => {
    expect(sanitizeFileBaseName('..隐藏')).toBe('隐藏');
  });

  it('限制长度到 80 个字符', () => {
    expect(sanitizeFileBaseName('a'.repeat(120))).toHaveLength(80);
  });

  it('清理后为空时回落到 page', () => {
    expect(sanitizeFileBaseName('   ')).toBe('page');
    expect(sanitizeFileBaseName('???')).toBe('page');
  });
});

describe('buildDownloadFilePath', () => {
  const none = () => false;

  it('无重名时直接用安全文件名', () => {
    expect(buildDownloadFilePath('C:\\Downloads', '申请表.pdf', none)).toBe(
      join('C:\\Downloads', '申请表.pdf')
    );
  });

  it('重名时在扩展名前追加序号', () => {
    const taken = new Set([join('C:\\Downloads', 'report.pdf'), join('C:\\Downloads', 'report (1).pdf')]);
    const exists = (path: string) => taken.has(path);
    expect(buildDownloadFilePath('C:\\Downloads', 'report.pdf', exists)).toBe(
      join('C:\\Downloads', 'report (2).pdf')
    );
  });

  it('清理非法字符后再判断重名', () => {
    const taken = new Set([join('C:\\Downloads', 'a b.txt')]);
    const exists = (path: string) => taken.has(path);
    expect(buildDownloadFilePath('C:\\Downloads', 'a:b.txt', exists)).toBe(
      join('C:\\Downloads', 'a b (1).txt')
    );
  });

  it('没有文件名时回落到 page', () => {
    expect(buildDownloadFilePath('C:\\Downloads', '', none)).toBe(join('C:\\Downloads', 'page'));
  });
});
