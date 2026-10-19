// 鲁港通 - 本地生成 Word/Excel/PDF：文件只写到本机下载目录，不经服务器
import { BrowserWindow, app } from 'electron';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx';
import ExcelJS from 'exceljs';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AiFileGenerator,
  AiFileGeneratorInput,
  AiGeneratedFile
} from './executor';
import { GENERATED_FILE_FOLDER, resolveGeneratedFileName } from './fileNaming';

const CONTENT_LINE_BREAK = /\r\n?/g;
const INVALID_SHEET_NAME = /[\\/*?:[\]]/g;
const MAX_SHEET_NAME_LENGTH = 31;

export const getGeneratedFileFolder = (downloadsDir?: string): string =>
  join(downloadsDir ?? app.getPath('downloads'), GENERATED_FILE_FOLDER);

const splitLines = (content?: string): string[] =>
  content?.trim() ? content.replace(CONTENT_LINE_BREAK, '\n').split('\n') : [];

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildDocx = async (input: AiFileGeneratorInput): Promise<Buffer> => {
  const children: (Paragraph | Table)[] = [];
  if (input.title?.trim()) {
    children.push(
      new Paragraph({ text: input.title.trim(), heading: HeadingLevel.HEADING_1 })
    );
  }

  const lines = splitLines(input.content);
  if (lines.length > 0) {
    for (const line of lines) {
      children.push(new Paragraph({ children: [new TextRun(line)] }));
    }
  }

  if (input.rows?.length) {
    if (children.length > 0) children.push(new Paragraph(''));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: input.rows.map(
          (row) =>
            new TableRow({
              children: row.map(
                (cell) => new TableCell({ children: [new Paragraph(cell)] })
              )
            })
        )
      })
    );
  }

  if (children.length === 0) children.push(new Paragraph(''));
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
};

const resolveSheetName = (title?: string): string => {
  const name = (title ?? '')
    .replace(INVALID_SHEET_NAME, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SHEET_NAME_LENGTH)
    .replace(/[. ]+$/g, '');
  return name || 'Sheet1';
};

const resolveSheetRows = (input: AiFileGeneratorInput): string[][] => {
  if (input.rows?.length) return input.rows;
  return splitLines(input.content).map((line) => [line]);
};

const autofitColumns = (sheet: ExcelJS.Worksheet, rows: string[][]): void => {
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  for (let index = 1; index <= columnCount; index += 1) {
    const longest = rows.reduce((max, row) => {
      const value = row[index - 1] ?? '';
      return Math.max(max, value.length);
    }, 0);
    sheet.getColumn(index).width = Math.min(60, Math.max(12, longest + 2));
  }
};

const buildXlsx = async (input: AiFileGeneratorInput): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(resolveSheetName(input.title));
  const rows = resolveSheetRows(input);

  if (input.title?.trim()) {
    sheet.addRow([input.title.trim()]);
    if (rows.length > 0) sheet.addRow([]);
  }
  for (const row of rows) sheet.addRow(row);
  autofitColumns(sheet, input.title?.trim() ? [[input.title.trim()], ...rows] : rows);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

const buildPdfHtml = (input: AiFileGeneratorInput): string => {
  const title = input.title?.trim();
  const lines = splitLines(input.content);
  const rows = input.rows ?? [];
  const tableRows = rows
    .map((row, index) => {
      const tag = index === 0 ? 'th' : 'td';
      const cells = row.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  const body = [
    title ? `<h1>${escapeHtml(title)}</h1>` : '',
    ...lines.map((line) => `<p>${escapeHtml(line)}</p>`),
    tableRows ? `<table>${tableRows}</table>` : ''
  ].join('');

  // 鲁港通 - PDF 由系统浏览器内核渲染，显式指定中文字体避免乱码
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
@page { size: A4; margin: 20mm 18mm; }
body { font-family: "Microsoft YaHei", "PingFang SC", "SimSun", sans-serif; font-size: 12pt; line-height: 1.7; color: #111; }
h1 { font-size: 18pt; text-align: center; margin: 0 0 18px; }
p { margin: 0 0 8px; white-space: pre-wrap; word-break: break-word; }
table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10.5pt; }
th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #f2f2f2; }
</style>
</head>
<body>${body}</body>
</html>`;
};

const buildPdf = async (input: AiFileGeneratorInput): Promise<Buffer> => {
  const page = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  try {
    const url = `data:text/html;charset=UTF-8,${encodeURIComponent(buildPdfHtml(input))}`;
    await page.loadURL(url);
    return await page.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
  } finally {
    if (!page.isDestroyed()) page.destroy();
  }
};

const renderFile = async (input: AiFileGeneratorInput): Promise<Buffer> => {
  if (input.format === 'docx') return buildDocx(input);
  if (input.format === 'xlsx') return buildXlsx(input);
  return buildPdf(input);
};

export type CreateFileGeneratorOptions = {
  downloadsDir?: string;
  now?: () => Date;
};

export const createFileGenerator = (
  options: CreateFileGeneratorOptions = {}
): AiFileGenerator => {
  return async (input: AiFileGeneratorInput): Promise<AiGeneratedFile> => {
    const folder = getGeneratedFileFolder(options.downloadsDir);
    await mkdir(folder, { recursive: true });

    const now = options.now?.();
    const name = resolveGeneratedFileName({
      fileName: input.fileName,
      format: input.format,
      exists: (candidate) => existsSync(join(folder, candidate)),
      ...(now ? { now } : {})
    });
    const filePath = join(folder, name);
    const buffer = await renderFile(input);
    await writeFile(filePath, buffer);

    return { name, format: input.format, folder, path: filePath };
  };
};
