// 鲁港通 - 文档生成/编辑的公共类型与上限守卫：
// 生成器的调用方（工具 schema、执行器）已做一次校验，这里作为模块边界再兜底一次。
import {
  countBlockRows,
  countBlocksChars,
  countSheetsChars,
  countSheetsRows,
  MAX_GENERATED_FILE_BLOCKS,
  MAX_GENERATED_FILE_CHARS,
  MAX_GENERATED_FILE_ROWS,
  MAX_GENERATED_SHEETS,
  type GeneratedBlock,
  type GeneratedSheet
} from '../llm/agentLoop/domain/systemTool/generatedSchema';
import {
  MAX_GENERATED_SLIDES,
  type GeneratedSlide
} from '../llm/agentLoop/domain/systemTool/document/schema';

export type DocumentFormat = 'docx' | 'xlsx' | 'pdf' | 'md' | 'pptx';

export type DocumentGenerateInput = {
  format: DocumentFormat;
  fileName: string;
  title?: string;
  blocks?: GeneratedBlock[];
  sheets?: GeneratedSheet[];
  slides?: GeneratedSlide[];
  content?: string;
};

/** 鲁港通 - 面向用户的文档错误：message 为可直接展示的中文说明 */
export class DocumentGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentGenerationError';
  }
}

export const assertGenerateInputWithinLimits = (input: DocumentGenerateInput): void => {
  if ((input.blocks?.length ?? 0) > MAX_GENERATED_FILE_BLOCKS) {
    throw new DocumentGenerationError(
      `文档块数不能超过 ${MAX_GENERATED_FILE_BLOCKS} 块，请精简后再生成`
    );
  }
  if ((input.sheets?.length ?? 0) > MAX_GENERATED_SHEETS) {
    throw new DocumentGenerationError(
      `工作表不能超过 ${MAX_GENERATED_SHEETS} 个，请精简后再生成`
    );
  }
  if ((input.slides?.length ?? 0) > MAX_GENERATED_SLIDES) {
    throw new DocumentGenerationError(
      `幻灯片不能超过 ${MAX_GENERATED_SLIDES} 页，请精简后再生成`
    );
  }
  const totalChars =
    (input.content?.length ?? 0) + countBlocksChars(input.blocks) + countSheetsChars(input.sheets);
  if (totalChars > MAX_GENERATED_FILE_CHARS) {
    throw new DocumentGenerationError(
      `文件内容合计不能超过 ${MAX_GENERATED_FILE_CHARS} 字，请精简后再生成`
    );
  }
  const totalRows = countBlockRows(input.blocks) + countSheetsRows(input.sheets);
  if (totalRows > MAX_GENERATED_FILE_ROWS) {
    throw new DocumentGenerationError(
      `表格合计不能超过 ${MAX_GENERATED_FILE_ROWS} 行，请精简后再生成`
    );
  }
};
