// 鲁港通 - Markdown 提纲：标题结构与正文预览，编辑走全文替换
import { DocumentReadError, type DocumentOutline } from '../types';

const MAX_HEADINGS = 50;
const MAX_HEADING_CHARS = 120;
const MAX_PREVIEW_CHARS = 4000;

const INVALID_MD_MESSAGE =
  '这个 .md 文件不是文本内容，可能被改过后缀名；请上传真正的 Markdown 或文本文件。';

const isBinary = (buffer: Buffer): boolean => {
  const head = buffer.subarray(0, 4).toString('latin1');
  if (head.startsWith('%PDF-')) return true;
  if (head === 'PK\u0003\u0004') return true;
  return buffer.includes(0);
};

export const inspectMarkdown = (
  buffer: Buffer,
  common: { fileName: string; sizeBytes: number; warnings: string[] }
): DocumentOutline => {
  if (isBinary(buffer)) throw new DocumentReadError(INVALID_MD_MESSAGE);

  const text = buffer.toString('utf8');
  const headings: NonNullable<DocumentOutline['headings']> = [];
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    if (headings.length >= MAX_HEADINGS) break;
    headings.push({
      level: match[1].length,
      text: match[2].slice(0, MAX_HEADING_CHARS)
    });
  }

  const preview = text.slice(0, MAX_PREVIEW_CHARS);
  return {
    format: 'md',
    fileName: common.fileName,
    sizeBytes: common.sizeBytes,
    charCount: text.length,
    headings,
    preview,
    previewTruncated: text.length > preview.length,
    warnings: [...common.warnings]
  };
};
