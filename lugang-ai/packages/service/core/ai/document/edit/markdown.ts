// 鲁港通 - Markdown 编辑：整篇文字替换并统计命中次数，结构化修改项说明不支持
import type { DocumentEditOperation } from '../../llm/agentLoop/domain/systemTool/document/schema';
import { DocumentEditError, type DocumentEditResult } from '../types';

const PARAGRAPH_NOTE = '段落与表格操作只适用于 Word，已跳过';
const CELL_NOTE = '单元格与追加行操作只适用于 Excel，已跳过';
const PDF_NOTE = '填写表单与叠加文字只适用于 PDF，已跳过';

const countOccurrences = (text: string, needle: string): number => {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (true) {
    const index = text.indexOf(needle, from);
    if (index < 0) return count;
    count += 1;
    from = index + needle.length;
  }
};

export const editMarkdown = async ({
  buffer,
  operations
}: {
  buffer: Buffer;
  operations: DocumentEditOperation[];
}): Promise<DocumentEditResult> => {
  let content = buffer.toString('utf8');
  let applied = 0;
  const skipped: string[] = [];
  const warnings: string[] = [];

  for (const operation of operations) {
    if (operation.op === 'replace_text') {
      if (
        operation.paragraph !== undefined ||
        operation.sheet !== undefined ||
        operation.slide !== undefined
      ) {
        skipped.push('Markdown 不支持按段落、工作表或幻灯片限定替换，已跳过');
        continue;
      }
      const matches = countOccurrences(content, operation.find);
      if (matches === 0) {
        skipped.push(`没有找到「${operation.find}」，已跳过`);
        continue;
      }
      content = content.split(operation.find).join(operation.replace);
      applied += matches;
      continue;
    }

    if (operation.op === 'fill_field' || operation.op === 'add_text') {
      skipped.push(PDF_NOTE);
      continue;
    }
    if (operation.op === 'set_cell' || operation.op === 'append_row') {
      skipped.push(CELL_NOTE);
      continue;
    }
    if (
      operation.op === 'replace_image' ||
      operation.op === 'delete_slide' ||
      operation.op === 'move_slide'
    ) {
      skipped.push('图片替换、删除页与页序调整只适用于 PowerPoint，已跳过');
      continue;
    }
    skipped.push(PARAGRAPH_NOTE);
  }

  if (applied === 0) {
    const detail = skipped.slice(0, 3).join('；');
    throw new DocumentEditError(
      `没有找到与要求匹配的内容，未生成新文件。${detail ? `${detail}。` : ''}请核对要替换的文字后重试。`
    );
  }

  return { buffer: Buffer.from(content, 'utf8'), applied, skipped, warnings };
};
