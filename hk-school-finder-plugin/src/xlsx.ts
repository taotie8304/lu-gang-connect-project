// 鲁港通 - 极简 XLSX 读取器（零依赖：node:zlib 解压 + 手写 ZIP/XML 提取）
// 用途：读取官方统计文件（Statistics_by_district_C.xlsx）的工作表名与单元格矩阵。
// 覆盖子集：共享字符串 / 数值 / 内联字符串；行按 r 属性定位并补空行，列按 r 属性定位并补空串。
import { inflateRawSync } from 'node:zlib';

export interface XlsxSheet {
  /** 工作表名（workbook.xml 原文，如「表3(b)」） */
  name: string;
  /** 单元格矩阵（0 基：rows[行][列]，缺省为空串；行数 = 网格最大行号，官方省略的缺失行补空行） */
  rows: string[][];
}

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

/** 在文件末尾扫描 End of Central Directory（兼容 ZIP 注释，最长 65557 字节） */
function findEocd(buf: Buffer): number {
  const min = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new Error('无法解析 XLSX 文件：未找到 ZIP 目录（不是有效的 Excel 文档）。');
}

/** 解出 ZIP 全部条目（name → 解压内容；支持 stored / deflate 两种压缩方式） */
function readZipEntries(buf: Buffer): Map<string, Buffer> {
  const eocd = findEocd(buf);
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  const entries = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(ptr) !== CEN_SIG) throw new Error('无法解析 XLSX 文件：ZIP 目录损坏。');
    const method = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    if (buf.readUInt32LE(localOffset) !== LOC_SIG) throw new Error('无法解析 XLSX 文件：ZIP 条目损坏。');
    // 本地头：30 字节固定部分 + 文件名 + 扩展区，之后是压缩数据
    const dataStart =
      localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const raw = buf.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) entries.set(name, Buffer.from(raw));
    else if (method === 8) entries.set(name, inflateRawSync(raw));
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** XML 字符实体解码（&amp; / &#x4e2d; / &#20013; 等） */
function decodeXmlText(s: string): string {
  return s.replace(
    /&(?:#x([0-9a-fA-F]+)|#(\d+)|(amp|lt|gt|quot|apos));/g,
    (whole: string, hex?: string, dec?: string, name?: string) => {
      if (hex) {
        const cp = parseInt(hex, 16);
        return Number.isFinite(cp) ? String.fromCodePoint(cp) : whole;
      }
      if (dec) {
        const cp = parseInt(dec, 10);
        return Number.isFinite(cp) ? String.fromCodePoint(cp) : whole;
      }
      return (name && XML_ENTITIES[name]) ?? whole;
    }
  );
}

/** 逐个收集全局匹配（含捕获组） */
function matchAll(re: RegExp, text: string): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m);
  return out;
}

/** 解析标签属性（名称="值"），值做实体解码 */
function parseAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g, tag)) {
    out[m[1]] = decodeXmlText(m[2]);
  }
  return out;
}

/** 工作表清单：name + r:id（保持 workbook.xml 顺序） */
function workbookSheets(xml: string): Array<{ name: string; rid: string }> {
  const out: Array<{ name: string; rid: string }> = [];
  for (const m of matchAll(/<sheet\b[^>]*?(?:\/>|>)/g, xml)) {
    const a = parseAttrs(m[0]);
    if (a.name && a['r:id']) out.push({ name: a.name, rid: a['r:id'] });
  }
  return out;
}

/** 关系映射：Id → Target */
function relTargets(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of matchAll(/<Relationship\b[^>]*?(?:\/>|>)/g, xml)) {
    const a = parseAttrs(m[0]);
    if (a.Id && a.Target) map.set(a.Id, a.Target);
  }
  return map;
}

/** 目标路径归一：相对路径补 xl/ 前缀，绝对路径去前导斜杠 */
function resolveTarget(target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  if (target.startsWith('xl/')) return target;
  return `xl/${target}`;
}

/** 共享字符串表（含富文本 run；剔除注音 rPh 避免混入） */
function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const m of matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g, xml)) {
    const body = (m[1] ?? '').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    let text = '';
    for (const t of matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g, body)) {
      text += t[1] ?? '';
    }
    out.push(decodeXmlText(text));
  }
  return out;
}

/** 单元格值：t=s 共享字符串 / inlineStr 内联字符串 / 其余取 v 原文（数值直接保留文本） */
function cellValue(attrs: Record<string, string>, inner: string | undefined, shared: string[]): string {
  const body = inner ?? '';
  if (attrs.t === 'inlineStr') {
    const isMatch = /<is\b[^>]*>([\s\S]*?)<\/is>/.exec(body);
    let text = '';
    if (isMatch) {
      for (const t of matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g, isMatch[1])) {
        text += t[1] ?? '';
      }
    }
    return decodeXmlText(text);
  }
  const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body);
  const raw = v ? decodeXmlText(v[1]) : '';
  if (attrs.t === 's') {
    const i = parseInt(raw, 10);
    return shared[i] ?? '';
  }
  return raw;
}

/** 列引用（如「K7」）→ 0 基列号；无法解析返回 -1 */
function colIndexOf(ref: string): number {
  let n = 0;
  let seen = false;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) {
      n = n * 26 + (c - 64);
      seen = true;
    } else if (c >= 97 && c <= 122) {
      n = n * 26 + (c - 96);
      seen = true;
    } else {
      break;
    }
  }
  return seen ? n - 1 : -1;
}

/** 解析工作表：按 r 属性定位行/列，稀疏处补空串；行数覆盖最后一行 */
function parseSheetRows(xml: string, shared: string[]): string[][] {
  const sparse: string[][] = [];
  let seq = 0;
  for (const rm of matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g, xml)) {
    const rowAttrs = parseAttrs(/<row\b[^>]*?\/?>/.exec(rm[0])?.[0] ?? '');
    const rowNum = rowAttrs.r ? parseInt(rowAttrs.r, 10) : ++seq;
    const idx = rowNum - 1;
    while (sparse.length <= idx) sparse.push([]);
    const cells = sparse[idx];
    let lastCol = -1;
    for (const cm of matchAll(/<c\b[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g, rm[1] ?? '')) {
      const cAttrs = parseAttrs(/<c\b[^>]*?\/?>/.exec(cm[0])?.[0] ?? '');
      const ci = cAttrs.r ? colIndexOf(cAttrs.r) : -1;
      const col = ci >= 0 ? ci : lastCol + 1;
      cells[col] = cellValue(cAttrs, cm[1], shared);
      lastCol = col;
    }
  }
  let width = 0;
  for (const r of sparse) width = Math.max(width, r.length);
  return sparse.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''));
}

/**
 * 读取 XLSX：返回全部工作表（名称 + 单元格矩阵）。
 * 解析失败抛可操作中文错误（上层转 tips 并提示不要重试）。
 */
export function readXlsx(bytes: Uint8Array): XlsxSheet[] {
  const buf = Buffer.isBuffer(bytes)
    ? bytes
    : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = readZipEntries(buf);
  const workbookXml = entries.get('xl/workbook.xml')?.toString('utf8');
  if (!workbookXml) throw new Error('无法解析 XLSX 文件：缺少工作表定义（不是有效的 Excel 文档）。');
  const relsXml = entries.get('xl/_rels/workbook.xml.rels')?.toString('utf8');
  const rels = relsXml ? relTargets(relsXml) : new Map<string, string>();
  const sharedXml = entries.get('xl/sharedStrings.xml')?.toString('utf8');
  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];
  return workbookSheets(workbookXml).map(({ name, rid }) => {
    const target = rels.get(rid);
    const data = target ? entries.get(resolveTarget(target)) : undefined;
    return { name, rows: data ? parseSheetRows(data.toString('utf8'), shared) : [] };
  });
}
