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

/** 鲁港通 - 读取提纲：只给模型可定位的结构与摘要，不携带整篇正文 */
export type DocumentOutlineParagraph = { index: number; text: string; style?: string };

export type DocumentOutlineTable = {
  index: number;
  rows: number;
  cells: number;
  header: string[];
};

export type DocumentOutlineSheetSample = {
  row: number;
  cells: Array<{ ref: string; text: string; formula?: boolean }>;
};

export type DocumentOutlineSheet = {
  name: string;
  rowCount: number;
  columnCount: number;
  headerRow: number;
  header: string[];
  samples: DocumentOutlineSheetSample[];
};

export type DocumentOutlineSlide = { index: number; title: string; lines: string[] };

export type DocumentOutlinePdfFieldType =
  | 'text'
  | 'dropdown'
  | 'optionlist'
  | 'radio'
  | 'checkbox'
  | 'other';

export type DocumentOutlinePdfField = {
  name: string;
  type: DocumentOutlinePdfFieldType;
  options?: string[];
  value?: string;
};

export type DocumentOutline = {
  format: DocumentFormat;
  fileName: string;
  sizeBytes: number;
  warnings: string[];
  paragraphs?: DocumentOutlineParagraph[];
  paragraphCount?: number;
  paragraphsTruncated?: boolean;
  tables?: DocumentOutlineTable[];
  tableCount?: number;
  sheets?: DocumentOutlineSheet[];
  sheetCount?: number;
  sheetsTruncated?: boolean;
  slides?: DocumentOutlineSlide[];
  slideCount?: number;
  slidesTruncated?: boolean;
  images?: string[];
  pages?: number;
  hasTextLayer?: boolean;
  labels?: string[];
  fields?: DocumentOutlinePdfField[];
  fieldsTruncated?: boolean;
  charCount?: number;
  headings?: Array<{ level: number; text: string }>;
  preview?: string;
  previewTruncated?: boolean;
};

/** 鲁港通 - 面向用户的文档读取错误：message 为可直接展示的中文说明 */
export class DocumentReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentReadError';
  }
}

/** 鲁港通 - 编辑结果：新文件内容与「成功/跳过」统计，由执行器决定是否上传 */
export type DocumentEditResult = {
  buffer: Buffer;
  applied: number;
  skipped: string[];
  warnings: string[];
};

/** 鲁港通 - 面向用户的文档编辑错误：message 为可直接展示的中文说明 */
export class DocumentEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentEditError';
  }
}

/** 鲁港通 - 工具返回给聊天文件卡片的最小字段；与 AIChatItemValue.files 的结构保持一致 */
export type DocumentFileCard = {
  key: string;
  name: string;
  format: DocumentFormat;
  size?: number;
};

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
