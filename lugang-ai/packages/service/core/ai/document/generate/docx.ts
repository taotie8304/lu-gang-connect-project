// 鲁港通 - Word 生成器：沿用桌面端 A4 版式与块渲染逻辑（Service 端只产出 Buffer）
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
import type { GeneratedBlock } from '../../llm/agentLoop/domain/systemTool/generatedSchema';
import {
  assertGenerateInputWithinLimits,
  DocumentGenerationError,
  type DocumentGenerateInput
} from '../types';

const CONTENT_LINE_BREAK = /\r\n?/g;

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

const splitLines = (content?: string): string[] =>
  content?.trim() ? content.replace(CONTENT_LINE_BREAK, '\n').split('\n') : [];

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
      textRun(text, {
        font: FONT_HEADING,
        size: HEADING_FONT_SIZE[level],
        bold: true,
        color: '000000'
      })
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

const blocksToDocx = (blocks: GeneratedBlock[]): (Paragraph | Table)[] => {
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

/**
 * 鲁港通 - 生成 Word 文档 Buffer；上限或空内容抛出可直接展示的中文错误。
 */
export const generateDocx = async (input: DocumentGenerateInput): Promise<Buffer> => {
  assertGenerateInputWithinLimits(input);

  const children: (Paragraph | Table)[] = [];
  const title = input.title?.trim();
  if (title) children.push(titleParagraph(title));

  if (input.blocks?.length) {
    children.push(...blocksToDocx(input.blocks));
  } else {
    for (const line of splitLines(input.content)) children.push(bodyParagraph(line));
  }

  if (children.length === 0) {
    throw new DocumentGenerationError('需要提供文档内容后再生成');
  }

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

  const buffer = await Packer.toBuffer(
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
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      font: FONT_BODY,
                      size: 18,
                      color: '888888'
                    }),
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
          children
        }
      ]
    })
  );

  return Buffer.from(buffer);
};
