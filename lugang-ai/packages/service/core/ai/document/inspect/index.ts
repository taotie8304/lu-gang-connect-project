// 鲁港通 - 文档读取入口：按扩展名分派提纲解析，并转成模型可读的紧凑说明
import path from 'node:path';
import { assertSourceBytesWithinLimit } from '../limits';
import {
  DocumentReadError,
  type DocumentFormat,
  type DocumentOutline
} from '../types';
import { inspectDocx } from './docx';
import { inspectMarkdown } from './md';
import { inspectPdf } from './pdf';
import { inspectPptx } from './pptx';
import { inspectXlsx } from './xlsx';

const SUPPORTED_EXTENSIONS: Record<string, DocumentFormat> = {
  docx: 'docx',
  xlsx: 'xlsx',
  pptx: 'pptx',
  pdf: 'pdf',
  md: 'md',
  markdown: 'md'
};

const UNSUPPORTED_MESSAGE =
  '暂不支持这种文件格式，请上传 Word（.docx）、Excel（.xlsx）、PowerPoint（.pptx）、PDF 或 Markdown（.md）文件。';

const MAX_OUTLINE_TEXT_CHARS = 12000;
const OUTLINE_TRUNCATED_NOTE = '\n\n…（提纲较长，已截断；如需完整内容请分次处理）';

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const fileTitle = (outline: DocumentOutline, formatLabel: string): string =>
  `文件「${outline.fileName}」：${formatLabel}，大小 ${formatSize(outline.sizeBytes)}。`;

const formatParagraphs = (outline: DocumentOutline): string[] => {
  const lines: string[] = [];
  lines.push(fileTitle(outline, 'Word 文档'));
  lines.push(`共 ${outline.paragraphCount ?? 0} 个段落、${outline.tableCount ?? 0} 张表格。`);
  lines.push('段落（编号从 0 开始）：');
  for (const paragraph of outline.paragraphs ?? []) {
    const style = paragraph.style ? `〔样式：${paragraph.style}〕` : '';
    lines.push(`[${paragraph.index}] ${paragraph.text}${style}`);
  }
  if (outline.paragraphsTruncated) {
    lines.push('（段落较多，仅列出前面这些段落，其余段落按编号顺延。）');
  }
  if ((outline.tables ?? []).length > 0) {
    lines.push('表格：');
    for (const table of outline.tables ?? []) {
      lines.push(
        `[${table.index}] ${table.rows} 行 × ${table.cells} 列，表头：${table.header.join(' | ') || '（空）'}`
      );
    }
  }
  lines.push(
    '可改动用 edit 动作：replace_text（可带 paragraph 限定段落）、set_paragraph、insert_paragraph、append_paragraph、set_table_cell。'
  );
  return lines;
};

const formatSheets = (outline: DocumentOutline): string[] => {
  const lines: string[] = [];
  lines.push(fileTitle(outline, 'Excel 工作簿'));
  lines.push(`共 ${outline.sheetCount ?? 0} 个工作表。`);
  for (const sheet of outline.sheets ?? []) {
    const header =
      sheet.headerRow > 0
        ? `表头在第 ${sheet.headerRow} 行：${sheet.header.join(' | ') || '（空）'}`
        : '未识别到表头行';
    lines.push(
      `工作表「${sheet.name}」：${sheet.rowCount} 行 × ${sheet.columnCount} 列，${header}`
    );
    for (const sample of sheet.samples) {
      lines.push(
        `  第 ${sample.row} 行：${sample.cells
          .map((cell) => `${cell.ref}=${cell.text}${cell.formula ? '（公式）' : ''}`)
          .join('；')}`
      );
    }
  }
  if (outline.sheetsTruncated) {
    lines.push('（工作表较多，仅列出前面这些工作表；其余工作表仍可按名称修改。）');
  }
  lines.push(
    '可改动用 edit 动作：set_cell（工作表名 + 单元格地址，如 B2）、append_row（在末尾追加一行）、replace_text（可限定工作表）。'
  );
  return lines;
};

const formatSlides = (outline: DocumentOutline): string[] => {
  const lines: string[] = [];
  lines.push(fileTitle(outline, 'PowerPoint 演示文稿'));
  lines.push(`共 ${outline.slideCount ?? 0} 页。`);
  for (const slide of outline.slides ?? []) {
    lines.push(`第 ${slide.index} 页${slide.title ? `：${slide.title}` : ''}`);
    if (slide.lines.length > 0) {
      lines.push('  其它文字：');
      for (const line of slide.lines) lines.push(`  - ${line}`);
    }
  }
  if (outline.slidesTruncated) {
    lines.push('（页数较多，仅列出前面这些页；其余页仍可用页码替换。）');
  }
  lines.push('可改动用 edit 动作：replace_text（可带 slide 指定页码，从 1 开始）。');
  return lines;
};

const formatPdf = (outline: DocumentOutline): string[] => {
  const lines: string[] = [];
  lines.push(fileTitle(outline, 'PDF 文档'));
  lines.push(
    `共 ${outline.pages ?? 0} 页，${outline.hasTextLayer ? '有可识别的文字层。' : '没有可识别的文字层。'}`
  );
  const fields = outline.fields ?? [];
  if (fields.length > 0) {
    lines.push('表单域：');
    for (const field of fields) {
      const detail: string[] = [field.type];
      if (field.options?.length) detail.push(`可选：${field.options.join(' / ')}`);
      if (field.value) detail.push(`当前值：${field.value}`);
      lines.push(`- ${field.name}（${detail.join('；')}）`);
    }
    if (outline.fieldsTruncated) lines.push('（表单域较多，仅列出前面这些字段。）');
  } else {
    lines.push('没有可填写的表单域。');
  }
  if ((outline.labels ?? []).length > 0) {
    lines.push(`文本标签：${(outline.labels ?? []).join('、')}`);
  }
  lines.push(
    '可改动用 edit 动作：fill_field（按表单域名填写文本域/下拉/单选/复选）、add_text（按文字标签叠加补充文字）。'
  );
  return lines;
};

const formatMarkdown = (outline: DocumentOutline): string[] => {
  const lines: string[] = [];
  lines.push(fileTitle(outline, 'Markdown 文本'));
  lines.push(`共 ${outline.charCount ?? 0} 字。`);
  if ((outline.headings ?? []).length > 0) {
    lines.push('标题结构：');
    for (const heading of outline.headings ?? []) {
      lines.push(`- ${'#'.repeat(heading.level)} ${heading.text}`);
    }
  }
  lines.push('正文预览：');
  lines.push(outline.preview ?? '');
  if (outline.previewTruncated) lines.push('（正文较长，预览只显示前一部分。）');
  lines.push('可改动用 edit 动作：replace_text 做全文替换（替换所有出现处），或整篇改写。');
  return lines;
};

const withWarnings = (lines: string[], outline: DocumentOutline): string => {
  const warnings = outline.warnings ?? [];
  if (warnings.length > 0) {
    lines.push('提示：');
    for (const warning of warnings) lines.push(`- ${warning}`);
  }
  const text = lines.join('\n');
  if (text.length <= MAX_OUTLINE_TEXT_CHARS) return text;
  return text.slice(0, MAX_OUTLINE_TEXT_CHARS) + OUTLINE_TRUNCATED_NOTE;
};

/** 鲁港通 - 读取源文件并输出提纲；后缀不认识或内容与后缀不符时给出可操作中文说明 */
export const inspectDocument = async (source: {
  buffer: Buffer;
  filename: string;
}): Promise<DocumentOutline> => {
  assertSourceBytesWithinLimit(source.buffer.length);

  const extension = path.extname(source.filename).toLowerCase().replace(/^\./, '');
  const format = SUPPORTED_EXTENSIONS[extension];
  if (!format) throw new DocumentReadError(UNSUPPORTED_MESSAGE);

  const common = {
    fileName: source.filename,
    sizeBytes: source.buffer.length,
    warnings: [] as string[]
  };

  switch (format) {
    case 'docx':
      return inspectDocx(source.buffer, common);
    case 'xlsx':
      return inspectXlsx(source.buffer, common);
    case 'pptx':
      return inspectPptx(source.buffer, common);
    case 'pdf':
      return inspectPdf(source.buffer, common);
    case 'md':
      return inspectMarkdown(source.buffer, common);
  }
};

/** 鲁港通 - 提纲转成工具回复：编号与提示直接可用，整体长度受控避免撑爆上下文 */
export const formatDocumentOutline = (outline: DocumentOutline): string => {
  switch (outline.format) {
    case 'docx':
      return withWarnings(formatParagraphs(outline), outline);
    case 'xlsx':
      return withWarnings(formatSheets(outline), outline);
    case 'pptx':
      return withWarnings(formatSlides(outline), outline);
    case 'pdf':
      return withWarnings(formatPdf(outline), outline);
    case 'md':
      return withWarnings(formatMarkdown(outline), outline);
  }
};
