// 鲁港通 - 本地生成 Word/Excel/PDF：文件只写到本机下载目录，不经服务器
import { BrowserWindow, app } from 'electron';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
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
import type { GeneratedDocBlock, GeneratedSheet } from './protocol';
import { GENERATED_FILE_FOLDER, resolveGeneratedFileName } from './fileNaming';
import { isSafeFormula } from './formulaSafety';

const CONTENT_LINE_BREAK = /\r\n?/g;
const INVALID_SHEET_NAME = /[\\/*?:[\]]/g;
const MAX_SHEET_NAME_LENGTH = 31;

// 鲁港通 - Word 版式：A4、宋体小五正文、1.5 倍行距、首行缩进两字、黑体标题
const FONT_BODY = '宋体';
const FONT_HEADING = '黑体';
const BODY_FONT_SIZE = 21;
const HEADING_FONT_SIZE: Record<1 | 2 | 3, number> = { 1: 32, 2: 28, 3: 24 };
const FIRST_LINE_INDENT = 420;
const LINE_SPACING = 360;
const A4_WIDTH_TWIPS = 11906;
const A4_HEIGHT_TWIPS = 16838;

const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '999999' } as const;

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

const textRun = (
  text: string,
  options: { font?: string; size?: number; bold?: boolean; color?: string } = {}
): TextRun =>
  new TextRun({
    text,
    font: options.font ?? FONT_BODY,
    size: options.size ?? BODY_FONT_SIZE,
    ...(options.bold ? { bold: true } : {}),
    ...(options.color ? { color: options.color } : {})
  });

const bodyParagraph = (text: string): Paragraph =>
  new Paragraph({
    indent: { firstLine: FIRST_LINE_INDENT },
    spacing: { line: LINE_SPACING, before: 0, after: 0 },
    children: [textRun(text)]
  });

const titleParagraph = (title: string): Paragraph =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 240 },
    children: [textRun(title, { font: FONT_HEADING, size: 44, bold: true })]
  });

const headingParagraph = (text: string, level: 1 | 2 | 3): Paragraph =>
  new Paragraph({
    heading:
      level === 1
        ? HeadingLevel.HEADING_1
        : level === 2
          ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3,
    spacing: { before: level === 1 ? 240 : 180, after: 120 },
    children: [
      textRun(text, { font: FONT_HEADING, size: HEADING_FONT_SIZE[level], bold: true, color: '000000' })
    ]
  });

const buildTable = (header: string[] | undefined, rows: string[][]): Table => {
  const columnCount = Math.max(header?.length ?? 0, ...rows.map((row) => row.length), 1);
  const buildRow = (cells: string[], isHeader: boolean): TableRow =>
    new TableRow({
      ...(isHeader ? { tableHeader: true } : {}),
      children: Array.from(
        { length: columnCount },
        (_, index) =>
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            ...(isHeader
              ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' } }
              : {}),
            children: [
              new Paragraph({
                alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
                spacing: { before: 0, after: 0 },
                children: [
                  textRun(cells[index] ?? '', {
                    size: 20,
                    bold: isHeader
                  })
                ]
              })
            ]
          })
      )
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: TABLE_BORDER,
      bottom: TABLE_BORDER,
      left: TABLE_BORDER,
      right: TABLE_BORDER,
      insideHorizontal: TABLE_BORDER,
      insideVertical: TABLE_BORDER
    },
    rows: [
      ...(header?.length ? [buildRow(header, true)] : []),
      ...rows.map((row) => buildRow(row, false))
    ]
  });
};

const blocksToDocx = (blocks: GeneratedDocBlock[]): (Paragraph | Table)[] => {
  const children: (Paragraph | Table)[] = [];
  for (const block of blocks) {
    if (block.type === 'heading') {
      const level = block.level === 2 ? 2 : block.level === 3 ? 3 : 1;
      children.push(headingParagraph(block.text, level));
    } else if (block.type === 'paragraph') {
      children.push(bodyParagraph(block.text));
    } else if (block.type === 'list') {
      for (const item of block.items) {
        children.push(
          new Paragraph({
            ...(block.ordered
              ? { numbering: { reference: 'ordered-list', level: 0 } }
              : { bullet: { level: 0 } }),
            spacing: { line: LINE_SPACING, before: 0, after: 0 },
            indent: { left: 720, hanging: 300 },
            children: [textRun(item)]
          })
        );
      }
    } else if (block.type === 'table') {
      children.push(buildTable(block.header, block.rows ?? []));
      children.push(new Paragraph({ spacing: { before: 0, after: 120 } }));
    } else if (block.type === 'divider') {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BBBBBB', space: 1 } }
        })
      );
    } else {
      children.push(new Paragraph({ pageBreakBefore: true }));
    }
  }
  return children;
};

const buildDocx = async (input: AiFileGeneratorInput): Promise<Buffer> => {
  const children: (Paragraph | Table)[] = [];
  const title = input.title?.trim();
  if (title) children.push(titleParagraph(title));

  if (input.blocks?.length) {
    children.push(...blocksToDocx(input.blocks));
  } else {
    for (const line of splitLines(input.content)) children.push(bodyParagraph(line));
    if (input.rows?.length) children.push(buildTable(undefined, input.rows));
  }

  if (children.length === 0) children.push(new Paragraph(''));

  const sectionChildren = children;
  const headers = title
    ? {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 1 } },
              children: [textRun(title, { size: 18, color: '888888' })]
            })
          ]
        })
      }
    : undefined;

  return Packer.toBuffer(
    new Document({
      numbering: {
        config: [
          {
            reference: 'ordered-list',
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 300 } } }
              }
            ]
          }
        ]
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS },
              margin: {
                top: 1440,
                right: 1247,
                bottom: 1440,
                left: 1247,
                header: 720,
                footer: 720
              }
            }
          },
          ...(headers ? { headers } : {}),
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [
                    textRun('第 ', { size: 18, color: '888888' }),
                    new TextRun({ children: [PageNumber.CURRENT], font: FONT_BODY, size: 18, color: '888888' }),
                    textRun(' 页 / 共 ', { size: 18, color: '888888' }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      font: FONT_BODY,
                      size: 18,
                      color: '888888'
                    }),
                    textRun(' 页', { size: 18, color: '888888' })
                  ]
                })
              ]
            })
          },
          children: sectionChildren
        }
      ]
    })
  );
};

const resolveSheetName = (
  raw: string | undefined,
  index: number,
  used: Set<string>
): string => {
  const fallback = `Sheet${index + 1}`;
  const base = (raw ?? '')
    .replace(INVALID_SHEET_NAME, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SHEET_NAME_LENGTH)
    .replace(/[. ]+$/g, '');
  const stem = base || fallback;
  let name = stem;
  let suffix = 2;
  while (used.has(name.toLowerCase())) {
    const tail = `(${suffix})`;
    name = `${stem.slice(0, MAX_SHEET_NAME_LENGTH - tail.length).replace(/[. ]+$/g, '')}${tail}`;
    suffix += 1;
  }
  used.add(name.toLowerCase());
  return name;
};

const appendRow = (sheet: ExcelJS.Worksheet, values: string[]): ExcelJS.Row => {
  const row = sheet.addRow([]);
  values.forEach((value, index) => {
    const cell = row.getCell(index + 1);
    const text = value ?? '';
    if (text.length > 1 && text.startsWith('=') && isSafeFormula(text.slice(1))) {
      cell.value = { formula: text.slice(1) };
    } else {
      cell.value = text;
    }
  });
  return row;
};

const styleHeaderRow = (row: ExcelJS.Row): void => {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
};

// 鲁港通 - 中文按两格宽度估算，避免中文表头被切得太窄
const displayWidth = (value: string): number =>
  Array.from(value).reduce((total, char) => total + (char.charCodeAt(0) > 0xff ? 2 : 1), 0);

const autofitColumnWidth = (values: string[]): number => {
  const longest = values.reduce((max, value) => Math.max(max, displayWidth(value)), 0);
  return Math.min(60, Math.max(10, longest + 2));
};

const applyColumnWidths = (
  sheet: ExcelJS.Worksheet,
  header: string[],
  rows: string[][],
  widths: number[] | undefined
): void => {
  const columnCount = Math.max(
    header.length,
    ...rows.map((row) => row.length),
    widths?.length ?? 0
  );
  for (let index = 1; index <= columnCount; index += 1) {
    const explicit = widths?.[index - 1];
    sheet.getColumn(index).width =
      explicit ??
      autofitColumnWidth([header[index - 1] ?? '', ...rows.map((row) => row[index - 1] ?? '')]);
  }
};

const applyMerges = (sheet: ExcelJS.Worksheet, merges: string[] | undefined): void => {
  for (const range of merges ?? []) {
    try {
      sheet.mergeCells(range.toUpperCase());
    } catch {
      // 重叠或越界的合并范围直接跳过，不影响其余内容
    }
  }
};

const writeSheet = (
  workbook: ExcelJS.Workbook,
  sheetInput: GeneratedSheet,
  index: number,
  used: Set<string>
): void => {
  const sheet = workbook.addWorksheet(resolveSheetName(sheetInput.name, index, used));
  const header = sheetInput.header ?? [];
  const rows = sheetInput.rows ?? [];

  if (header.length > 0) {
    styleHeaderRow(appendRow(sheet, header));
    if (sheetInput.freeze !== false) {
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }
  }
  for (const row of rows) appendRow(sheet, row);
  applyColumnWidths(sheet, header, rows, sheetInput.widths);
  applyMerges(sheet, sheetInput.merges);
};

const buildXlsxLegacy = (workbook: ExcelJS.Workbook, input: AiFileGeneratorInput): void => {
  const used = new Set<string>();
  const sheet = workbook.addWorksheet(resolveSheetName(input.title, 0, used));
  const rows = input.rows?.length
    ? input.rows
    : splitLines(input.content).map((line) => [line]);

  if (input.title?.trim()) {
    const titleRow = appendRow(sheet, [input.title.trim()]);
    titleRow.getCell(1).font = { bold: true, size: 14 };
    if (rows.length > 0) sheet.addRow([]);
  }
  for (const row of rows) appendRow(sheet, row);
  applyColumnWidths(sheet, [], input.title?.trim() ? [[input.title.trim()], ...rows] : rows, undefined);
};

const buildXlsx = async (input: AiFileGeneratorInput): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  if (input.sheets?.length) {
    const used = new Set<string>();
    input.sheets.forEach((sheetInput, index) => writeSheet(workbook, sheetInput, index, used));
  } else {
    buildXlsxLegacy(workbook, input);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

const renderPdfTable = (header: string[] | undefined, rows: string[][]): string => {
  const headerHtml = header?.length
    ? `<thead><tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')}</tr></thead>`
    : '';
  const bodyHtml = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<table>${headerHtml}<tbody>${bodyHtml}</tbody></table>`;
};

const renderPdfBlock = (block: GeneratedDocBlock): string => {
  if (block.type === 'heading') {
    const tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4';
    return `<${tag}>${escapeHtml(block.text)}</${tag}>`;
  }
  if (block.type === 'paragraph') return `<p>${escapeHtml(block.text)}</p>`;
  if (block.type === 'list') {
    const tag = block.ordered ? 'ol' : 'ul';
    return `<${tag}>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`;
  }
  if (block.type === 'table') return renderPdfTable(block.header, block.rows ?? []);
  if (block.type === 'divider') return '<hr>';
  return '<div class="page-break"></div>';
};

export const buildPdfHtml = (input: AiFileGeneratorInput): string => {
  const title = input.title?.trim();
  const bodyParts: string[] = [];
  if (title) bodyParts.push(`<h1 class="doc-title">${escapeHtml(title)}</h1>`);

  if (input.blocks?.length) {
    bodyParts.push(...input.blocks.map(renderPdfBlock));
  } else {
    bodyParts.push(...splitLines(input.content).map((line) => `<p>${escapeHtml(line)}</p>`));
    if (input.rows?.length) bodyParts.push(renderPdfTable(undefined, input.rows));
  }

  // 鲁港通 - PDF 由系统浏览器内核渲染，显式指定中文字体避免乱码
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
@page { size: A4; }
body { margin: 0; font-family: "SimSun", "Microsoft YaHei", sans-serif; font-size: 10.5pt; line-height: 1.8; color: #111; }
.doc-title { font-family: "SimHei", "Microsoft YaHei", sans-serif; font-size: 18pt; text-align: center; margin: 0 0 18px; font-weight: 700; }
h2, h3, h4 { font-family: "SimHei", "Microsoft YaHei", sans-serif; color: #111; }
h2 { font-size: 16pt; margin: 18px 0 8px; }
h3 { font-size: 14pt; margin: 16px 0 6px; }
h4 { font-size: 12pt; margin: 14px 0 6px; }
p { margin: 0 0 6px; text-indent: 2em; text-align: justify; white-space: pre-wrap; word-break: break-word; }
ul, ol { margin: 0 0 8px; padding-left: 2.4em; }
li { margin: 0 0 4px; }
table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 10pt; }
th, td { border: 1px solid #999; padding: 5px 8px; text-align: left; vertical-align: top; word-break: break-word; }
th { background: #f2f2f2; font-weight: 600; }
hr { border: none; border-top: 1px solid #bbb; margin: 12px 0; }
.page-break { break-after: page; }
</style>
</head>
<body>${bodyParts.join('')}</body>
</html>`;
};

// 鲁港通 - Chromium 的页眉页脚模板只支持内联样式，页码用固定的 pageNumber/totalPages 类名
const buildPdfHeaderTemplate = (title?: string): string =>
  title
    ? `<div style="width:100%;font-family:'Microsoft YaHei';font-size:8px;color:#888;text-align:center;padding:0 18mm 2mm;">${escapeHtml(title)}</div>`
    : '<span></span>';

const buildPdfFooterTemplate = (): string =>
  `<div style="width:100%;font-family:'Microsoft YaHei';font-size:8px;color:#888;text-align:center;padding:2mm 18mm 0;">第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</div>`;

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
    return await page.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      displayHeaderFooter: true,
      headerTemplate: buildPdfHeaderTemplate(input.title?.trim()),
      footerTemplate: buildPdfFooterTemplate(),
      margins: { top: 0.8, bottom: 0.8, left: 0.71, right: 0.71 }
    });
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

    return { name, format: input.format, folder: GENERATED_FILE_FOLDER, path: filePath };
  };
};
