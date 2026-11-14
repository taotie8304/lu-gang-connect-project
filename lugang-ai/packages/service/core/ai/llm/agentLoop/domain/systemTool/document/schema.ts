// 鲁港通 - document_operation 的工具参数 schema：生成内容、幻灯片、修改项与组合上限。
// 生成类结构复用 generatedSchema.ts；修改项按 op 判别，格式能力在编辑阶段按扩展名分派。
import z from 'zod';
import {
  countBlockRows,
  countBlocksChars,
  countSheetsChars,
  countSheetsRows,
  generatedBlocksSchema,
  generatedSheetsSchema,
  MAX_GENERATED_FILE_CHARS,
  MAX_GENERATED_FILE_ROWS
} from '../generatedSchema';

export const DOCUMENT_GENERATE_FORMATS = ['docx', 'xlsx', 'pdf', 'md', 'pptx'] as const;

export const MAX_DOCUMENT_TITLE_CHARS = 120;
export const MAX_DOCUMENT_FILE_NAME_CHARS = 80;
export const MAX_GENERATED_SLIDES = 30;
export const MAX_SLIDE_TITLE_CHARS = 120;
export const MAX_SLIDE_BULLETS = 6;
export const MAX_SLIDE_BULLET_CHARS = 300;
export const MAX_SLIDE_NOTES_CHARS = 2000;

export const MAX_DOCUMENT_OPERATIONS = 60;
export const MAX_DOCUMENT_TEXT_CHARS = 4000;
export const MAX_DOCUMENT_CELL_CHARS = 2000;
export const MAX_DOCUMENT_REPLACEMENTS = 50;
export const MAX_DOCUMENT_INSERTS = 20;
export const MAX_DOCUMENT_CELLS = 200;
export const MAX_PDF_ENTRIES = 40;
export const MAX_PDF_LABEL_CHARS = 120;
export const MAX_PDF_VALUE_CHARS = 600;

export const generatedSlideSchema = z.object({
  title: z.string().trim().min(1).max(MAX_SLIDE_TITLE_CHARS),
  bullets: z
    .array(z.string().trim().min(1).max(MAX_SLIDE_BULLET_CHARS))
    .max(MAX_SLIDE_BULLETS)
    .optional(),
  notes: z.string().max(MAX_SLIDE_NOTES_CHARS).optional()
});

export const generatedSlidesSchema = z
  .array(generatedSlideSchema)
  .min(1)
  .max(MAX_GENERATED_SLIDES);

export type GeneratedSlide = z.infer<typeof generatedSlideSchema>;

export const documentSourceUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'sourceUrl 只能取对话文件清单里的地址（http/https），不能使用本机路径或编造地址'
  });

const documentParagraphIndexSchema = z.number().int().min(0).max(4000);
const documentSlideIndexSchema = z.number().int().min(0).max(500);
const documentSheetNameSchema = z.string().trim().min(1).max(31);
const documentTextSchema = z.string().max(MAX_DOCUMENT_TEXT_CHARS);
const documentCellRefSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{1,3}[1-9]\d{0,5}$/, { message: '单元格格式应为 B2' });

export const documentEditOperationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('replace_text'),
    find: z.string().min(1).max(200),
    replace: z.string().max(600),
    paragraph: documentParagraphIndexSchema.optional(),
    sheet: documentSheetNameSchema.optional(),
    slide: documentSlideIndexSchema.optional()
  }),
  z.object({
    op: z.literal('set_paragraph'),
    paragraph: documentParagraphIndexSchema,
    text: documentTextSchema.min(1)
  }),
  z.object({
    op: z.literal('insert_paragraph'),
    after: documentParagraphIndexSchema,
    text: documentTextSchema.min(1)
  }),
  z.object({
    op: z.literal('append_paragraph'),
    text: documentTextSchema.min(1)
  }),
  z.object({
    op: z.literal('set_table_cell'),
    table: z.number().int().min(0).max(50),
    row: z.number().int().min(0).max(500),
    cell: z.number().int().min(0).max(100),
    text: z.string().max(MAX_DOCUMENT_CELL_CHARS)
  }),
  z.object({
    op: z.literal('set_cell'),
    sheet: documentSheetNameSchema,
    cell: documentCellRefSchema,
    value: z.string().max(MAX_DOCUMENT_CELL_CHARS)
  }),
  z.object({
    op: z.literal('append_row'),
    sheet: documentSheetNameSchema,
    values: z.array(z.string().max(MAX_DOCUMENT_CELL_CHARS)).min(1).max(50)
  }),
  z.object({
    op: z.literal('fill_field'),
    label: z.string().trim().min(1).max(MAX_PDF_LABEL_CHARS),
    value: z.string().max(MAX_PDF_VALUE_CHARS)
  }),
  z.object({
    op: z.literal('add_text'),
    label: z.string().trim().min(1).max(MAX_PDF_LABEL_CHARS),
    value: z.string().max(MAX_PDF_VALUE_CHARS)
  })
]);

export type DocumentEditOperation = z.infer<typeof documentEditOperationSchema>;

export const documentOperationsSchema = z
  .array(documentEditOperationSchema)
  .min(1)
  .max(MAX_DOCUMENT_OPERATIONS)
  .superRefine((operations, ctx) => {
    for (const operation of operations) {
      if (operation.op !== 'replace_text') continue;
      const scopes = [operation.paragraph, operation.sheet, operation.slide].filter(
        (value) => value !== undefined
      );
      if (scopes.length > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'replace_text 不能同时限定段落、工作表和幻灯片，请拆成多条'
        });
        break;
      }
    }
  })
  .superRefine((operations, ctx) => {
    let replacements = 0;
    let inserts = 0;
    let cells = 0;
    let pdfEntries = 0;
    for (const operation of operations) {
      if (
        operation.op === 'replace_text' ||
        operation.op === 'set_paragraph' ||
        operation.op === 'set_table_cell'
      ) {
        replacements += 1;
      } else if (
        operation.op === 'insert_paragraph' ||
        operation.op === 'append_paragraph'
      ) {
        inserts += 1;
      } else if (operation.op === 'set_cell') {
        cells += 1;
      } else if (operation.op === 'append_row') {
        cells += operation.values.length;
      } else {
        pdfEntries += 1;
      }
    }
    if (
      replacements > MAX_DOCUMENT_REPLACEMENTS ||
      inserts > MAX_DOCUMENT_INSERTS ||
      cells > MAX_DOCUMENT_CELLS ||
      pdfEntries > MAX_PDF_ENTRIES
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          '改动条数超出上限（替换 50、插入 20、单元格 200、PDF 填写 40），请分次修改'
      });
    }
  });

export const documentReadActionSchema = z.object({
  action: z.literal('read'),
  sourceUrl: documentSourceUrlSchema
});

export const documentGenerateActionSchema = z
  .object({
    action: z.literal('generate'),
    format: z.enum(DOCUMENT_GENERATE_FORMATS),
    fileName: z.string().trim().min(1).max(MAX_DOCUMENT_FILE_NAME_CHARS),
    title: z.string().trim().max(MAX_DOCUMENT_TITLE_CHARS).optional(),
    blocks: generatedBlocksSchema.optional(),
    sheets: generatedSheetsSchema.optional(),
    slides: generatedSlidesSchema.optional(),
    content: z.string().max(MAX_GENERATED_FILE_CHARS).optional()
  })
  .superRefine((value, ctx) => {
    const hasBlocks = Boolean(value.blocks?.length);
    const hasSheets = Boolean(value.sheets?.length);
    const hasSlides = Boolean(value.slides?.length);
    const hasContent = Boolean(value.content?.trim());

    if (!hasBlocks && !hasSheets && !hasSlides && !hasContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '需要提供文件内容（blocks、sheets、slides 或 content）'
      });
      return;
    }

    if (value.format === 'xlsx') {
      if (!hasSheets) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '生成 Excel 需要用 sheets 提供工作表内容'
        });
      }
      if (hasBlocks || hasSlides || hasContent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '生成 Excel 只接受 sheets，请把内容整理成工作表'
        });
      }
      return;
    }

    if (value.format === 'pptx') {
      if (!hasSlides) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '生成 PPT 需要用 slides 提供每页内容'
        });
      }
      if (hasBlocks || hasSheets || hasContent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '生成 PPT 只接受 slides，请把内容整理成幻灯片'
        });
      }
      return;
    }

    if (!hasBlocks && !hasContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '生成 Word/PDF/Markdown 需要用 blocks 或 content 提供内容'
      });
    }
    if (hasSheets) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sheets 只用于生成 Excel'
      });
    }
    if (hasSlides) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'slides 只用于生成 PPT'
      });
    }
  })
  .superRefine((value, ctx) => {
    const totalChars =
      (value.content?.length ?? 0) +
      countBlocksChars(value.blocks) +
      countSheetsChars(value.sheets);
    if (totalChars > MAX_GENERATED_FILE_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `文件内容合计不能超过 ${MAX_GENERATED_FILE_CHARS} 字，请精简后再生成`
      });
    }
    const totalRows = countBlockRows(value.blocks) + countSheetsRows(value.sheets);
    if (totalRows > MAX_GENERATED_FILE_ROWS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `表格合计不能超过 ${MAX_GENERATED_FILE_ROWS} 行，请精简后再生成`
      });
    }
  });

export const documentEditActionSchema = z.object({
  action: z.literal('edit'),
  sourceUrl: documentSourceUrlSchema,
  outputName: z.string().trim().min(1).max(MAX_DOCUMENT_FILE_NAME_CHARS).optional(),
  operations: documentOperationsSchema
});

export const DocumentOperationArgsSchema = z.discriminatedUnion('action', [
  documentReadActionSchema,
  documentGenerateActionSchema,
  documentEditActionSchema
]);

export type DocumentOperationArgs = z.infer<typeof DocumentOperationArgsSchema>;
export type DocumentReadArgs = z.infer<typeof documentReadActionSchema>;
export type DocumentGenerateArgs = z.infer<typeof documentGenerateActionSchema>;
export type DocumentEditArgs = z.infer<typeof documentEditActionSchema>;
