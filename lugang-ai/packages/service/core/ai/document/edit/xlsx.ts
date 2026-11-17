// 鲁港通 - Excel 编辑：分派单元格补丁，非 Excel 操作跳过并说明；未命中不产出新文件
import type { DocumentEditOperation } from '../../llm/agentLoop/domain/systemTool/document/schema';
import { hasZipMagic } from '../limits';
import { DocumentEditError, type DocumentEditResult } from '../types';
import {
  XLSX_EDIT_FAILED_MESSAGE,
  XLSX_UNREADABLE_MESSAGE,
  XlsxPatchWorkbook
} from './xlsxPatch';

const applyOperation = async (
  workbook: XlsxPatchWorkbook,
  operation: DocumentEditOperation
): Promise<void> => {
  if (operation.op === 'set_cell') {
    return workbook.setCell({ sheet: operation.sheet, cell: operation.cell, value: operation.value });
  }
  if (operation.op === 'append_row') {
    return workbook.appendRow({ sheet: operation.sheet, values: operation.values });
  }
  if (operation.op === 'replace_text') {
    if (operation.paragraph !== undefined) {
      return workbook.noteSkipped('「按段落替换」只适用于 Word，已跳过');
    }
    if (operation.slide !== undefined) {
      return workbook.noteSkipped('「按幻灯片替换」只适用于 PowerPoint，已跳过');
    }
    return workbook.replaceText({
      sheet: operation.sheet,
      find: operation.find,
      replace: operation.replace
    });
  }
  if (
    operation.op === 'set_paragraph' ||
    operation.op === 'insert_paragraph' ||
    operation.op === 'append_paragraph'
  ) {
    return workbook.noteSkipped('段落操作只适用于 Word，已跳过');
  }
  if (operation.op === 'set_table_cell') {
    return workbook.noteSkipped('表格单元格操作只适用于 Word，已跳过');
  }
  if (
    operation.op === 'replace_image' ||
    operation.op === 'delete_slide' ||
    operation.op === 'move_slide'
  ) {
    return workbook.noteSkipped('图片替换、删除页与页序调整只适用于 PowerPoint，已跳过');
  }
  return workbook.noteSkipped('填写表单与叠加文字只适用于 PDF，已跳过');
};

/** 鲁港通 - 编辑 Excel：只改目标工作表 XML，其余 zip 部件原样保留；未命中不产出新文件 */
export const editXlsx = async ({
  buffer,
  operations
}: {
  buffer: Buffer;
  operations: DocumentEditOperation[];
}): Promise<DocumentEditResult> => {
  if (!hasZipMagic(buffer)) throw new DocumentEditError(XLSX_UNREADABLE_MESSAGE);

  const workbook = await XlsxPatchWorkbook.load(buffer);
  for (const operation of operations) await applyOperation(workbook, operation);

  const outcome = workbook.outcome;
  if (outcome.applied === 0) {
    const detail = outcome.skipped.slice(0, 3).join('；');
    throw new DocumentEditError(
      `没有找到与要求匹配的内容，未生成新文件。${detail ? `${detail}。` : ''}请核对工作表或单元格后重试。`
    );
  }

  let output: Buffer;
  try {
    output = await workbook.toBuffer();
  } catch {
    throw new DocumentEditError(XLSX_EDIT_FAILED_MESSAGE);
  }

  return {
    buffer: output,
    applied: outcome.applied,
    skipped: outcome.skipped,
    warnings: outcome.warnings
  };
};
