// 鲁港通 - 注册资料 XML 分块提取器（115MB 级文件不整树 DOM；按记录标签字符串扫描）
// 数据特征（2026-09-17 实测）：CRLF 行尾；字段值大量尾随空格；值内含 XML 实体（&amp; / &#x20;）

/** 解码 XML 实体（数字实体 + 五个预定义实体；&amp; 最后解码避免二次解码） */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * 流式扫描记录块（大文件场景避免一次性数组堆积）；返回命中块数。
 * visit 收到记录标签之间的原始块文本。
 */
export function scanBlocks(xml: string, tag: string, visit: (block: string) => void): number {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  let pos = 0;
  let count = 0;
  for (;;) {
    const s = xml.indexOf(open, pos);
    if (s === -1) break;
    const e = xml.indexOf(close, s + open.length);
    if (e === -1) break;
    visit(xml.slice(s + open.length, e));
    pos = e + close.length;
    count += 1;
  }
  return count;
}

/** 按记录标签切块；标签不存在返回空数组（小文件/测试用；大文件用 scanBlocks） */
export function extractBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  scanBlocks(xml, tag, (b) => blocks.push(b));
  return blocks;
}

/**
 * 提取单个字段值：实体解码 + 值内换行归一为空格 + 首尾空白清理；缺失或空值返回 undefined。
 * 值内多空格有意保留（官方原文形式）。
 */
export function getField(block: string, name: string): string | undefined {
  const open = `<${name}>`;
  const close = `</${name}>`;
  const s = block.indexOf(open);
  if (s === -1) return undefined;
  const e = block.indexOf(close, s + open.length);
  if (e === -1) return undefined;
  const value = decodeEntities(block.slice(s + open.length, e))
    .replace(/\s*[\r\n]+\s*/g, ' ')
    .trim();
  return value === '' ? undefined : value;
}
