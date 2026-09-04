/**
 * 鲁港通 - 文件下载解析模块单元测试（D8 修复版）
 *
 * 聚焦纯函数 decodeByBom（BOM 感知解码）——这是「乱码入库」根因的修复点：
 *   data.gov.hk 静态 CSV 实测为 UTF-16LE(带 BOM)，旧版硬编码 utf-8 解码 → 乱码。
 *
 * 说明：downloader.ts 含运行时导入（axios / worker/readFile），本测试需阶段5 pnpm install
 *   装齐依赖后方可运行；decodeByBom 自身为纯函数，断言不触网、不依赖外部服务。
 */

import { describe, it, expect } from 'vitest';
import { decodeByBom } from './downloader';

describe('decodeByBom BOM 感知解码', () => {
  it('UTF-16LE BOM 应剥离 BOM 并按 utf16le 解码', () => {
    // BOM(FF FE) + "AB" 的 UTF-16LE 字节序
    const buffer = Buffer.from([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
    const { buffer: textBuffer, encoding } = decodeByBom(buffer);

    expect(encoding).toBe('utf16le');
    expect(textBuffer.toString(encoding)).toBe('AB');
  });

  it('UTF-16BE BOM 应剥离 BOM、整体字节交换一次并按 utf16le 解码', () => {
    // BOM(FE FF) + "AB" 的 UTF-16BE 字节序（每个码元高字节在前）
    // 剥离 BOM 后长度为 4（可被 4 整除）——正是旧版循环 swap16 会来回交换而失效的场景
    const buffer = Buffer.from([0xfe, 0xff, 0x00, 0x41, 0x00, 0x42]);
    const { buffer: textBuffer, encoding } = decodeByBom(buffer);

    expect(encoding).toBe('utf16le');
    expect(textBuffer.toString(encoding)).toBe('AB');
  });

  it('UTF-16BE 多字符（长度可被 4 整除）应正确交换全部码元', () => {
    // "ABC" 的 UTF-16BE：BOM + 00 41 00 42 00 43，剥离后长度 6
    const buffer = Buffer.from([0xfe, 0xff, 0x00, 0x41, 0x00, 0x42, 0x00, 0x43]);
    const { buffer: textBuffer, encoding } = decodeByBom(buffer);

    expect(encoding).toBe('utf16le');
    expect(textBuffer.toString(encoding)).toBe('ABC');
  });

  it('UTF-8 BOM 应剥离 3 字节 BOM 并按 utf-8 解码', () => {
    // BOM(EF BB BF) + "Hello" 的 ASCII 字节（48 65 6c 6c 6f）
    const buffer = Buffer.from([0xef, 0xbb, 0xbf, 0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    const { buffer: textBuffer, encoding } = decodeByBom(buffer);

    expect(encoding).toBe('utf-8');
    expect(textBuffer.toString(encoding)).toBe('Hello');
  });

  it('无 BOM 时应原样返回并按 utf-8 解码', () => {
    const buffer = Buffer.from('Name,Age\nJohn,30', 'utf-8');
    const { buffer: textBuffer, encoding } = decodeByBom(buffer);

    expect(encoding).toBe('utf-8');
    expect(textBuffer.toString(encoding)).toBe('Name,Age\nJohn,30');
    // 无 BOM 时不应裁剪内容
    expect(textBuffer.length).toBe(buffer.length);
  });

  it('仅含 UTF-16LE BOM 的空内容应返回空缓冲', () => {
    const buffer = Buffer.from([0xff, 0xfe]);
    const { buffer: textBuffer, encoding } = decodeByBom(buffer);

    expect(encoding).toBe('utf16le');
    expect(textBuffer.length).toBe(0);
  });

  it('UTF-16BE 奇数长度（异常数据）不应抛出', () => {
    // 剥离 BOM 后长度为奇数时跳过 swap16（守卫），避免 RangeError
    const buffer = Buffer.from([0xfe, 0xff, 0x00, 0x41, 0x00]);
    expect(() => decodeByBom(buffer)).not.toThrow();
  });
});
