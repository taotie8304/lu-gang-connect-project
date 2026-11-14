// 鲁港通 - 生成文件的对话目录上传：统一清洗文件名、按对话补序号并写入保留时间。
import { addDays } from 'date-fns';
import { getS3ChatSource } from '../../../common/s3/sources/chat';
import { getChatFileRetentionDays } from '../../../common/s3/sources/chat/retention';
import type { ChatS3SourceType } from '../../../common/s3/sources/chat/type';
import type { DocumentFileCard, DocumentFormat } from './types';

export const DOCUMENT_FORMAT_META: Record<
  DocumentFormat,
  { extension: string; contentType: string }
> = {
  docx: {
    extension: 'docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  },
  xlsx: {
    extension: 'xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  },
  pdf: { extension: 'pdf', contentType: 'application/pdf' },
  md: { extension: 'md', contentType: 'text/markdown; charset=utf-8' },
  pptx: {
    extension: 'pptx',
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }
};

const MAX_FILE_NAME_CHARS = 80;
const CONTROL_AND_RESERVED = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const TRACKED_SCOPE_LIMIT = 200;
const usedNamesByScope = new Map<string, Set<string>>();

/** 鲁港通 - 文件名清洗：去掉路径分隔符与控制字符，压缩空白，长度按 80 字截断 */
export const sanitizeDocumentFileName = (raw: string): string => {
  const cleaned = raw
    .replace(CONTROL_AND_RESERVED, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');
  const limited = Array.from(cleaned).slice(0, MAX_FILE_NAME_CHARS).join('');
  return limited || '文档';
};

const reserveDocumentFileName = (scopeKey: string, baseName: string): string => {
  let usedNames = usedNamesByScope.get(scopeKey);
  if (!usedNames) {
    if (usedNamesByScope.size >= TRACKED_SCOPE_LIMIT) {
      const oldestScope = usedNamesByScope.keys().next().value;
      if (oldestScope !== undefined) usedNamesByScope.delete(oldestScope);
    }
    usedNames = new Set();
    usedNamesByScope.set(scopeKey, usedNames);
  }

  const normalized = baseName.toLowerCase();
  if (!usedNames.has(normalized)) {
    usedNames.add(normalized);
    return baseName;
  }

  let index = 2;
  while (usedNames.has(`${normalized}(${index})`)) index += 1;
  usedNames.add(`${normalized}(${index})`);
  return `${baseName}(${index})`;
};

export type UploadDocumentFileParams = {
  sourceType: ChatS3SourceType;
  sourceId: string;
  uid: string;
  chatId: string;
  format: DocumentFormat;
  fileName: string;
  body: Buffer;
};

/** 鲁港通 - 生成文件落到对话目录，返回聊天文件卡片字段 */
export const uploadDocumentFile = async ({
  sourceType,
  sourceId,
  uid,
  chatId,
  format,
  fileName,
  body
}: UploadDocumentFileParams): Promise<DocumentFileCard> => {
  const scopeKey = [sourceType, sourceId, uid, chatId].join('/');
  const meta = DOCUMENT_FORMAT_META[format];
  const baseName = reserveDocumentFileName(scopeKey, sanitizeDocumentFileName(fileName));
  const name = `${baseName}.${meta.extension}`;

  const { key } = await getS3ChatSource().uploadChatFile({
    sourceType,
    sourceId,
    chatId,
    uId: uid,
    filename: name,
    body,
    contentType: meta.contentType,
    expiredTime: addDays(new Date(), getChatFileRetentionDays())
  });

  return {
    key,
    name,
    format,
    size: body.length
  };
};
