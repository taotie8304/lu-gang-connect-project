// 鲁港通 - 解码层测试（TDD）：BOM 检测 + UTF-16 LE / UTF-8 容错解码
import { describe, it, expect } from 'vitest';
import { decodeBytes } from '../src/decode';
import { fixture } from './fixture';

describe('decodeBytes - UTF-16 LE（含 BOM）', () => {
  it('附设幼儿中心名单原始字节 → 解出中文表头且无乱码', () => {
    const buf = fixture('ccckg-non-aided-tc.csv');
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xfe);
    const text = decodeBytes(buf);
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(text).not.toContain('\uFFFD');
    expect(text).toContain('機構名稱,中心名稱,地址');
  });

  it('学校位置总表原始字节（约 2.7MB）→ 制表符表头与行数基准', () => {
    const buf = fixture('SCH_LOC_EDB.raw.csv');
    const text = decodeBytes(buf);
    expect(text.split(/\r?\n/)[0]).toContain('ENGLISH CATEGORY\t中文類別');
    expect(text).toContain('資助小學');
    expect(text.split(/\r?\n/).length).toBe(3463);
  });
});

describe('decodeBytes - UTF-8 BOM', () => {
  it('SSPA 中学学校网 → 去 BOM 且首行与校名正常', () => {
    const buf = fixture('sspa-schsrvnet-tc.csv');
    expect(buf[0]).toBe(0xef);
    expect(buf[1]).toBe(0xbb);
    expect(buf[2]).toBe(0xbf);
    const text = decodeBytes(buf);
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(text.startsWith('Net,DIST,Sch Code,SCH_NAME')).toBe(true);
    expect(text).toContain('英皇書院');
  });
});

describe('decodeBytes - 无 BOM 与容错', () => {
  it('无 BOM UTF-8 原样解码', () => {
    expect(decodeBytes(Buffer.from('學校名稱,地址\nabc,def', 'utf8'))).toBe(
      '學校名稱,地址\nabc,def'
    );
  });

  it('坏字节以替换字符容错，不抛异常', () => {
    const bad = Buffer.from([0x41, 0x42, 0xff, 0xfd, 0x43]);
    const text = decodeBytes(bad);
    expect(text).toContain('AB');
    expect(text).toContain('C');
    expect(text).toContain('\uFFFD');
  });

  it('空输入返回空字符串', () => {
    expect(decodeBytes(Buffer.alloc(0))).toBe('');
  });
});
