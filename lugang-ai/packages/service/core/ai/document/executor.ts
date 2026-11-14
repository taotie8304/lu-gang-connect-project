// 鲁港通 - document_operation 服务端执行器：生成/读取/编辑文档，编辑只产出副本并上传到对话目录。
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall
} from '@fastgpt/global/core/ai/llm/type';
import { getLogger, LogCategories } from '../../../common/logger';
import type { ChatS3SourceType } from '../../../common/s3/sources/chat/type';
import { getChatFileRetentionDays } from '../../../common/s3/sources/chat/retention';
import {
  parseDocumentOperationArgs,
  type AgentLoopDocumentExecutionResult,
  type AgentLoopDocumentExecutor,
  type DocumentGenerateArgs
} from '../llm/agentLoop/interface';
import type { DocumentEditOperation } from '../llm/agentLoop/domain/systemTool/document/schema';
import { editDocx } from './edit/docx';
import { editMarkdown } from './edit/markdown';
import { editPdf } from './edit/pdf';
import { editPptx } from './edit/pptx';
import { editXlsx } from './edit/xlsx';
import { generateDocx } from './generate/docx';
import { generateMarkdown } from './generate/markdown';
import { generatePdf } from './generate/pdf';
import { generatePptx } from './generate/pptx';
import { generateXlsx } from './generate/xlsx';
import { formatDocumentOutline, inspectDocument } from './inspect';
import { DocumentSourceError, resolveDocumentSource } from './source';
import {
  DocumentEditError,
  DocumentGenerationError,
  DocumentReadError,
  type DocumentEditResult,
  type DocumentFileCard,
  type DocumentFormat
} from './types';
import { uploadDocumentFile } from './upload';

const logger = getLogger(LogCategories.MODULE.AI.AGENT);

export type CreateDocumentOperationExecutorParams = {
  sourceType: ChatS3SourceType;
  sourceId: string;
  uid: string;
  chatId: string;
};

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const generateDocumentBuffer = (args: DocumentGenerateArgs): Promise<Buffer> | Buffer => {
  switch (args.format) {
    case 'docx':
      return generateDocx(args);
    case 'xlsx':
      return generateXlsx(args);
    case 'pdf':
      return generatePdf(args);
    case 'pptx':
      return generatePptx(args);
    case 'md':
      return generateMarkdown(args);
  }
};

const UNSUPPORTED_EDIT_MESSAGE =
  '暂时不能修改这种格式的文件；支持 Word（docx）、Excel（xlsx）、PDF、Markdown（md）和 PowerPoint（pptx），请上传这些格式后再试。';
const LEGACY_EDIT_MESSAGE =
  '这个文件是旧版 Office 格式（doc/xls/ppt），请先用 Office 或 WPS 另存为 docx/xlsx/pptx 再修改。';

const resolveEditFormat = (extension: string): DocumentFormat => {
  if (extension === 'md' || extension === 'docx' || extension === 'xlsx') return extension;
  if (extension === 'pdf' || extension === 'pptx') return extension;
  if (extension === 'doc' || extension === 'xls' || extension === 'ppt') {
    throw new DocumentEditError(LEGACY_EDIT_MESSAGE);
  }
  throw new DocumentEditError(UNSUPPORTED_EDIT_MESSAGE);
};

const editDocumentBuffer = ({
  format,
  buffer,
  operations
}: {
  format: DocumentFormat;
  buffer: Buffer;
  operations: DocumentEditOperation[];
}): Promise<DocumentEditResult> => {
  switch (format) {
    case 'docx':
      return editDocx({ buffer, operations });
    case 'xlsx':
      return editXlsx({ buffer, operations });
    case 'pdf':
      return editPdf({ buffer, operations });
    case 'pptx':
      return editPptx({ buffer, operations });
    case 'md':
      return editMarkdown({ buffer, operations });
  }
};

const stripDocumentExtension = (name: string): string =>
  name.replace(/\.(docx|xlsx|pdf|md|markdown|pptx)$/i, '');

const baseDocumentName = (filename: string): string =>
  stripDocumentExtension(filename.replace(/^.*[\\/]/, '')) || '文档';

const formatEditResponse = (file: DocumentFileCard, outcome: DocumentEditResult): string => {
  const parts = [
    `已按 ${outcome.applied} 处修改生成新文件「${file.name}」（${formatSize(file.size ?? 0)}）。`
  ];
  if (outcome.skipped.length > 0) {
    const detail = outcome.skipped.slice(0, 3).join('；');
    const more = outcome.skipped.length > 3 ? ' 等' : '';
    parts.push(
      `成功 ${outcome.applied} 处，跳过 ${outcome.skipped.length} 条：${detail}${more}。`
    );
  }
  parts.push(
    `原文件保持不变，${getChatFileRetentionDays()} 天内可重复下载；还需要调整就继续告诉我。`
  );
  if (outcome.warnings.length > 0) {
    parts.push(`注意：${outcome.warnings.slice(0, 2).join('；')}。`);
  }
  return parts.join('');
};

/** 鲁港通 - 创建绑定到具体对话文件目录的文档工具执行器 */
export const createDocumentOperationExecutor = ({
  sourceType,
  sourceId,
  uid,
  chatId
}: CreateDocumentOperationExecutorParams): AgentLoopDocumentExecutor => {
  return async ({
    call
  }: {
    call: ChatCompletionMessageToolCall;
    messages: ChatCompletionMessageParam[];
  }): Promise<AgentLoopDocumentExecutionResult> => {
    const parsed = parseDocumentOperationArgs(call.function.arguments);
    if (!parsed.success) {
      return { response: parsed.error, usages: [] };
    }

    try {
      if (parsed.args.action === 'generate') {
        const buffer = await generateDocumentBuffer(parsed.args);
        const file = await uploadDocumentFile({
          sourceType,
          sourceId,
          uid,
          chatId,
          format: parsed.args.format,
          fileName: parsed.args.fileName,
          body: buffer
        });

        return {
          response: `已生成「${file.name}」（${formatSize(buffer.length)}）。文件卡片已展示在对话中，${getChatFileRetentionDays()} 天内可重复下载；需要调整内容就继续告诉我。`,
          usages: [],
          metadata: { files: [file] }
        };
      }

      if (parsed.args.action === 'edit') {
        const source = await resolveDocumentSource(parsed.args.sourceUrl);
        const format = resolveEditFormat(source.extension);
        const outcome = await editDocumentBuffer({
          format,
          buffer: source.buffer,
          operations: parsed.args.operations
        });
        const file = await uploadDocumentFile({
          sourceType,
          sourceId,
          uid,
          chatId,
          format,
          fileName: parsed.args.outputName
            ? stripDocumentExtension(parsed.args.outputName)
            : `${baseDocumentName(source.filename)}（修改版）`,
          body: outcome.buffer
        });

        return {
          response: formatEditResponse(file, outcome),
          usages: [],
          metadata: { files: [file] }
        };
      }

      const source = await resolveDocumentSource(parsed.args.sourceUrl);
      const outline = await inspectDocument(source);
      return { response: formatDocumentOutline(outline), usages: [] };
    } catch (error) {
      if (
        error instanceof DocumentGenerationError ||
        error instanceof DocumentSourceError ||
        error instanceof DocumentReadError ||
        error instanceof DocumentEditError
      ) {
        return { response: error.message, usages: [] };
      }

      logger.warn('Document operation failed', {
        action: parsed.args.action,
        error
      });
      return {
        response:
          '处理文档时出了点问题，请稍后重试；如果持续失败，可以改用更简单的内容重新生成，或换一种格式（例如 Markdown）。',
        usages: []
      };
    }
  };
};
