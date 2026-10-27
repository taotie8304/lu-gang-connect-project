// 鲁港通 - 文档编辑结果：只回传统计与提示，不回传修改内容与路径

export type DocumentEditOutcome = {
  applied: number;
  skipped: string[];
  warnings: string[];
};

export type EditedDocumentCopy = {
  name: string;
  format: 'docx' | 'xlsx';
  folder: string;
  path: string;
  applied: number;
  skipped: string[];
  warnings: string[];
};

export type DocumentEditErrorCode = 'document_no_change' | 'document_edit_failed';

export class DocumentEditError extends Error {
  readonly code: DocumentEditErrorCode;

  constructor(code: DocumentEditErrorCode, message: string) {
    super(message);
    this.name = 'DocumentEditError';
    this.code = code;
  }
}