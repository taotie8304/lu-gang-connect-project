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
  'wait'
] as const;

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
      '操作桌面客户端中打开的浏览器页面，帮助用户在线办理政府事务。仅在桌面客户端内可用，且只能访问政府官方网站。一次只做一个动作，每次动作后会返回最新页面快照（标题、地址、文本、可操作元素）。操作前先用 read 了解页面；找不到元素时先重新 read；不要填写密码、验证码、支付信息，也不要发起支付或最终提交。',
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
      error: `不支持的浏览器操作：${typeof action === 'string' ? action : '未知'}。仅支持 read/navigate/click/type/select/scroll/wait。`
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
