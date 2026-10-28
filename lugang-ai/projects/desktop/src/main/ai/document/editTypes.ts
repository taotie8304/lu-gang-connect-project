// 鲁港通 - 文档编辑结果：只回传统计与提示，不回传修改内容与路径
import { resolve } from 'node:path';

export type DocumentEditOutcome = {
  applied: number;
  skipped: string[];
  warnings: string[];
};

export type EditedDocumentCopy = {
  name: string;
  format: 'docx' | 'xlsx' | 'pdf';
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

// 鲁港通 - 副本只写新文件：目标路径与原文件相同就立刻停手，绝不覆盖原件
export const assertCopyPathDistinct = (sourcePath: string, copyPath: string): void => {
  const normalize = (input: string) => resolve(input).replace(/\\/g, '/').toLowerCase();
  if (normalize(sourcePath) === normalize(copyPath)) {
    throw new DocumentEditError(
      'document_edit_failed',
      '副本路径与原文件相同，已停止写入，原文件没有被改动；请换一个保存位置后重试。'
    );
  }
};