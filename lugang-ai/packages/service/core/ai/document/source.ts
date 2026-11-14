// 鲁港通 - 文档编辑的源文件解析：sourceUrl 必须来自本次对话文件清单，读取前校验大小上限。
import path from 'node:path';
import { materializeFileSource } from '../../../common/file/read/source';
import { getWorkflowFileContext } from '../../workflow/utils/context';
import { MAX_DOCUMENT_SOURCE_BYTES, SOURCE_TOO_LARGE_MESSAGE } from './limits';

const SOURCE_READ_TIMEOUT_MS = 60 * 1000;

const MISSING_FILE_CONTEXT_MESSAGE =
  '只能修改本次对话里上传的文件，请先上传文件后再让我读取或修改。';
const UNREGISTERED_FILE_MESSAGE =
  '这个文件不在本次对话的文件清单里，只能读取或修改本次对话上传的文件。请重新上传后再试。';
const FILE_READ_FAILED_MESSAGE = '读取文件内容失败，请重新上传后再试。';

/** 鲁港通 - 面向用户的源文件错误：message 为可直接展示的中文说明 */
export class DocumentSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentSourceError';
  }
}

export type ResolvedDocumentSource = {
  buffer: Buffer;
  filename: string;
  extension: string;
};

const normalizeExtension = (filename: string) => {
  const extension = path.extname(filename).toLowerCase().replace(/^\./, '');
  return extension === 'markdown' ? 'md' : extension;
};

/** 鲁港通 - 从当前工作流文件上下文取内容；未登记地址、超限与读取失败都转成可操作提示 */
export const resolveDocumentSource = async (
  sourceUrl: string
): Promise<ResolvedDocumentSource> => {
  const fileContext = getWorkflowFileContext();
  if (!fileContext) throw new DocumentSourceError(MISSING_FILE_CONTEXT_MESSAGE);

  const ref = fileContext.resolve(sourceUrl);
  if (!ref) throw new DocumentSourceError(UNREGISTERED_FILE_MESSAGE);

  const { source } = await fileContext.getSource(ref).catch(() => {
    throw new DocumentSourceError(FILE_READ_FAILED_MESSAGE);
  });

  if (source.kind === 's3' && source.sizeBytes > MAX_DOCUMENT_SOURCE_BYTES) {
    throw new DocumentSourceError(SOURCE_TOO_LARGE_MESSAGE);
  }

  const { buffer, metadata } = await materializeFileSource(source, {
    signal: AbortSignal.timeout(SOURCE_READ_TIMEOUT_MS),
    onReadBytes: (readBytes) => {
      if (readBytes > MAX_DOCUMENT_SOURCE_BYTES) {
        throw new DocumentSourceError(SOURCE_TOO_LARGE_MESSAGE);
      }
    }
  }).catch((error) => {
    if (error instanceof DocumentSourceError) throw error;
    throw new DocumentSourceError(FILE_READ_FAILED_MESSAGE);
  });

  if (buffer.length > MAX_DOCUMENT_SOURCE_BYTES) {
    throw new DocumentSourceError(SOURCE_TOO_LARGE_MESSAGE);
  }

  const filename = metadata.filename || ref.name || 'document';
  return {
    buffer,
    filename,
    extension: normalizeExtension(filename)
  };
};
