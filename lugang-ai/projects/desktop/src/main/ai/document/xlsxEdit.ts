// 鲁港通 - Excel 副本编辑：只改目标单元格的 XML，原文件的图片、打印设置与版式原样保留，只写副本不改原件
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { GENERATED_FILE_FOLDER, resolveGeneratedFileName } from '../fileNaming';
import type { DocumentEditOperation } from '../protocol';
import {
  assertCopyPathDistinct,
  DocumentEditError,
  type EditedDocumentCopy
} from './editTypes';
import { XlsxPatchWorkbook } from './xlsxPatch';
import type { ParsedDocument } from './types';

export type EditXlsxCopyOptions = {
  document: ParsedDocument;
  operations: DocumentEditOperation[];
  outputDir: string;
  now?: Date;
};

const applyOperations = (
  workbook: XlsxPatchWorkbook,
  operations: DocumentEditOperation[]
): void => {
  for (const operation of operations) {
    if (operation.op === 'set_cell') {
      workbook.setCell({ sheet: operation.sheet, cell: operation.cell, value: operation.value });
      continue;
    }
    if (operation.op === 'append_row') {
      workbook.appendRow({ sheet: operation.sheet, values: operation.values });
      continue;
    }
    if (operation.op === 'replace_text') {
      if (operation.paragraph !== undefined) {
        workbook.noteSkipped('按段落替换只适用于 Word，已跳过');
        continue;
      }
      workbook.replaceText({
        sheet: operation.sheet,
        find: operation.find,
        replace: operation.replace
      });
      continue;
    }
    workbook.noteSkipped('段落操作只适用于 Word，已跳过');
  }
};

export const editXlsxCopy = async (options: EditXlsxCopyOptions): Promise<EditedDocumentCopy> => {
  const folder = join(options.outputDir, GENERATED_FILE_FOLDER);

  let buffer: Buffer;
  try {
    buffer = await readFile(options.document.path);
  } catch {
    throw new DocumentEditError(
      'document_edit_failed',
      '无法读取这个 Excel 文件，可能已被移动或删除；请重新打开文件后再试。'
    );
  }

  let workbook: XlsxPatchWorkbook;
  try {
    workbook = new XlsxPatchWorkbook(buffer);
  } catch {
    throw new DocumentEditError(
      'document_edit_failed',
      '无法读取这个 Excel 文件，可能已损坏或不是 .xlsx 格式；请用 Excel 另存为 .xlsx 后再试。'
    );
  }

  applyOperations(workbook, options.operations);

  const outcome = workbook.outcome;
  if (outcome.applied === 0) {
    const detail = outcome.skipped.slice(0, 3).join('；');
    throw new DocumentEditError(
      'document_no_change',
      `没有找到与要求匹配的内容，未生成副本。${detail ? `${detail}。` : ''}请核对工作表或单元格后重试。`
    );
  }

  await mkdir(folder, { recursive: true });
  const baseName = basename(options.document.name, extname(options.document.name));
  const name = resolveGeneratedFileName({
    fileName: `${baseName}-已修改`,
    format: 'xlsx',
    exists: (candidate) => existsSync(join(folder, candidate)),
    ...(options.now ? { now: options.now } : {})
  });
  const path = join(folder, name);
  // 鲁港通 - 只写副本：解析出来的目标路径与原文件相同时拒绝写入
  assertCopyPathDistinct(options.document.path, path);

  try {
    await writeFile(path, workbook.toBuffer());
  } catch {
    throw new DocumentEditError(
      'document_edit_failed',
      '修改副本没有保存成功，请确认文件未被其他程序占用、磁盘空间充足后重试。'
    );
  }

  const warnings = new Set([...(options.document.warnings ?? []), ...outcome.warnings]);

  return {
    name,
    format: 'xlsx',
    folder: GENERATED_FILE_FOLDER,
    path,
    applied: outcome.applied,
    skipped: outcome.skipped,
    warnings: [...warnings]
  };
};
