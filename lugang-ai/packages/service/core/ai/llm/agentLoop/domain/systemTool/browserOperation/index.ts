// 鲁港通 - 智能体浏览器操作工具（P2 阶段一）：
// 只在桌面客户端内可用，模型一次只做一个动作，动作后由桌面端回传最新页面快照。
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool
} from '@fastgpt/global/core/ai/llm/type';
import z from 'zod';
import { parseJsonArgs } from '../../../../../utils';
import type { AgentLoopUsage } from '../../usage';

export const BROWSER_OPERATION_TOOL_NAME = 'browser_operation';

export const BROWSER_OPERATION_ACTIONS = [
  'read',
  'navigate',
  'click',
  'type',
  'select',
  'scroll',
  'upload',
  'generate_file',
  'open_form',
  'fill_form',
  'open_document',
  'edit_document',
  'wait'
] as const;

const refSchema = z.string().trim().min(1).max(32);
const targetSchema = z.string().trim().min(1).max(200);
const MAX_GENERATED_FILE_CHARS = 12000;
const MAX_GENERATED_FILE_ROWS = 200;
const MAX_GENERATED_FILE_COLUMNS = 12;
const MAX_GENERATED_CELL_CHARS = 200;
const MAX_GENERATED_FILE_BLOCKS = 120;
const MAX_GENERATED_BLOCK_TEXT_CHARS = 4000;
const MAX_GENERATED_LIST_ITEMS = 50;
const MAX_GENERATED_SHEETS = 5;
const MAX_GENERATED_SHEET_MERGES = 30;
const MAX_GENERATED_SHEET_NAME_CHARS = 31;
const MAX_FORM_FIELDS = 200;
const MAX_FORM_FIELD_VALUE_CHARS = 2000;
const MAX_DOCUMENT_OPERATIONS = 60;
const MAX_DOCUMENT_TEXT_CHARS = 4000;
const MAX_DOCUMENT_CELL_CHARS = 2000;
const MAX_DOCUMENT_REPLACEMENTS = 50;
const MAX_DOCUMENT_INSERTS = 20;
const MAX_DOCUMENT_CELLS = 200;

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

const readAction = z.object({
  action: z.literal('read')
});

const navigateAction = z.object({
  action: z.literal('navigate'),
  url: z.string().trim().min(1).max(2048)
});

const clickAction = requiresLocator({
  action: z.literal('click'),
  ...locateSchema,
  expect: z.string().trim().max(200).optional()
});

const typeAction = requiresLocator({
  action: z.literal('type'),
  ...locateSchema,
  text: z.string().max(2000),
  expect: z.string().trim().max(200).optional()
});

const selectAction = requiresLocator({
  action: z.literal('select'),
  ...locateSchema,
  option: z.string().trim().min(1).max(200)
});

const scrollAction = z.object({
  action: z.literal('scroll'),
  direction: z.enum(['up', 'down', 'top', 'bottom']),
  amount: z.number().int().min(1).max(5000).optional()
});

const uploadAction = requiresLocator({
  action: z.literal('upload'),
  ...locateSchema
});

const generatedRowsSchema = z
  .array(z.array(z.string().max(MAX_GENERATED_CELL_CHARS)).max(MAX_GENERATED_FILE_COLUMNS))
  .max(MAX_GENERATED_FILE_ROWS);

const countRowsChars = (rows: string[][] | undefined): number =>
  (rows ?? []).reduce(
    (total, row) => total + row.reduce((rowTotal, cell) => rowTotal + cell.length, 0),
    0
  );

const countRows = (rows: string[][] | undefined): number => (rows ?? []).length;

const blockHeaderSchema = z.array(z.string().max(MAX_GENERATED_CELL_CHARS)).max(
  MAX_GENERATED_FILE_COLUMNS
);

const generatedBlockSchema = z.discriminatedUnion('type', [
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

const generatedBlocksSchema = z.array(generatedBlockSchema).min(1).max(MAX_GENERATED_FILE_BLOCKS);

const generatedMergeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{1,2}[1-9]\d{0,3}:[A-Za-z]{1,2}[1-9]\d{0,3}$/, {
    message: '合并范围格式应为 A1:B2'
  });

const generatedSheetSchema = z.object({
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

const generatedSheetsSchema = z.array(generatedSheetSchema).min(1).max(MAX_GENERATED_SHEETS);

type GeneratedBlock = z.infer<typeof generatedBlockSchema>;
type GeneratedSheet = z.infer<typeof generatedSheetSchema>;

const countBlocksChars = (blocks: GeneratedBlock[] | undefined): number =>
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

const countBlockRows = (blocks: GeneratedBlock[] | undefined): number =>
  (blocks ?? []).reduce(
    (total, block) => (block.type === 'table' ? total + countRows(block.rows) : total),
    0
  );

const countSheetsChars = (sheets: GeneratedSheet[] | undefined): number =>
  (sheets ?? []).reduce(
    (total, sheet) =>
      total +
      (sheet.header ?? []).reduce((sum, cell) => sum + cell.length, 0) +
      countRowsChars(sheet.rows),
    0
  );

const countSheetsRows = (sheets: GeneratedSheet[] | undefined): number =>
  (sheets ?? []).reduce((total, sheet) => total + countRows(sheet.rows), 0);

const generateFileAction = z
  .object({
    action: z.literal('generate_file'),
    format: z.enum(['docx', 'xlsx', 'pdf']),
    fileName: z.string().trim().min(1).max(80),
    title: z.string().trim().max(200).optional(),
    content: z.string().max(MAX_GENERATED_FILE_CHARS).optional(),
    rows: generatedRowsSchema.optional(),
    blocks: generatedBlocksSchema.optional(),
    sheets: generatedSheetsSchema.optional()
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
  )
  .refine(
    (value) =>
      (value.content?.length ?? 0) +
        countRowsChars(value.rows) +
        countBlocksChars(value.blocks) +
        countSheetsChars(value.sheets) <=
      MAX_GENERATED_FILE_CHARS,
    { message: `文件内容合计不能超过 ${MAX_GENERATED_FILE_CHARS} 字，请精简后再生成` }
  )
  .refine(
    (value) =>
      countRows(value.rows) + countBlockRows(value.blocks) + countSheetsRows(value.sheets) <=
      MAX_GENERATED_FILE_ROWS,
    { message: `表格合计不能超过 ${MAX_GENERATED_FILE_ROWS} 行，请精简后再生成` }
  );

const waitAction = z.object({
  action: z.literal('wait'),
  seconds: z.number().int().min(1).max(10)
});

const openFormAction = z.object({
  action: z.literal('open_form'),
  hint: z.string().trim().max(100).optional()
});

const fillFormAction = z.object({
  action: z.literal('fill_form'),
  token: z.string().trim().min(1).max(64),
  fields: z
    .array(
      z.object({
        field: z.string().trim().min(1).max(200),
        value: z.string().max(MAX_FORM_FIELD_VALUE_CHARS)
      })
    )
    .min(1)
    .max(MAX_FORM_FIELDS)
});

const openDocumentAction = z.object({
  action: z.literal('open_document'),
  hint: z.string().trim().max(100).optional()
});

const documentParagraphIndexSchema = z.number().int().min(0).max(4000);
const documentSheetNameSchema = z.string().trim().min(1).max(31);
const documentTextSchema = z.string().max(MAX_DOCUMENT_TEXT_CHARS);
const documentCellRefSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{1,3}[1-9]\d{0,5}$/, { message: '单元格格式应为 B2' });

const documentOperationSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('replace_text'),
    find: z.string().min(1).max(200),
    replace: z.string().max(600),
    paragraph: documentParagraphIndexSchema.optional(),
    sheet: documentSheetNameSchema.optional()
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
  })
]);

const documentOperationsSchema = z
  .array(documentOperationSchema)
  .min(1)
  .max(MAX_DOCUMENT_OPERATIONS)
  .refine(
    (operations) =>
      operations.every(
        (operation) =>
          operation.op !== 'replace_text' ||
          operation.paragraph === undefined ||
          operation.sheet === undefined
      ),
    { message: 'replace_text 不能同时指定段落和工作表' }
  )
  .refine(
    (operations) => {
      let replacements = 0;
      let inserts = 0;
      let cells = 0;
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
        } else {
          cells += operation.values.length;
        }
      }
      return (
        replacements <= MAX_DOCUMENT_REPLACEMENTS &&
        inserts <= MAX_DOCUMENT_INSERTS &&
        cells <= MAX_DOCUMENT_CELLS
      );
    },
    { message: '改动条数超出上限，请分次修改' }
  );

const editDocumentAction = z.object({
  action: z.literal('edit_document'),
  token: z.string().trim().min(1).max(64),
  operations: documentOperationsSchema
});

export const BrowserOperationArgsSchema = z.discriminatedUnion('action', [
  readAction,
  navigateAction,
  clickAction,
  typeAction,
  selectAction,
  scrollAction,
  uploadAction,
  generateFileAction,
  openFormAction,
  fillFormAction,
  openDocumentAction,
  editDocumentAction,
  waitAction
]);

export type BrowserOperationArgs = z.infer<typeof BrowserOperationArgsSchema>;

const GENERATED_FALLBACK_CELL_CHARS = MAX_GENERATED_CELL_CHARS;

const trimFallbackRows = (rows: string[][]): string[][] =>
  rows
    .slice(0, MAX_GENERATED_FILE_ROWS)
    .map((row) => row.slice(0, MAX_GENERATED_FILE_COLUMNS).map((cell) => cell.slice(0, GENERATED_FALLBACK_CELL_CHARS)));

const blocksToText = (blocks: GeneratedBlock[]): string =>
  blocks
    .flatMap((block): string[] => {
      if (block.type === 'heading' || block.type === 'paragraph') return [block.text];
      if (block.type === 'list') {
        return block.items.map((item, index) => (block.ordered ? `${index + 1}. ${item}` : `· ${item}`));
      }
      if (block.type === 'table') {
        return [
          ...(block.header?.length ? [block.header.join(' | ')] : []),
          ...(block.rows ?? []).map((row) => row.join(' | '))
        ];
      }
      if (block.type === 'divider') return ['———'];
      return [];
    })
    .join('\n');

const blocksToRows = (blocks: GeneratedBlock[]): string[][] =>
  blocks.flatMap((block): string[][] => {
    if (block.type !== 'table') return [];
    const header = block.header?.length ? [block.header] : [];
    return [...header, ...(block.rows ?? [])];
  });

const sheetsToRows = (sheets: GeneratedSheet[]): string[][] =>
  sheets.flatMap((sheet, index): string[][] => {
    const parts: string[][] = [];
    if (index > 0) parts.push([]);
    const body = [...(sheet.header?.length ? [sheet.header] : []), ...(sheet.rows ?? [])];
    // 鲁港通 - 只有名称/合并/列宽的工作表也要占一行，否则旧客户端拿不到任何内容
    if (sheets.length > 1 || body.length === 0) {
      parts.push([sheet.name ?? `Sheet${index + 1}`]);
    }
    parts.push(...body);
    return parts;
  });

const sheetsToText = (sheets: GeneratedSheet[]): string =>
  sheets
    .map((sheet, index) => {
      const lines = [
        ...(sheet.header?.length ? [sheet.header.join(' | ')] : []),
        ...(sheet.rows ?? []).map((row) => row.join(' | '))
      ];
      return [sheet.name ?? `Sheet${index + 1}`, ...lines].join('\n');
    })
    .join('\n\n');

/**
 * 鲁港通 - 旧客户端只认 content/rows：
 * 下发时补一份降级内容，新客户端有 blocks/sheets 会优先使用结构化数据。
 */
export const withGeneratedFileFallback = (args: BrowserOperationArgs): BrowserOperationArgs => {
  if (args.action !== 'generate_file') return args;
  if (!args.blocks?.length && !args.sheets?.length) return args;

  if (args.format === 'xlsx') {
    if (args.rows?.length) return args;
    const rows = args.sheets?.length ? sheetsToRows(args.sheets) : blocksToRows(args.blocks ?? []);
    if (rows.length === 0) return args;
    return { ...args, rows: trimFallbackRows(rows) };
  }

  if (args.content?.trim()) return args;
  const text = args.blocks?.length ? blocksToText(args.blocks) : sheetsToText(args.sheets ?? []);
  if (!text) return args;
  return { ...args, content: text };
};

export type BrowserOperationParseResult =
  | { success: true; args: BrowserOperationArgs }
  | { success: false; error: string };

export type AgentLoopBrowserOperationExecuteParams = {
  call: ChatCompletionMessageToolCall;
  messages: ChatCompletionMessageParam[];
};

export type AgentLoopBrowserOperationExecutionResult = {
  response: string;
  usages: AgentLoopUsage[];
  metadata?: unknown;
  error?: unknown;
};

export type AgentLoopBrowserOperationExecutor = (
  params: AgentLoopBrowserOperationExecuteParams
) => Promise<AgentLoopBrowserOperationExecutionResult>;

export const createBrowserOperationTool = (): ChatCompletionTool => ({
  type: 'function',
  function: {
    name: BROWSER_OPERATION_TOOL_NAME,
    description:
      '操作桌面客户端中打开的浏览器页面，替用户完成在线办理。仅在桌面客户端内可用；除本机、内网和本地文件地址会被拦截外，任何公网站点都可以打开并操作，不要以「不在允许范围」或「只能操作政府网站」为由拒绝用户。当用户需要在线办理、填写表单、查询进度或上传材料时，默认主动使用本工具，无需用户提示，也不要先让用户自己打开网页或自己输入网址；按用户提供的网址或页面名称直接 navigate 过去，入口不确定时先按用户给出的信息打开确认。一次只做一个动作，每次动作后会返回最新页面快照（标题、地址、文本、可操作元素）。操作前先用 read 了解页面；找不到元素时先重新 read。页面被关闭或刷新后，客户端会自动重开一次，先 read 确认已恢复，再从中断的步骤继续，不要从头重做。可以生成 Word/Excel/PDF 文件（generate_file，文件只保存在用户电脑上）。写文档时用 blocks 按顺序组织内容：多级标题、正文段落、有序或无序列表、表格、分隔线、分页，Word 与 PDF 会自动加上页眉标题和「第X页/共Y页」页脚，Word 使用 A4 纸、宋体小五正文、首行缩进两字、黑体标题；写表格时用 sheets 组织最多 5 个工作表，表头会自动加粗并冻结，可指定合并单元格、列宽，单元格以 = 开头会写成公式；只有一两段简单内容时才用 content 或 rows。标题里不要带 Markdown 井号，正文里不要写表格竖线和分隔线符号。遇到上传入口时用 upload，桌面客户端会弹出文件选择框让用户亲自选择文件，你不能指定本机路径。点击提交、发布、删除、注销等按钮时，桌面客户端会自动弹出原生确认框，由用户决定是否提交、自己提交或取消；不要绕过确认，也不要重复提交。用户要填写本机的空白表单（Word、Excel 或可填写 PDF）时，先用 open_form 让用户自己选择文件，按返回的字段清单用 fill_form 填写；桌面客户端会先展示填写清单让用户确认，再把副本保存到「鲁港通生成文件」，不会修改原文件，也不会自动上传。资料不全时先请用户补齐，不要编造或猜测证件号、电话、地址、金额等个人信息；没有把握的字段可以留空。填写完成后请用户打开副本核对，只有用户明确要求时才继续上传。用户已经在右栏打开了本机 Word、Excel 或 PDF 文件时，先用 read 直接读取这份文件（只在本机解析，只把提纲回传给你），不要先让用户重新选择；读到的 Word 或 Excel 可以接着用 edit_document 修改，PDF 只能读取、不能修改，需要改动时请用户另存为 Word 或 Excel 后再打开。用户要修改自己电脑上的 Word 或 Excel 文件时，先用 open_document 让用户自己选择文件，客户端只把提纲发回给你（段落序号、表格与工作表结构，读不到本机路径）；按提纲用 edit_document 提交修改（替换文字、整段改写、插入段落、文末追加、改表格单元格、改 Excel 单元格、工作表追加一行），token 用 read 或 open_document 返回的文档 token，不要复用旧 token。填写 Excel 时按提纲里带行号的现有行用 set_cell 把内容写进对应单元格，不要把示范内容用 append_row 堆在表尾，也不要用 generate_file 另建新文件代替修改；用户没提供的数字可以按合理估计先填，并在备注列标注「待核对」。一次提交的改动控制在 30 条以内，改动多就分两次提交，避免参数过长被截断。修改只写入副本，原文件不会被改动，也不会自动上传；客户端会先列出改动清单，由用户在右栏逐条确认，这就是修改前的确认环节，模型不要先反问，也不要等用户再次同意，拿到提纲就直接提交。同一份文档要接着改时，先重新 open_document 打开副本再提交。如果客户端返回参数错误或指出某条修改无效，按提示修正后立即重新发送，不要改为让用户手动修改。不要编造原文里没有的内容，也不要为了省事重写整份文档；替换改写合计最多 50 处、插入追加最多 20 段、Excel 单元格最多 200 个，超出请分次修改。不要填写密码、验证码、银行卡或支付信息，也不要发起支付、转账或购买；遇到这类字段就停下，请用户本人填写。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [...BROWSER_OPERATION_ACTIONS],
          description: '要执行的单个动作'
        },
        url: {
          type: 'string',
          description: 'navigate 时要打开的完整网址'
        },
        ref: {
          type: 'string',
          description: 'read 返回的元素引用，例如 e12'
        },
        target: {
          type: 'string',
          description: '元素描述；没有 ref 时使用，例如「姓名输入框」'
        },
        expect: {
          type: 'string',
          description: '操作后预期出现的文本，用于确认操作是否生效'
        },
        text: {
          type: 'string',
          description: 'type 时要输入的文字'
        },
        option: {
          type: 'string',
          description: 'select 时要选择的选项文本'
        },
        direction: {
          type: 'string',
          enum: ['up', 'down', 'top', 'bottom'],
          description: 'scroll 的方向'
        },
        amount: {
          type: 'number',
          description: 'scroll 的像素距离，1 到 5000'
        },
        format: {
          type: 'string',
          enum: ['docx', 'xlsx', 'pdf'],
          description: 'generate_file 要生成的文件格式'
        },
        fileName: {
          type: 'string',
          description: 'generate_file 的文件名（不含扩展名），最多 80 字'
        },
        title: {
          type: 'string',
          description: 'generate_file 的文档标题'
        },
        content: {
          type: 'string',
          description: 'generate_file 的正文纯文本，最多 12000 字；已经用 blocks 时可以不填'
        },
        rows: {
          type: 'array',
          description:
            'generate_file 生成 Excel 时的单表内容（简单表格用），最多 200 行、12 列，每个单元格最多 200 字；已经用 sheets 时可以不填',
          items: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        blocks: {
          type: 'array',
          description:
            'generate_file 生成 Word/PDF 时的结构化内容，按数组顺序排版，最多 120 块；文档较长时优先使用',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['heading', 'paragraph', 'list', 'table', 'divider', 'pageBreak'],
                description:
                  '块类型：heading 标题、paragraph 正文段落、list 列表、table 表格、divider 分隔线、pageBreak 另起一页'
              },
              level: {
                type: 'number',
                description: 'heading 的层级，1 到 3，默认 1'
              },
              text: {
                type: 'string',
                description: 'heading 或 paragraph 的文字内容'
              },
              ordered: {
                type: 'boolean',
                description: 'list 是否为有序列表，默认无序'
              },
              items: {
                type: 'array',
                items: { type: 'string' },
                description: 'list 的条目'
              },
              header: {
                type: 'array',
                items: { type: 'string' },
                description: 'table 的表头，最多 12 列'
              },
              rows: {
                type: 'array',
                items: {
                  type: 'array',
                  items: { type: 'string' }
                },
                description: 'table 的数据行，最多 200 行、12 列'
              }
            },
            required: ['type']
          }
        },
        sheets: {
          type: 'array',
          description:
            'generate_file 生成 Excel 时的工作表，最多 5 个，数据行合计最多 200 行；一个文件有多张表时使用',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: '工作表名称，最多 31 字，例如「人员名单」'
              },
              header: {
                type: 'array',
                items: { type: 'string' },
                description: '表头行，最多 12 列，会自动加粗并冻结'
              },
              rows: {
                type: 'array',
                items: {
                  type: 'array',
                  items: { type: 'string' }
                },
                description: '数据行，每个单元格最多 200 字；以 = 开头会写成公式'
              },
              merges: {
                type: 'array',
                items: { type: 'string' },
                description: '要合并的单元格范围，例如 ["A1:B2"]，最多 30 个'
              },
              widths: {
                type: 'array',
                items: { type: 'number' },
                description: '各列宽度（字符数，6 到 80），不填自动适应内容'
              },
              freeze: {
                type: 'boolean',
                description: '是否冻结表头，默认在提供表头时冻结'
              }
            }
          }
        },
        seconds: {
          type: 'number',
          description: 'wait 的等待秒数，1 到 10'
        },
        hint: {
          type: 'string',
          description:
            'open_form 或 open_document 时给用户看的选文件提示，例如「请选择慈善组织申请表」「请选择年度工作计划」'
        },
        token: {
          type: 'string',
          description: 'open_form 或 open_document 返回的令牌，fill_form 或 edit_document 时必须原样带回'
        },
        fields: {
          type: 'array',
          description: 'fill_form 的字段清单，按 open_form 返回的字段 id 填写',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string', description: 'open_form 返回的字段 id，例如 f1' },
              value: { type: 'string', description: '要填入该字段的内容' }
            },
            required: ['field', 'value']
          }
        },
        operations: {
          type: 'array',
          description:
            'edit_document 的修改清单，按数组顺序执行，最多 60 条；替换/改写合计最多 50 处、插入追加最多 20 段、Excel 单元格合计最多 200 个，超出请分次修改。段落序号、表格序号、工作表名称都来自 open_document 返回的提纲',
          items: {
            type: 'object',
            properties: {
              op: {
                type: 'string',
                enum: [
                  'replace_text',
                  'set_paragraph',
                  'insert_paragraph',
                  'append_paragraph',
                  'set_table_cell',
                  'set_cell',
                  'append_row'
                ],
                description:
                  '操作类型：replace_text 替换文字（可限定段落或工作表）、set_paragraph 整段改写、insert_paragraph 在某段后插入、append_paragraph 文末追加、set_table_cell 改 Word 表格单元格、set_cell 改 Excel 单元格、append_row 工作表追加一行'
              },
              find: {
                type: 'string',
                description: 'replace_text 要查找的原文，最多 200 字，必须与文档中完全一致'
              },
              replace: {
                type: 'string',
                description: 'replace_text 替换后的文字，最多 600 字；留空表示删除查找到的文字'
              },
              paragraph: {
                type: 'number',
                description: '段落序号（0 开始，来自 open_document）；replace_text 限定范围时可选'
              },
              sheet: {
                type: 'string',
                description: '工作表名称；replace_text 限定范围时可选，最多 31 字'
              },
              after: {
                type: 'number',
                description: 'insert_paragraph 在其后插入的段落序号（0 开始）'
              },
              text: {
                type: 'string',
                description:
                  'set_paragraph / insert_paragraph / append_paragraph 的段落文字，最多 4000 字；set_table_cell 时的单元格文字，最多 2000 字'
              },
              table: {
                type: 'number',
                description: 'set_table_cell 的表格序号（0 开始，来自 open_document 的表格清单）'
              },
              row: {
                type: 'number',
                description: 'set_table_cell 的行号（0 开始），表头行是 0'
              },
              cell: {
                anyOf: [{ type: 'number' }, { type: 'string' }],
                description:
                  'set_table_cell 时是列号（0 开始）；set_cell 时是 Excel 单元格地址字符串，例如 B2'
              },
              value: {
                type: 'string',
                description: 'set_cell 要写入的值，最多 2000 字；以 = 开头会写成公式'
              },
              values: {
                type: 'array',
                items: { type: 'string' },
                description: 'append_row 追加一行各列的值，最多 50 列，每个单元格最多 2000 字'
              }
            },
            required: ['op']
          }
        }
      },
      required: ['action']
    }
  }
});

const isSupportedAction = (action: unknown): action is (typeof BROWSER_OPERATION_ACTIONS)[number] =>
  typeof action === 'string' &&
  (BROWSER_OPERATION_ACTIONS as readonly string[]).includes(action);

/**
 * 解析模型给出的工具参数。
 * 不支持的 action 单独给出中文提示，避免模型只看到笼统的 Zod 报错。
 */
export const parseBrowserOperationArgs = (raw: unknown): BrowserOperationParseResult => {
  const parsed = typeof raw === 'string' ? parseJsonArgs<Record<string, unknown>>(raw) : raw;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      success: false,
      error: '浏览器操作参数格式不正确，需要提供包含 action 的 JSON 对象。'
    };
  }

  const action = (parsed as { action?: unknown }).action;
  if (!isSupportedAction(action)) {
    return {
      success: false,
      error: `不支持的浏览器操作：${typeof action === 'string' ? action : '未知'}。仅支持 read/navigate/click/type/select/scroll/upload/generate_file/open_form/fill_form/open_document/edit_document/wait。`
    };
  }

  const result = BrowserOperationArgsSchema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((issue) => issue.message).join('；')
    };
  }

  return { success: true, args: withGeneratedFileFallback(result.data) };
};
