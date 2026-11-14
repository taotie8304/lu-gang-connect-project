// 鲁港通 - 服务端 PDF 生成：PDFKit 流式排版，内置 Noto Sans SC 子集嵌入保证中文可复制可检索。
// 说明：pdf-lib 对 CID-keyed CFF 字体子集化会丢字形（实测「预约填」缺字），故排版与嵌入统一走 PDFKit。
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import {
  assertGenerateInputWithinLimits,
  DocumentGenerationError,
  type DocumentGenerateInput
} from '../types';
import type { GeneratedBlock } from '../../llm/agentLoop/domain/systemTool/generatedSchema';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const FOOTER_HEIGHT = 24;
const CONTENT_BOTTOM = PAGE_MARGIN + FOOTER_HEIGHT;

const BODY_FONT_SIZE = 10.5;
const BODY_LINE_HEIGHT = BODY_FONT_SIZE * 1.6;
const HEADING_SIZES = { 1: 18, 2: 15, 3: 13 } as const;
const TABLE_FONT_SIZE = 9.5;
const TABLE_CELL_PADDING = 5;
const TABLE_LINE_HEIGHT = 13;

const TEXT_COLOR = '#1f2937';
const MUTED_COLOR = '#737578';
const BORDER_COLOR = '#b8bcc4';
const HEADER_FILL = '#f2f2f4';

const FONT_NAME = 'LugangNotoSansSC';
const FONT_ASSET_NAME = 'NotoSansSC-Regular.otf';

// 鲁港通 - 字体资产候选路径：源码调试、standalone 容器（WORKDIR /app）与仓库根启动都能命中
const resolveFontPath = (): string => {
  const candidates = [
    fileURLToPath(new URL(`../assets/${FONT_ASSET_NAME}`, import.meta.url)),
    path.join(process.cwd(), 'packages/service/core/ai/document/assets', FONT_ASSET_NAME),
    path.join(process.cwd(), '../../packages/service/core/ai/document/assets', FONT_ASSET_NAME),
    path.join(process.cwd(), 'document/assets', FONT_ASSET_NAME)
  ];
  const hit = candidates.find((candidate) => existsSync(candidate));
  if (!hit) {
    throw new DocumentGenerationError(
      'PDF 字体资源缺失，暂时无法生成 PDF。请稍后重试，或改用 Word / Markdown 格式生成。'
    );
  }
  return hit;
};

type Layout = {
  doc: PDFKit.PDFDocument;
  pageCount: number;
  y: number;
  newPage: () => void;
  canFit: (height: number) => boolean;
  ensureSpace: (height: number) => void;
};

const setFont = (doc: PDFKit.PDFDocument, size: number) => doc.font(FONT_NAME).fontSize(size);

const measure = (doc: PDFKit.PDFDocument, text: string, size: number) =>
  setFont(doc, size).widthOfString(text);

// 鲁港通 - 中日韩字符与全角标点按字断行，拉丁单词按空格断行
const isWideChar = (char: string) =>
  /[\u1100-\u11ff\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uffef]/.test(char);

const splitUnits = (text: string): string[] => {
  const units: string[] = [];
  let latin = '';
  for (const char of text) {
    if (isWideChar(char) || /\s/.test(char)) {
      if (latin) {
        units.push(latin);
        latin = '';
      }
      units.push(char);
    } else {
      latin += char;
    }
  }
  if (latin) units.push(latin);
  return units;
};

const wrapText = (
  doc: PDFKit.PDFDocument,
  text: string,
  size: number,
  maxWidth: number
): string[] => {
  const lines: string[] = [];
  let current = '';
  const pushHard = (word: string) => {
    let chunk = '';
    for (const char of word) {
      if (chunk && measure(doc, chunk + char, size) > maxWidth) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk += char;
      }
    }
    return chunk;
  };

  for (const unit of splitUnits(text)) {
    if (/^\s+$/.test(unit)) {
      if (current) current += unit;
      continue;
    }
    if (measure(doc, current + unit, size) <= maxWidth) {
      current += unit;
      continue;
    }
    if (current.trim()) lines.push(current.trimEnd());
    current = measure(doc, unit, size) > maxWidth ? pushHard(unit) : unit;
  }
  if (current.trim()) lines.push(current.trimEnd());
  return lines.length ? lines : [''];
};

type TextStyle = {
  size?: number;
  bold?: boolean;
  color?: string;
};

const drawLine = (
  layout: Layout,
  text: string,
  x: number,
  yTop: number,
  { size = BODY_FONT_SIZE, bold = false, color = TEXT_COLOR }: TextStyle = {}
) => {
  setFont(layout.doc, size).fillColor(color);
  layout.doc.text(text, x, yTop, { lineBreak: false });
  // 只有常规字重字体，标题与表头用轻微描边模拟加粗
  if (bold) {
    layout.doc.text(text, x + 0.35, yTop, { lineBreak: false });
  }
};

const renderParagraph = (
  layout: Layout,
  text: string,
  options: { indentChars?: number; size?: number; bold?: boolean; color?: string } = {}
) => {
  const size = options.size ?? BODY_FONT_SIZE;
  const indent = '　'.repeat(options.indentChars ?? 2);
  const lines = wrapText(layout.doc, indent + text, size, CONTENT_WIDTH);
  const lineHeight = size * 1.6;
  for (const line of lines) {
    layout.ensureSpace(lineHeight);
    drawLine(layout, line, PAGE_MARGIN, layout.y, {
      size,
      bold: options.bold,
      color: options.color
    });
    layout.y -= lineHeight;
  }
};

const renderHeading = (layout: Layout, level: number, text: string) => {
  const size = HEADING_SIZES[(level as 1 | 2 | 3) in HEADING_SIZES ? (level as 1 | 2 | 3) : 2];
  const lineHeight = size * 1.35;
  if (layout.y < PAGE_HEIGHT - PAGE_MARGIN - 1) layout.y -= 8;
  const lines = wrapText(layout.doc, text, size, CONTENT_WIDTH);
  for (const line of lines) {
    layout.ensureSpace(lineHeight);
    drawLine(layout, line, PAGE_MARGIN, layout.y, { size, bold: true });
    layout.y -= lineHeight;
  }
  layout.y -= 3;
};

const renderList = (layout: Layout, ordered: boolean, items: string[]) => {
  items.forEach((item, index) => {
    const prefix = ordered ? `${index + 1}. ` : '• ';
    const prefixWidth = measure(layout.doc, prefix, BODY_FONT_SIZE);
    const lines = wrapText(layout.doc, item, BODY_FONT_SIZE, CONTENT_WIDTH - prefixWidth);
    lines.forEach((line, lineIndex) => {
      layout.ensureSpace(BODY_LINE_HEIGHT);
      if (lineIndex === 0) drawLine(layout, prefix, PAGE_MARGIN, layout.y);
      drawLine(layout, line, PAGE_MARGIN + prefixWidth, layout.y);
      layout.y -= BODY_LINE_HEIGHT;
    });
  });
  layout.y -= 2;
};

const renderTableRow = (
  layout: Layout,
  cells: string[],
  columns: number,
  header: boolean
) => {
  const columnWidth = CONTENT_WIDTH / columns;
  const wrapped = Array.from({ length: columns }, (_, index) =>
    wrapText(
      layout.doc,
      cells[index] ?? '',
      TABLE_FONT_SIZE,
      columnWidth - TABLE_CELL_PADDING * 2
    )
  );
  const lineCount = Math.max(1, ...wrapped.map((lines) => lines.length));
  const rowHeight = lineCount * TABLE_LINE_HEIGHT + TABLE_CELL_PADDING * 2;

  layout.ensureSpace(rowHeight);
  const top = layout.y;
  const doc = layout.doc;
  if (header) {
    doc.save();
    doc.rect(PAGE_MARGIN, top, CONTENT_WIDTH, rowHeight).fill(HEADER_FILL);
    doc.restore();
  }
  doc
    .rect(PAGE_MARGIN, top, CONTENT_WIDTH, rowHeight)
    .strokeColor(BORDER_COLOR)
    .lineWidth(0.6)
    .stroke();

  wrapped.forEach((lines, columnIndex) => {
    const x = PAGE_MARGIN + columnWidth * columnIndex;
    if (columnIndex > 0) {
      doc
        .moveTo(x, top)
        .lineTo(x, top + rowHeight)
        .strokeColor(BORDER_COLOR)
        .lineWidth(0.6)
        .stroke();
    }
    lines.forEach((line, lineIndex) => {
      drawLine(layout, line, x + TABLE_CELL_PADDING, top + TABLE_CELL_PADDING + lineIndex * TABLE_LINE_HEIGHT, {
        size: TABLE_FONT_SIZE,
        bold: header
      });
    });
  });

  layout.y = top - rowHeight;
};

const renderTable = (
  layout: Layout,
  block: Extract<GeneratedBlock, { type: 'table' }>
) => {
  const rows = block.rows ?? [];
  const columns = Math.max(block.header?.length ?? 0, ...rows.map((row) => row.length));
  if (!columns) return;
  if (block.header?.length) {
    renderTableRow(layout, block.header, columns, true);
  }
  for (const row of rows) {
    renderTableRow(layout, row, columns, false);
  }
  layout.y -= 6;
};

const renderDivider = (layout: Layout) => {
  layout.ensureSpace(14);
  layout.y -= 6;
  layout.doc
    .moveTo(PAGE_MARGIN, layout.y)
    .lineTo(PAGE_WIDTH - PAGE_MARGIN, layout.y)
    .strokeColor(BORDER_COLOR)
    .lineWidth(0.8)
    .stroke();
  layout.y -= 8;
};

const renderBlocks = (layout: Layout, blocks: GeneratedBlock[]) => {
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        renderHeading(layout, block.level ?? 2, block.text);
        break;
      case 'paragraph':
        renderParagraph(layout, block.text);
        layout.y -= 4;
        break;
      case 'list':
        renderList(layout, Boolean(block.ordered), block.items);
        break;
      case 'table':
        renderTable(layout, block);
        break;
      case 'divider':
        renderDivider(layout);
        break;
      case 'pageBreak':
        layout.newPage();
        break;
    }
  }
};

const renderFooter = (layout: Layout) => {
  for (let index = 0; index < layout.pageCount; index++) {
    layout.doc.switchToPage(index);
    const label = `第 ${index + 1} 页`;
    const width = measure(layout.doc, label, 9);
    drawLine(layout, label, (PAGE_WIDTH - width) / 2, PAGE_HEIGHT - PAGE_MARGIN + 6, {
      size: 9,
      color: MUTED_COLOR
    });
  }
};

const createLayout = (doc: PDFKit.PDFDocument): Layout => {
  const layout: Layout = {
    doc,
    pageCount: 1,
    y: PAGE_HEIGHT - PAGE_MARGIN,
    canFit: (height) => layout.y - height >= CONTENT_BOTTOM,
    newPage: () => {
      doc.addPage();
      layout.pageCount += 1;
      layout.y = PAGE_HEIGHT - PAGE_MARGIN;
    },
    ensureSpace: (height) => {
      if (!layout.canFit(height)) layout.newPage();
    }
  };
  return layout;
};

const renderToBuffer = (doc: PDFKit.PDFDocument): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

export const generatePdf = async (input: DocumentGenerateInput): Promise<Buffer> => {
  assertGenerateInputWithinLimits(input);

  const blocks = input.blocks ?? [];
  const content = input.content ?? '';
  if (!blocks.length && !content.trim()) {
    throw new DocumentGenerationError('需要提供文档内容后再生成');
  }

  const fontPath = resolveFontPath();
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    bufferPages: true,
    info: {
      Title: input.title?.trim() || input.fileName,
      Producer: '鲁港通'
    }
  });
  doc.registerFont(FONT_NAME, fontPath);

  const layout = createLayout(doc);

  if (input.title?.trim()) {
    const title = input.title.trim();
    const lines = wrapText(doc, title, HEADING_SIZES[1], CONTENT_WIDTH);
    for (const line of lines) {
      const width = measure(doc, line, HEADING_SIZES[1]);
      drawLine(layout, line, (PAGE_WIDTH - width) / 2, layout.y, {
        size: HEADING_SIZES[1],
        bold: true
      });
      layout.y -= HEADING_SIZES[1] * 1.35;
    }
    layout.y -= 10;
  }

  if (blocks.length) {
    renderBlocks(layout, blocks);
  } else {
    for (const line of content.split('\n')) {
      if (!line.trim()) {
        layout.y -= BODY_LINE_HEIGHT * 0.6;
        continue;
      }
      renderParagraph(layout, line.trim());
      layout.y -= 2;
    }
  }

  renderFooter(layout);
  return renderToBuffer(doc);
};
