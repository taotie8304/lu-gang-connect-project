import type { UploadFileHandler } from '../../../worker/readFile/type';
import { readFileRawText } from '../../../worker/readFile/extension/rawText';
import { htmlToMarkdownWithUploadFile } from '../../string/utils';

/** 超过该大小的网页/纯文本仍交给重解析池，避免主线程解码与转换占用过多内存。 */
export const LIGHTWEIGHT_TEXT_PARSE_MAX_BYTES = 4 * 1024 * 1024;

/**
 * csv 不在此列：重解析通道会额外产出 formatText/tableInfo，轻量通道无法等价复现。
 */
const lightweightTextParseExtensions = new Set(['txt', 'md', 'html']);

const normalizeExtension = (extension: string) =>
  extension.trim().toLowerCase().replace(/^\./, '');

/** 仅判断扩展名是否属于轻量通道类型，不涉及大小限制。 */
export const isLightweightTextExtension = (extension: string) =>
  lightweightTextParseExtensions.has(normalizeExtension(extension));

/**
 * 判断文件是否可走独立轻量通道。
 *
 * 只放行重解析 worker 同样支持的纯文本扩展名，保证输出与重解析结果逐字节一致；
 * 大小未知时 sizeBytes 传 0，由调用方在物化后按真实大小再次判定。
 */
export const isLightweightTextParse = ({
  extension,
  sizeBytes
}: {
  extension: string;
  sizeBytes: number;
}) => {
  if (!isLightweightTextExtension(extension)) return false;
  return Math.max(0, sizeBytes) <= LIGHTWEIGHT_TEXT_PARSE_MAX_BYTES;
};

/**
 * 在主线程解析网页/纯文本：文本解码与图片处理复用重解析 worker 的实现，
 * HTML 转换交给只加载 turndown 的 htmlStr2Md worker。
 */
export const readLightweightTextContent = async ({
  extension,
  buffer,
  encoding,
  uploadFile
}: {
  extension: string;
  buffer: Buffer;
  encoding: string;
  uploadFile?: UploadFileHandler;
}): Promise<{ rawText: string }> => {
  const normalizedExtension = normalizeExtension(extension);
  const { rawText } = await readFileRawText(
    { extension: normalizedExtension, encoding, buffer },
    { uploadFile }
  );

  if (normalizedExtension !== 'html') {
    return { rawText };
  }

  return {
    rawText: await htmlToMarkdownWithUploadFile(rawText, uploadFile)
  };
};
