// 鲁港通 - document_operation 服务端执行器：生成文件后上传到对话目录；读取与编辑在第三批接通。
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
import { generateDocx } from './generate/docx';
import { generateMarkdown } from './generate/markdown';
import { generatePdf } from './generate/pdf';
import { generatePptx } from './generate/pptx';
import { generateXlsx } from './generate/xlsx';
import { formatDocumentOutline, inspectDocument } from './inspect';
import { DocumentSourceError, resolveDocumentSource } from './source';
import { DocumentGenerationError, DocumentReadError } from './types';
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

      const source = await resolveDocumentSource(parsed.args.sourceUrl);
      const outline = await inspectDocument(source);
      return { response: formatDocumentOutline(outline), usages: [] };
    } catch (error) {
      if (
        error instanceof DocumentGenerationError ||
        error instanceof DocumentSourceError ||
        error instanceof DocumentReadError
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
