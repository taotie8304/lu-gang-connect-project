// 鲁港通 - 生成类工具的共享 schema（浏览器 generate_file 与服务端 document_operation 共用）：
// 块/表格/工作表的结构与上限只在这里定义一份，避免两处漂移。
import z from 'zod';

export const MAX_GENERATED_FILE_CHARS = 12000;
export const MAX_GENERATED_FILE_ROWS = 200;
export const MAX_GENERATED_FILE_COLUMNS = 12;
export const MAX_GENERATED_CELL_CHARS = 200;
export const MAX_GENERATED_FILE_BLOCKS = 120;
export const MAX_GENERATED_BLOCK_TEXT_CHARS = 4000;
export const MAX_GENERATED_LIST_ITEMS = 50;
export const MAX_GENERATED_SHEETS = 5;
export const MAX_GENERATED_SHEET_MERGES = 30;
export const MAX_GENERATED_SHEET_NAME_CHARS = 31;

export const generatedRowsSchema = z
  .array(z.array(z.string().max(MAX_GENERATED_CELL_CHARS)).max(MAX_GENERATED_FILE_COLUMNS))
  .max(MAX_GENERATED_FILE_ROWS);

export const blockHeaderSchema = z
  .array(z.string().max(MAX_GENERATED_CELL_CHARS))
  .max(MAX_GENERATED_FILE_COLUMNS);

export const generatedBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('heading'),
    level: z.number().int().min(1).max(3).optional(),
    text: z.string().trim().min(1).max(200)
  }),
  z.object({
    type: z.literal('paragraph'),
    text: z.string().trim().min(1).max(MAX_GENERATED_BLOCK_TEXT_CHARS)
  }),
  z.object({
    type: z.literal('list'),
    ordered: z.boolean().optional(),
    items: z
      .array(z.string().trim().min(1).max(MAX_GENERATED_BLOCK_TEXT_CHARS))
      .min(1)
      .max(MAX_GENERATED_LIST_ITEMS)
  }),
  z
    .object({
      type: z.literal('table'),
      header: blockHeaderSchema.optional(),
      rows: generatedRowsSchema.optional()
    })
    .refine((value) => Boolean(value.header?.length || value.rows?.length), {
      message: '表格至少要有表头或数据行'
    }),
  z.object({ type: z.literal('divider') }),
  z.object({ type: z.literal('pageBreak') })
]);

export const generatedBlocksSchema = z
  .array(generatedBlockSchema)
  .min(1)
  .max(MAX_GENERATED_FILE_BLOCKS);

export const generatedMergeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{1,2}[1-9]\d{0,3}:[A-Za-z]{1,2}[1-9]\d{0,3}$/, {
    message: '合并范围格式应为 A1:B2'
  });

export const generatedSheetSchema = z.object({
  name: z.string().trim().min(1).max(MAX_GENERATED_SHEET_NAME_CHARS).optional(),
  header: blockHeaderSchema.optional(),
  rows: generatedRowsSchema.optional(),
  merges: z.array(generatedMergeSchema).max(MAX_GENERATED_SHEET_MERGES).optional(),
  widths: z
    .array(z.number().int().min(6).max(80))
    .max(MAX_GENERATED_FILE_COLUMNS)
    .optional(),
  freeze: z.boolean().optional()
});

export const generatedSheetsSchema = z
  .array(generatedSheetSchema)
  .min(1)
  .max(MAX_GENERATED_SHEETS);

export type GeneratedBlock = z.infer<typeof generatedBlockSchema>;
export type GeneratedSheet = z.infer<typeof generatedSheetSchema>;

export const countRowsChars = (rows: string[][] | undefined): number =>
  (rows ?? []).reduce(
    (total, row) => total + row.reduce((rowTotal, cell) => rowTotal + cell.length, 0),
    0
  );

export const countRows = (rows: string[][] | undefined): number => (rows ?? []).length;

export const countBlocksChars = (blocks: GeneratedBlock[] | undefined): number =>
  (blocks ?? []).reduce((total, block) => {
    if (block.type === 'heading' || block.type === 'paragraph') return total + block.text.length;
    if (block.type === 'list') {
      return total + block.items.reduce((sum, item) => sum + item.length, 0);
    }
    if (block.type === 'table') {
      return (
        total +
        (block.header ?? []).reduce((sum, cell) => sum + cell.length, 0) +
        countRowsChars(block.rows)
      );
    }
    return total;
  }, 0);

export const countBlockRows = (blocks: GeneratedBlock[] | undefined): number =>
  (blocks ?? []).reduce(
    (total, block) => (block.type === 'table' ? total + countRows(block.rows) : total),
    0
  );

export const countSheetsChars = (sheets: GeneratedSheet[] | undefined): number =>
  (sheets ?? []).reduce(
    (total, sheet) =>
      total +
      (sheet.header ?? []).reduce((sum, cell) => sum + cell.length, 0) +
      countRowsChars(sheet.rows),
    0
  );

export const countSheetsRows = (sheets: GeneratedSheet[] | undefined): number =>
  (sheets ?? []).reduce((total, sheet) => total + countRows(sheet.rows), 0);
