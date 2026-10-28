// 鲁港通 - 本机文档结构：locator 只在本机编辑时使用，提纲不含文件路径与整篇正文

export type DocumentFormat = 'docx' | 'xlsx';

export type DocumentParagraph = {
  index: number;
  text: string;
  style?: string;
};

export type DocumentTable = {
  index: number;
  rows: number;
  cells: number;
  header: string[];
};

export type DocumentSheet = {
  name: string;
  rowCount: number;
  columnCount: number;
  headerRow?: number;
  header: string[];
  sampleRows: string[][];
  sampleRowNumbers?: number[];
  // 鲁港通 - 表单类工作表行数多时补充首列标签，模型才能按行填写
  rowLabels?: Array<{ row: number; text: string }>;
  rowLabelsTruncated?: boolean;
};

export type DocumentSummary = {
  format: DocumentFormat;
  name: string;
  paragraphs?: DocumentParagraph[];
  tables?: DocumentTable[];
  paragraphsTruncated?: boolean;
  sheets?: DocumentSheet[];
  sheetsTruncated?: boolean;
  warnings?: string[];
};

export type ParsedDocument = DocumentSummary & { path: string };

export type RawDocumentOutline = Omit<DocumentSummary, 'name' | 'path'>;

export type DocumentParseErrorCode = 'unsupported_format' | 'document_parse_failed';

export class DocumentParseError extends Error {
  readonly code: DocumentParseErrorCode;

  constructor(code: DocumentParseErrorCode, message: string) {
    super(message);
    this.name = 'DocumentParseError';
    this.code = code;
  }
}