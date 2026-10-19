import { describe, expect, it } from 'vitest';
import {
  GENERATED_FILE_FOLDER,
  formatGeneratedFileTimestamp,
  resolveGeneratedFileName,
  sanitizeGeneratedFileBaseName
} from '../src/main/ai/fileNaming';

const noExistingFiles = () => false;

describe('本地生成文件命名', () => {
  it('默认保存到下载目录下的专用文件夹', () => {
    expect(GENERATED_FILE_FOLDER).toBe('鲁港通生成文件');
  });

  it('去掉扩展名并按目标格式补后缀', () => {
    expect(sanitizeGeneratedFileBaseName('香港慈善组织申请说明.docx', 'docx')).toBe(
      '香港慈善组织申请说明'
    );
    expect(sanitizeGeneratedFileBaseName('香港慈善组织申请说明', 'pdf')).toBe(
      '香港慈善组织申请说明'
    );
    expect(resolveGeneratedFileName({
      fileName: '香港慈善组织申请说明',
      format: 'docx',
      exists: noExistingFiles
    })).toBe('香港慈善组织申请说明.docx');
  });

  it('清理 Windows 不允许的字符与首尾空格', () => {
    expect(sanitizeGeneratedFileBaseName('  申请书/附件:一*版?  ', 'docx')).toBe(
      '申请书 附件 一 版'
    );
  });

  it('空名称与系统保留名回落到可读名称', () => {
    expect(sanitizeGeneratedFileBaseName('   ', 'pdf')).toBe('鲁港通生成文件');
    expect(sanitizeGeneratedFileBaseName('CON', 'xlsx')).toBe('CON_文件');
  });

  it('同名文件追加时间后缀', () => {
    const name = resolveGeneratedFileName({
      fileName: '申请书',
      format: 'docx',
      exists: (fileName) => fileName === '申请书.docx',
      now: new Date(2026, 9, 19, 14, 5, 9)
    });
    expect(name).toBe('申请书-20261019-140509.docx');
  });

  it('同一秒内仍重名时继续追加序号', () => {
    const existing = new Set([
      '申请书.docx',
      '申请书-20261019-140509.docx',
      '申请书-20261019-140509-2.docx'
    ]);
    const name = resolveGeneratedFileName({
      fileName: '申请书',
      format: 'docx',
      exists: (fileName) => existing.has(fileName),
      now: new Date(2026, 9, 19, 14, 5, 9)
    });
    expect(name).toBe('申请书-20261019-140509-3.docx');
  });

  it('时间后缀使用本地时间且补零', () => {
    expect(formatGeneratedFileTimestamp(new Date(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405');
  });
});
