// 鲁港通 - 字节解码层：BOM 检测 + UTF-16 LE / UTF-8（容错）
// 数据源实测（r29）：全部学校数据文件均为 UTF-8 BOM 或 UTF-16 LE，无 Big5

const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
const utf16leDecoder = new TextDecoder('utf-16le', { fatal: false });

/**
 * 将原始字节解码为文本。
 * - `FF FE` 开头 → UTF-16 LE（去 BOM）
 * - `EF BB BF` 开头 → UTF-8（去 BOM）
 * - 其余 → UTF-8；坏字节以替换字符（U+FFFD）容错，不抛异常
 */
export function decodeBytes(buf: Buffer | Uint8Array): string {
  if (buf.length === 0) return '';
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return utf16leDecoder.decode(buf.subarray(2));
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return utf8Decoder.decode(buf.subarray(3));
  }
  return utf8Decoder.decode(buf);
}
