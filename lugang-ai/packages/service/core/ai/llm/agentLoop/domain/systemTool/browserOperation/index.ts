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
  'wait'
] as const;

const refSchema = z.string().trim().min(1).max(32);
const targetSchema = z.string().trim().min(1).max(200);
const MAX_GENERATED_FILE_CHARS = 8000;
const MAX_GENERATED_FILE_ROWS = 200;
const MAX_GENERATED_FILE_COLUMNS = 12;
const MAX_GENERATED_CELL_CHARS = 200;

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

const generateFileAction = z
  .object({
    action: z.literal('generate_file'),
    format: z.enum(['docx', 'xlsx', 'pdf']),
    fileName: z.string().trim().min(1).max(80),
    title: z.string().trim().max(200).optional(),
    content: z.string().max(MAX_GENERATED_FILE_CHARS).optional(),
    rows: generatedRowsSchema.optional()
  })
  .refine((value) => Boolean(value.content?.trim() || value.title?.trim() || value.rows?.length), {
    message: '需要提供文件内容'
  })
  .refine(
    (value) =>
      (value.content?.length ?? 0) + countRowsChars(value.rows) <= MAX_GENERATED_FILE_CHARS,
    { message: `文件内容合计不能超过 ${MAX_GENERATED_FILE_CHARS} 字，请精简后再生成` }
  );

const waitAction = z.object({
  action: z.literal('wait'),
  seconds: z.number().int().min(1).max(10)
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
  waitAction
]);

export type BrowserOperationArgs = z.infer<typeof BrowserOperationArgsSchema>;

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
      '操作桌面客户端中打开的浏览器页面，替用户完成在线办理。仅在桌面客户端内可用；除本机、内网和本地文件地址会被拦截外，任何公网站点都可以打开并操作，不要以「不在允许范围」或「只能操作政府网站」为由拒绝用户。当用户需要在线办理、填写表单、查询进度或上传材料时，默认主动使用本工具，无需用户提示，也不要先让用户自己打开网页或自己输入网址；按用户提供的网址或页面名称直接 navigate 过去，入口不确定时先按用户给出的信息打开确认。一次只做一个动作，每次动作后会返回最新页面快照（标题、地址、文本、可操作元素）。操作前先用 read 了解页面；找不到元素时先重新 read。页面被关闭或刷新后，客户端会自动重开一次，先 read 确认已恢复，再从中断的步骤继续，不要从头重做。可以生成 Word/Excel/PDF 文件（generate_file，文件只保存在用户电脑上）；遇到上传入口时用 upload，桌面客户端会弹出文件选择框让用户亲自选择文件，你不能指定本机路径。点击提交、发布、删除、注销等按钮时，桌面客户端会自动弹出原生确认框，由用户决定是否提交、自己提交或取消；不要绕过确认，也不要重复提交。不要填写密码、验证码、银行卡或支付信息，也不要发起支付、转账或购买；遇到这类字段就停下，请用户本人填写。',
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
          description: 'generate_file 的正文，最多 8000 字'
        },
        rows: {
          type: 'array',
          description:
            'generate_file 生成 Excel 时的表格内容，最多 200 行、12 列，每个单元格最多 200 字',
          items: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        seconds: {
          type: 'number',
          description: 'wait 的等待秒数，1 到 10'
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
      error: `不支持的浏览器操作：${typeof action === 'string' ? action : '未知'}。仅支持 read/navigate/click/type/select/scroll/upload/generate_file/wait。`
    };
  }

  const result = BrowserOperationArgsSchema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((issue) => issue.message).join('；')
    };
  }

  return { success: true, args: result.data };
};
