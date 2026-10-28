// 鲁港通 - AI 指令协议：桌面端只接受受控动作，上传与生成文件不允许携带本机路径
import { z } from 'zod';

const refSchema = z.string().trim().min(1).max(32);
const targetSchema = z.string().trim().min(1).max(200);

const locateSchema = {
  ref: refSchema.optional(),
  target: targetSchema.optional()
};

const requiresLocator = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).refine(
    (value) => {
      const locator = value as { ref?: string; target?: string };
      return Boolean(locator.ref || locator.target);
    },
    { message: '需要提供元素引用或元素描述' }
  );

const readCommand = z.object({
  action: z.literal('read'),
  fullText: z.boolean().optional()
});

const navigateCommand = z.object({
  action: z.literal('navigate'),
  url: z.string().trim().min(1).max(2048)
});

const clickCommand = requiresLocator({
  action: z.literal('click'),
  ...locateSchema,
  expect: z.string().trim().max(200).optional()
});

const typeCommand = requiresLocator({
  action: z.literal('type'),
  ...locateSchema,
  text: z.string().max(2000),
  expect: z.string().trim().max(200).optional()
});

const selectCommand = requiresLocator({
  action: z.literal('select'),
  ...locateSchema,
  option: z.string().trim().min(1).max(200)
});

const scrollCommand = z.object({
  action: z.literal('scroll'),
  direction: z.enum(['up', 'down', 'top', 'bottom']),
  amount: z.number().int().min(1).max(5000).optional()
});

const stopCommand = z.object({
  action: z.literal('stop')
});

const generatedRowsSchema = z.array(z.array(z.string().max(500)).max(12)).max(1000);

const generatedTableHeaderSchema = z.array(z.string().max(500)).max(12);

// 鲁港通 - 文档结构化块：与桌面渲染器的块类型一一对应
const generatedBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('heading'),
    level: z.number().int().min(1).max(3).optional(),
    text: z.string().trim().min(1).max(200)
  }),
  z.object({
    type: z.literal('paragraph'),
    text: z.string().trim().min(1).max(8000)
  }),
  z.object({
    type: z.literal('list'),
    ordered: z.boolean().optional(),
    items: z.array(z.string().trim().min(1).max(8000)).min(1).max(200)
  }),
  z
    .object({
      type: z.literal('table'),
      header: generatedTableHeaderSchema.optional(),
      rows: generatedRowsSchema.optional()
    })
    .refine((value) => Boolean(value.header?.length || value.rows?.length), {
      message: '表格至少要有表头或数据行'
    }),
  z.object({ type: z.literal('divider') }),
  z.object({ type: z.literal('pageBreak') })
]);

const generatedSheetSchema = z.object({
  name: z.string().trim().min(1).max(31).optional(),
  header: generatedTableHeaderSchema.optional(),
  rows: generatedRowsSchema.optional(),
  merges: z
    .array(
      z
        .string()
        .trim()
        .regex(/^[A-Za-z]{1,2}[1-9]\d{0,3}:[A-Za-z]{1,2}[1-9]\d{0,3}$/, {
          message: '合并范围格式应为 A1:B2'
        })
    )
    .max(50)
    .optional(),
  widths: z.array(z.number().int().min(6).max(80)).max(12).optional(),
  freeze: z.boolean().optional()
});

export type GeneratedDocBlock = z.infer<typeof generatedBlockSchema>;
export type GeneratedSheet = z.infer<typeof generatedSheetSchema>;

const generateFileCommand = z
  .object({
    action: z.literal('generate_file'),
    format: z.enum(['docx', 'xlsx', 'pdf']),
    fileName: z.string().trim().min(1).max(80),
    title: z.string().trim().max(200).optional(),
    content: z.string().max(20000).optional(),
    rows: generatedRowsSchema.optional(),
    blocks: z.array(generatedBlockSchema).min(1).max(200).optional(),
    sheets: z.array(generatedSheetSchema).min(1).max(5).optional()
  })
  .refine(
    (value) =>
      Boolean(
        value.content?.trim() ||
          value.title?.trim() ||
          value.rows?.length ||
          value.blocks?.length ||
          value.sheets?.length
      ),
    { message: '需要提供文件内容' }
  );

const uploadCommand = requiresLocator({
  action: z.literal('upload'),
  ...locateSchema
});

// 鲁港通 - 打开表单只让用户在原生文件框里选文件，协议层不接受任何本机路径
const openFormCommand = z.object({
  action: z.literal('open_form'),
  hint: z.string().trim().max(100).optional()
});

const fillFormFieldSchema = z.object({
  field: z.string().trim().min(1).max(200),
  value: z.string().max(2000)
});

// 鲁港通 - 回填只看服务端下发的字段清单，token 对应本机已打开的表单
const fillFormCommand = z.object({
  action: z.literal('fill_form'),
  token: z.string().trim().min(1).max(64),
  fields: z.array(fillFormFieldSchema).min(1).max(200)
});

// 鲁港通 - 打开文档同样只走原生文件框，协议层不接受本机路径
const openDocumentCommand = z.object({
  action: z.literal('open_document'),
  hint: z.string().trim().max(100).optional()
});

// 鲁港通 - 模型常把序号写成字符串、金额写成数字：协议层先归一化再校验，避免整条修改被静默丢弃
const documentParagraphIndex = z
  .union([z.number(), z.string().trim().regex(/^\d+$/, { message: '需要是数字' })])
  .transform((value) => (typeof value === 'string' ? Number(value) : value))
  .pipe(
    z
      .number()
      .int()
      .min(0, { message: '序号需要是 0 开始的数字' })
      .max(4000, { message: '序号不能超过 4000' })
  );
const documentSheetName = z.string().trim().min(1).max(31);
const documentText = (max: number) =>
  z
    .union([z.string(), z.number(), z.boolean()])
    .transform((value) => String(value))
    .pipe(z.string().max(max, { message: `文字不能超过 ${max} 字` }));

const columnLettersToIndex = (letters: string): number =>
  letters
    .toUpperCase()
    .split('')
    .reduce((total, character) => total * 26 + (character.charCodeAt(0) - 64), 0) - 1;

// 鲁港通 - 列号兼容 0 开始数字、列字母（B）与 A1 地址（B2 只取列）
const documentColumnIndex = z
  .union([z.number(), z.string().trim().min(1).max(8)])
  .transform((value) => {
    if (typeof value === 'number') return value;
    const letters = /^[A-Za-z]+/.exec(value)?.[0];
    if (letters) return columnLettersToIndex(letters);
    return /^\d+$/.test(value) ? Number(value) : -1;
  })
  .pipe(
    z
      .number()
      .int()
      .min(0, { message: '列号需要是 0 开始的数字，或 A、B 这样的列字母' })
      .max(100, { message: '列号不能超过 100' })
  );

const documentReplaceTextOp = z
  .object({
    op: z.literal('replace_text'),
    find: documentText(200).pipe(z.string().min(1, { message: '要查找的原文不能为空' })),
    replace: documentText(600),
    paragraph: documentParagraphIndex.optional(),
    sheet: documentSheetName.optional()
  })
  .refine((value) => !(value.paragraph !== undefined && value.sheet !== undefined), {
    message: '段落与工作表不能同时指定'
  });

const documentSetParagraphOp = z.object({
  op: z.literal('set_paragraph'),
  paragraph: documentParagraphIndex,
  text: documentText(4000)
});

const documentInsertParagraphOp = z.object({
  op: z.literal('insert_paragraph'),
  after: documentParagraphIndex,
  text: documentText(4000)
});

const documentAppendParagraphOp = z.object({
  op: z.literal('append_paragraph'),
  text: documentText(4000)
});

const documentSetTableCellOp = z.object({
  op: z.literal('set_table_cell'),
  table: documentParagraphIndex,
  row: documentParagraphIndex,
  cell: documentColumnIndex,
  text: documentText(2000)
});

const documentCellRefSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{1,3}[1-9]\d{0,5}$/, { message: '单元格格式应为 B2' })
  .transform((value) => value.toUpperCase());

const documentSetCellOp = z.object({
  op: z.literal('set_cell'),
  sheet: documentSheetName,
  cell: documentCellRefSchema,
  value: documentText(2000)
});

const documentAppendRowOp = z.object({
  op: z.literal('append_row'),
  sheet: documentSheetName,
  values: z.array(documentText(2000)).min(1).max(50)
});

const documentOperationSchema = z.discriminatedUnion('op', [
  documentReplaceTextOp,
  documentSetParagraphOp,
  documentInsertParagraphOp,
  documentAppendParagraphOp,
  documentSetTableCellOp,
  documentSetCellOp,
  documentAppendRowOp
]);

export type DocumentEditOperation = z.infer<typeof documentOperationSchema>;

// 鲁港通 - 改动量上限与格式无关，具体格式能否执行由桌面端按已打开文档判断
const editDocumentCommand = z
  .object({
    action: z.literal('edit_document'),
    token: z.string().trim().min(1).max(64),
    operations: z
      .array(documentOperationSchema)
      .min(1, { message: '至少需要一条修改项' })
      .max(60, { message: '单次修改项不能超过 60 条' })
  })
  .refine(
    (value) => {
      let replacements = 0;
      let inserts = 0;
      let cells = 0;
      for (const operation of value.operations) {
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
        } else {
          cells += operation.values.length;
        }
      }
      return replacements <= 50 && inserts <= 20 && cells <= 200;
    },
    { message: '改动条数超出上限，请分次修改' }
  );

// 鲁港通 - PDF 叠加填写：按标签定位后写进原样副本，不改 PDF 原有排版
const pdfOverlayEntrySchema = z.object({
  page: z
    .union([z.number(), z.string().trim().regex(/^\d+$/, { message: '页码需要是数字' })])
    .transform((value) => (typeof value === 'string' ? Number(value) : value))
    .pipe(z.number().int().min(1).max(500, { message: '页码超出范围' }))
    .optional(),
  label: z.string().trim().min(1).max(60),
  value: documentText(2000)
});

const fillPdfCommand = z.object({
  action: z.literal('fill_pdf'),
  token: z.string().trim().min(1).max(64),
  entries: z
    .array(pdfOverlayEntrySchema)
    .min(1, { message: '至少需要一条填写内容' })
    .max(40, { message: '单次填写不能超过 40 条' })
});

export const aiCommandSchema = z.discriminatedUnion('action', [
  readCommand,
  navigateCommand,
  clickCommand,
  typeCommand,
  selectCommand,
  scrollCommand,
  uploadCommand,
  generateFileCommand,
  openFormCommand,
  fillFormCommand,
  openDocumentCommand,
  editDocumentCommand,
  fillPdfCommand,
  stopCommand
]);

export type AiCommand = z.infer<typeof aiCommandSchema>;

const supportedActions = new Set<string>(
  aiCommandSchema.options.map((option) => option.shape.action.value)
);

export type AiCommandParseResult =
  | { success: true; command: AiCommand }
  | { success: false; message: string };

const formatIssuePath = (path: PropertyKey[]): string =>
  path.reduce<string>(
    (total, segment) => (total ? `${total}.${String(segment)}` : String(segment)),
    ''
  );

// 鲁港通 - 把校验失败的具体原因带回去，模型才能照着改指令，而不是反复让用户确认
export const parseAiCommandDetailed = (input: unknown): AiCommandParseResult => {
  const action =
    input && typeof input === 'object' ? (input as { action?: unknown }).action : undefined;
  if (typeof action !== 'string' || !supportedActions.has(action)) {
    return {
      success: false,
      message: typeof action === 'string' ? `不支持的操作：${action}` : '缺少操作类型 action'
    };
  }

  const result = aiCommandSchema.safeParse(input);
  if (result.success) return { success: true, command: result.data };

  const issue = result.error.issues[0];
  const path = formatIssuePath(issue.path);
  return { success: false, message: path ? `${path}：${issue.message}` : issue.message };
};

export const parseAiCommand = (input: unknown): AiCommand | null => {
  const result = aiCommandSchema.safeParse(input);
  return result.success ? result.data : null;
};
