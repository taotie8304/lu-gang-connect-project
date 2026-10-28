import { describe, expect, it, vi } from 'vitest';
import type { ChatCompletionMessageParam } from '@fastgpt/global/core/ai/llm/type';
import {
  BROWSER_OPERATION_TOOL_NAME,
  BrowserOperationArgsSchema,
  createBrowserOperationTool,
  parseBrowserOperationArgs
} from '@fastgpt/service/core/ai/llm/agentLoop/domain/systemTool/browserOperation';
import {
  createDesktopBrowserOperationExecutor,
  isDesktopBrowserEnabledForUser,
  isDesktopBrowserUrlOperable
} from '@fastgpt/service/support/desktopCommand/browserOperation';
import {
  DESKTOP_BROWSER_RESUME_TTL_MS,
  DESKTOP_BUSY_LONG_TTL_MS,
  getDesktopCommandBusyTtlMs
} from '@fastgpt/service/support/desktopCommand/constant';
import type { DesktopBrowserSnapshot } from '@fastgpt/global/support/desktopCommand/type';
import { createTestStore } from './desktopTestStore';

const deviceId = 'device_12345678';
const commandId = '0f0f0f0f-1111-4222-8333-444444444444';
const identity = {
  tmbId: 'tmb-1',
  uid: 'user-uid-1',
  username: 'jinhui',
  contact: 'jinhui@airscend.com'
};

const snapshot: DesktopBrowserSnapshot = {
  url: 'https://www.immd.gov.hk/hkt/contact.html',
  title: '聯絡我們',
  text: '查詢表格與辦事指南',
  scroll: {
    x: 0,
    y: 120,
    viewportWidth: 800,
    viewportHeight: 600,
    pageHeight: 2400
  },
  elements: [
    {
      ref: 'e12',
      role: 'textbox',
      name: '姓名',
      tag: 'input',
      placeholder: '請輸入姓名',
      inViewport: true
    }
  ]
};

const userMessage = (content: string): ChatCompletionMessageParam =>
  ({ role: 'user', content }) as ChatCompletionMessageParam;

const createFakeStore = () => ({
  getDeviceByOwner: vi.fn(async () => deviceId as string | undefined),
  getDeviceAppVersionByOwner: vi.fn(async () => '0.6.0' as string | undefined),
  isDeviceOnline: vi.fn(async () => true),
  enqueue: vi.fn(async ({ command }: { command: Record<string, unknown> }) => ({
    id: commandId,
    createdAt: 1,
    command
  })),
  waitForResult: vi.fn(async () => ({ ok: true, changed: true, snapshot }) as any),
  saveBrowserResume: vi.fn(async () => {}),
  getBrowserResume: vi.fn(async () => undefined as any)
});

type FakeStore = ReturnType<typeof createFakeStore>;

const createExecutor = ({
  store,
  audit = vi.fn(async () => {}),
  isStopped = () => false,
  messages = [userMessage('帮我填写姓名')],
  sleep = vi.fn(async () => {})
}: {
  store: FakeStore;
  audit?: (record: any) => Promise<void>;
  isStopped?: () => boolean;
  messages?: ChatCompletionMessageParam[];
  sleep?: (ms: number) => Promise<void>;
} = {} as any) => {
  const executor = createDesktopBrowserOperationExecutor({
    store: store as any,
    identity,
    chatId: 'chat-1',
    isStopped,
    audit,
    sleep,
    now: () => 1_700_000_000_000
  });

  return async (args: Record<string, unknown>) => executor(callToolWithMessages(args, messages));
};

const callToolWithMessages = (args: Record<string, unknown>, messages: ChatCompletionMessageParam[]) =>
  ({
    call: {
      id: 'call_1',
      type: 'function',
      function: {
        name: BROWSER_OPERATION_TOOL_NAME,
        arguments: JSON.stringify(args)
      }
    },
    messages
  }) as any;

describe('browser operation tool schema', () => {
  it('exposes a single browser_operation tool with the supported actions', () => {
    const tool = createBrowserOperationTool();

    expect(tool.function.name).toBe(BROWSER_OPERATION_TOOL_NAME);
    expect(tool.function.description).toContain('桌面客户端');
    expect((tool.function.parameters as any).properties.action.enum).toEqual([
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
    ]);
  });

  it('describes local file generation and user-picked uploads', () => {
    const tool = createBrowserOperationTool();
    const parameters = tool.function.parameters as any;

    expect(parameters.properties.format.enum).toEqual(['docx', 'xlsx', 'pdf']);
    expect(parameters.properties.fileName).toBeDefined();
    expect(parameters.properties.content).toBeDefined();
    expect(parameters.properties.rows).toBeDefined();
    expect(parameters.properties.blocks).toBeDefined();
    expect(parameters.properties.sheets).toBeDefined();
    expect(tool.function.description).toContain('生成');
    expect(tool.function.description).toContain('页脚');
    expect(tool.function.description).toContain('冻结');
    expect(tool.function.description).toContain('文件选择');
    expect(tool.function.description).toContain('确认');
  });

  it('tells the model to act without waiting for the user to name the browser', () => {
    const description = createBrowserOperationTool().function.description;

    expect(description).toContain('无需用户提示');
    expect(description).toContain('办理');
    expect(description).toContain('不要先让用户自己打开');
    expect(description).toContain('从中断的步骤继续');
  });

  it('no longer limits operation to government sites', () => {
    const description = createBrowserOperationTool().function.description;

    expect(description).toContain('任何公网站点');
    expect(description).not.toContain('政府官方网站');
    expect(description).not.toContain('只能访问政府');
    expect(description).not.toContain('政府事务');
  });

  it('tells the model to ask for missing details before filling a local form', () => {
    const description = createBrowserOperationTool().function.description;

    expect(description).toContain('open_form');
    expect(description).toContain('fill_form');
    expect(description).toContain('不要编造');
    expect(description).toContain('核对');
  });

  it('parses generate_file and upload actions', () => {
    expect(
      parseBrowserOperationArgs({
        action: 'generate_file',
        format: 'docx',
        fileName: '申请书',
        title: '申请书',
        content: '申请正文'
      })
    ).toMatchObject({ success: true, args: { action: 'generate_file', format: 'docx' } });

    expect(parseBrowserOperationArgs({ action: 'upload', ref: 'e20' })).toMatchObject({
      success: true,
      args: { action: 'upload', ref: 'e20' }
    });
  });

  it('requires content for generate_file and a locator for upload', () => {
    expect(
      BrowserOperationArgsSchema.safeParse({
        action: 'generate_file',
        format: 'pdf',
        fileName: '空白文件'
      }).success
    ).toBe(false);
    expect(BrowserOperationArgsSchema.safeParse({ action: 'upload' }).success).toBe(false);
    expect(
      BrowserOperationArgsSchema.safeParse({
        action: 'upload',
        target: '上传附件'
      }).success
    ).toBe(true);
  });

  it('accepts structured blocks and prepares legacy text for old clients', () => {
    const parsed = parseBrowserOperationArgs({
      action: 'generate_file',
      format: 'docx',
      fileName: '申请须知',
      blocks: [
        { type: 'heading', text: '一、申请条件' },
        { type: 'paragraph', text: '申请人须年满十八岁。' },
        { type: 'list', ordered: true, items: ['身份证明', '住址证明'] },
        { type: 'table', header: ['项目', '要求'], rows: [['年龄', '18 岁以上']] }
      ]
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success || parsed.args.action !== 'generate_file') return;
    expect(parsed.args.blocks).toHaveLength(4);
    expect(parsed.args.blocks?.[3]).toMatchObject({ type: 'table' });
    expect(parsed.args.content).toContain('一、申请条件');
    expect(parsed.args.content).toContain('1. 身份证明');
    expect(parsed.args.content).toContain('项目 | 要求');
  });

  it('accepts multiple sheets and prepares legacy rows for old clients', () => {
    const parsed = parseBrowserOperationArgs({
      action: 'generate_file',
      format: 'xlsx',
      fileName: '成绩汇总',
      sheets: [
        {
          name: '人员名单',
          header: ['姓名', '分数'],
          rows: [
            ['张三', '90'],
            ['李四', '=SUM(B2:B2)']
          ],
          merges: ['A4:B4'],
          widths: [16, 10],
          freeze: true
        },
        { name: '说明', rows: [['本表由助手生成']] }
      ]
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success || parsed.args.action !== 'generate_file') return;
    expect(parsed.args.sheets).toHaveLength(2);
    expect(parsed.args.rows?.[0]).toEqual(['人员名单']);
    expect(parsed.args.rows?.[1]).toEqual(['姓名', '分数']);
    expect(parsed.args.rows?.[3]).toEqual(['李四', '=SUM(B2:B2)']);
    expect(parsed.args.rows?.flat()).toContain('说明');
  });

  it('工作表只有名称时也给旧客户端补一行内容', () => {
    const parsed = parseBrowserOperationArgs({
      action: 'generate_file',
      format: 'xlsx',
      fileName: '空白模板',
      sheets: [{ name: '填写说明', merges: ['A1:B1'], widths: [20, 20] }]
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success || parsed.args.action !== 'generate_file') return;
    expect(parsed.args.rows).toEqual([['填写说明']]);
  });

  it('enforces the document budgets and rejects malformed blocks', () => {
    const base = { action: 'generate_file', format: 'docx', fileName: '报告' } as const;

    expect(parseBrowserOperationArgs({ ...base, content: 'x'.repeat(12000) }).success).toBe(true);
    expect(parseBrowserOperationArgs({ ...base, content: 'x'.repeat(12001) }).success).toBe(false);
    expect(
      parseBrowserOperationArgs({
        ...base,
        blocks: [{ type: 'heading', text: '标题' }, { type: 'video', text: '不支持' }]
      }).success
    ).toBe(false);
    expect(
      parseBrowserOperationArgs({
        ...base,
        format: 'xlsx',
        sheets: [
          {
            header: ['姓名'],
            rows: Array.from({ length: 201 }, () => ['张三'])
          }
        ]
      }).success
    ).toBe(false);
    expect(
      parseBrowserOperationArgs({
        ...base,
        format: 'xlsx',
        sheets: [{ name: '名单', merges: ['B2'] }]
      }).success
    ).toBe(false);
  });

  it('parses open_form and fill_form actions', () => {
    expect(parseBrowserOperationArgs({ action: 'open_form' })).toMatchObject({
      success: true,
      args: { action: 'open_form' }
    });
    expect(
      parseBrowserOperationArgs({
        action: 'open_form',
        hint: '慈善组织申请表'
      })
    ).toMatchObject({ success: true, args: { action: 'open_form', hint: '慈善组织申请表' } });
    expect(
      parseBrowserOperationArgs({
        action: 'fill_form',
        token: 'lgform_abc123',
        fields: [
          { field: 'f1', value: '张三' },
          { field: 'f2', value: '' }
        ]
      })
    ).toMatchObject({ success: true, args: { action: 'fill_form', token: 'lgform_abc123' } });
  });

  it('rejects incomplete or oversized fill_form payloads', () => {
    expect(BrowserOperationArgsSchema.safeParse({ action: 'fill_form', fields: [] }).success).toBe(
      false
    );
    expect(
      BrowserOperationArgsSchema.safeParse({ action: 'fill_form', token: 'lgform_abc', fields: [] })
        .success
    ).toBe(false);
    expect(
      BrowserOperationArgsSchema.safeParse({
        action: 'fill_form',
        token: 'lgform_abc',
        fields: [{ field: 'f1', value: 'x'.repeat(2001) }]
      }).success
    ).toBe(false);
    expect(
      BrowserOperationArgsSchema.safeParse({
        action: 'fill_form',
        token: 'lgform_abc',
        fields: Array.from({ length: 201 }, (_, index) => ({ field: `f${index}`, value: 'x' }))
      }).success
    ).toBe(false);
  });

  it('parses open_document and edit_document actions', () => {
    expect(parseBrowserOperationArgs({ action: 'open_document' })).toMatchObject({
      success: true,
      args: { action: 'open_document' }
    });
    expect(
      parseBrowserOperationArgs({ action: 'open_document', hint: '请选择年度工作计划' })
    ).toMatchObject({ success: true, args: { action: 'open_document', hint: '请选择年度工作计划' } });

    const parsed = parseBrowserOperationArgs({
      action: 'edit_document',
      token: 'lgdoc_abc123',
      operations: [
        { op: 'replace_text', find: '2023年', replace: '2024年', paragraph: 1 },
        { op: 'append_paragraph', text: '备注：待补充。' }
      ]
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success || parsed.args.action !== 'edit_document') return;
    expect(parsed.args.token).toBe('lgdoc_abc123');
    expect(parsed.args.operations).toHaveLength(2);
  });

  it('rejects unknown document operations and malformed cell references', () => {
    expect(
      parseBrowserOperationArgs({
        action: 'edit_document',
        token: 'lgdoc_abc',
        operations: [{ op: 'delete_paragraph', paragraph: 1 }]
      }).success
    ).toBe(false);
    expect(
      parseBrowserOperationArgs({
        action: 'edit_document',
        token: 'lgdoc_abc',
        operations: [{ op: 'set_cell', sheet: '总表', cell: '2B', value: '1' }]
      }).success
    ).toBe(false);
    expect(
      parseBrowserOperationArgs({ action: 'edit_document', token: 'lgdoc_abc', operations: [] })
        .success
    ).toBe(false);
  });

  it('enforces the edit caps for word replacements, inserts and excel cells', () => {
    const edit = (operations: unknown[]) =>
      parseBrowserOperationArgs({ action: 'edit_document', token: 'lgdoc_abc', operations }).success;

    expect(
      edit(
        Array.from({ length: 50 }, (_, index) => ({
          op: 'replace_text',
          find: `a${index}`,
          replace: 'b'
        }))
      )
    ).toBe(true);
    expect(
      edit(
        Array.from({ length: 51 }, (_, index) => ({
          op: 'replace_text',
          find: `a${index}`,
          replace: 'b'
        }))
      )
    ).toBe(false);
    expect(
      edit(Array.from({ length: 20 }, (_, index) => ({ op: 'insert_paragraph', after: index, text: 'x' })))
    ).toBe(true);
    expect(
      edit(Array.from({ length: 21 }, (_, index) => ({ op: 'insert_paragraph', after: index, text: 'x' })))
    ).toBe(false);
    expect(
      edit(
        Array.from({ length: 50 }, () => ({
          op: 'append_row',
          sheet: '总表',
          values: ['a', 'b', 'c', 'd']
        }))
      )
    ).toBe(true);
    expect(
      edit(
        Array.from({ length: 51 }, () => ({
          op: 'append_row',
          sheet: '总表',
          values: ['a', 'b', 'c', 'd']
        }))
      )
    ).toBe(false);
  });

  it('rejects oversized generated file content and rows', () => {
    expect(
      BrowserOperationArgsSchema.safeParse({
        action: 'generate_file',
        format: 'docx',
        fileName: '超长文件',
        content: 'x'.repeat(12001)
      }).success
    ).toBe(false);
    expect(
      BrowserOperationArgsSchema.safeParse({
        action: 'generate_file',
        format: 'xlsx',
        fileName: '超长表格',
        rows: Array.from({ length: 201 }, () => ['a'])
      }).success
    ).toBe(false);
  });

  it('parses navigate and locator based actions', () => {
    expect(
      parseBrowserOperationArgs(JSON.stringify({ action: 'navigate', url: 'https://www.gov.hk' }))
    ).toEqual({
      success: true,
      args: { action: 'navigate', url: 'https://www.gov.hk' }
    });

    expect(
      parseBrowserOperationArgs(JSON.stringify({ action: 'click', ref: 'e12' }))
    ).toMatchObject({ success: true, args: { action: 'click', ref: 'e12' } });
  });

  it('rejects a locator action without ref or target', () => {
    const result = parseBrowserOperationArgs(JSON.stringify({ action: 'click' }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('需要提供元素引用或元素描述');
    }
  });

  it('rejects unsupported actions with a Chinese message', () => {
    const result = parseBrowserOperationArgs(JSON.stringify({ action: 'submit' }));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('不支持');
      expect(result.error).toContain('read');
    }
  });

  it('rejects an oversized text input', () => {
    const parsed = BrowserOperationArgsSchema.safeParse({
      action: 'type',
      ref: 'e12',
      text: 'x'.repeat(2001)
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects a wait outside one to ten seconds', () => {
    expect(BrowserOperationArgsSchema.safeParse({ action: 'wait', seconds: 0 }).success).toBe(false);
    expect(BrowserOperationArgsSchema.safeParse({ action: 'wait', seconds: 11 }).success).toBe(false);
    expect(BrowserOperationArgsSchema.safeParse({ action: 'wait', seconds: 3 }).success).toBe(true);
  });
});

describe('desktop browser grey list', () => {
  it('stays disabled by default and for explicit off values', () => {
    expect(isDesktopBrowserEnabledForUser(identity, undefined)).toBe(false);
    expect(isDesktopBrowserEnabledForUser(identity, '')).toBe(false);
    expect(isDesktopBrowserEnabledForUser(identity, 'off')).toBe(false);
    expect(isDesktopBrowserEnabledForUser(identity, 'false')).toBe(false);
  });

  it('enables everyone with all or star', () => {
    expect(isDesktopBrowserEnabledForUser(identity, 'all')).toBe(true);
    expect(isDesktopBrowserEnabledForUser(identity, '*')).toBe(true);
  });

  it('matches a comma separated list by email, username, tmbId or uid', () => {
    expect(isDesktopBrowserEnabledForUser(identity, 'JINHUI@airscend.com')).toBe(true);
    expect(isDesktopBrowserEnabledForUser(identity, 'someone@example.com, jinhui')).toBe(true);
    expect(isDesktopBrowserEnabledForUser(identity, 'tmb-1')).toBe(true);
    expect(isDesktopBrowserEnabledForUser(identity, 'user-uid-1')).toBe(true);
    expect(isDesktopBrowserEnabledForUser(identity, 'root')).toBe(false);
  });

  it('always enables the root account', () => {
    expect(
      isDesktopBrowserEnabledForUser({ ...identity, username: 'root' }, 'jinhui@airscend.com')
    ).toBe(true);
  });

  it('rejects users outside the list', () => {
    expect(isDesktopBrowserEnabledForUser(identity, 'other@example.com')).toBe(false);
  });
});

describe('desktop browser url policy', () => {
  it('allows any public http/https site', () => {
    expect(isDesktopBrowserUrlOperable('https://www.gov.hk/en/residents/')).toBe(true);
    expect(isDesktopBrowserUrlOperable('https://www.empf.org.hk/register')).toBe(true);
    expect(isDesktopBrowserUrlOperable('https://example.com/login')).toBe(true);
    expect(isDesktopBrowserUrlOperable('http://www.gov.cn/zhengce/')).toBe(true);
  });

  it('rejects loopback, private and non-http addresses', () => {
    expect(isDesktopBrowserUrlOperable('http://127.0.0.1:3100/form')).toBe(false);
    expect(isDesktopBrowserUrlOperable('http://localhost:8123/')).toBe(false);
    expect(isDesktopBrowserUrlOperable('http://192.168.1.1/')).toBe(false);
    expect(isDesktopBrowserUrlOperable('https://10.20.30.40/portal')).toBe(false);
    expect(isDesktopBrowserUrlOperable('javascript:alert(1)')).toBe(false);
    expect(isDesktopBrowserUrlOperable('file:///C:/secret.txt')).toBe(false);
    expect(isDesktopBrowserUrlOperable('not a url')).toBe(false);
  });
});

describe('desktop command store waiting and resume state', () => {
  it('polls until a result arrives and returns undefined on timeout', async () => {
    const { store, now } = createTestStore();
    const envelope = await store.enqueue({ deviceId, command: { action: 'read' } });
    let saved = false;
    const originalSleep = (store as any).sleep as (ms: number) => Promise<void>;
    (store as any).sleep = async (ms: number) => {
      await originalSleep(ms);
      if (!saved) {
        saved = true;
        await store.saveResult({
          commandId: envelope.id,
          result: { ok: true, changed: true, snapshot }
        });
      }
    };

    await expect(
      store.waitForResult({ commandId: envelope.id, timeoutMs: 5_000 })
    ).resolves.toMatchObject({ ok: true, changed: true });
    await expect(store.waitForResult({ commandId: 'missing', timeoutMs: 1_000 })).resolves.toBeUndefined();
    expect(now()).toBeGreaterThan(1_000);
  });

  it('saves browser resume state per member and chat with a ten minute ttl', async () => {
    const { store, redis, advance } = createTestStore();
    const resume = {
      goal: '填写姓名',
      url: 'https://www.immd.gov.hk/hkt/contact.html',
      updatedAt: 1_000
    };

    await store.saveBrowserResume({ tmbId: 'tmb-1', chatId: 'chat-1', resume });

    await expect(
      store.getBrowserResume({ tmbId: 'tmb-1', chatId: 'chat-1' })
    ).resolves.toEqual(resume);
    await expect(
      store.getBrowserResume({ tmbId: 'tmb-1', chatId: 'chat-2' })
    ).resolves.toBeUndefined();
    expect(redis.setCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: expect.stringContaining('browser-resume'),
          ttlMs: DESKTOP_BROWSER_RESUME_TTL_MS
        })
      ])
    );

    advance(DESKTOP_BROWSER_RESUME_TTL_MS);
    await expect(
      store.getBrowserResume({ tmbId: 'tmb-1', chatId: 'chat-1' })
    ).resolves.toBeUndefined();
  });
});

describe('desktop browser operation executor', () => {
  it('asks the user to open the desktop client when no device is registered', async () => {
    const store = createFakeStore();
    store.getDeviceByOwner.mockResolvedValue(undefined);
    const audit = vi.fn(async () => {});
    const execute = createExecutor({ store, audit });

    const result = await execute({ action: 'read' });

    expect(result.response).toContain('桌面客户端');
    expect(result.response).toContain('登录');
    expect(store.enqueue).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'read', ok: false, code: 'device_missing' })
    );
  });

  it('reports an offline device instead of retrying forever', async () => {
    const store = createFakeStore();
    store.isDeviceOnline.mockResolvedValue(false);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'read' });

    expect(result.response).toContain('不在线');
    expect(store.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a loopback navigate before touching the device', async () => {
    const store = createFakeStore();
    const execute = createExecutor({ store });

    const result = await execute({ action: 'navigate', url: 'http://127.0.0.1:3100/admin' });

    expect(result.response).toContain('本机');
    expect(store.enqueue).not.toHaveBeenCalled();
  });

  it('navigates to any public site', async () => {
    const store = createFakeStore();
    const execute = createExecutor({ store });

    const result = await execute({ action: 'navigate', url: 'https://www.empf.org.hk/register' });

    expect(store.enqueue).toHaveBeenCalledWith({
      deviceId,
      command: { action: 'navigate', url: 'https://www.empf.org.hk/register' }
    });
    expect(result.response).toContain('操作已执行');
  });

  it('sends a click command and returns the fresh snapshot', async () => {
    const store = createFakeStore();
    const execute = createExecutor({ store });

    const result = await execute({ action: 'click', ref: 'e12', expect: '已提交' });

    expect(store.enqueue).toHaveBeenCalledWith({
      deviceId,
      command: { action: 'click', ref: 'e12', expect: '已提交' }
    });
    expect(store.waitForResult).toHaveBeenCalledWith(
      expect.objectContaining({ commandId })
    );
    expect(result.response).toContain('操作已执行');
    expect(result.response).toContain('https://www.immd.gov.hk/hkt/contact.html');
    expect(result.response).toContain('[e12]');
    expect(result.response).toContain('姓名');
  });

  it('types text without writing the input into the audit record', async () => {
    const store = createFakeStore();
    const audit = vi.fn(async () => {});
    const execute = createExecutor({ store, audit });

    const result = await execute({ action: 'type', ref: 'e12', text: '张三' });

    expect(store.enqueue).toHaveBeenCalledWith({
      deviceId,
      command: { action: 'type', ref: 'e12', text: '张三' }
    });
    expect(result.response).toContain('操作已执行');
    const record = audit.mock.calls[0][0] as any;
    expect(record).toMatchObject({
      tmbId: 'tmb-1',
      uid: 'user-uid-1',
      chatId: 'chat-1',
      deviceId,
      action: 'type',
      ok: true,
      url: snapshot.url
    });
    expect(record).not.toHaveProperty('text');
    expect(JSON.stringify(record)).not.toContain('张三');
  });

  it('refuses password or verification code targets before enqueueing', async () => {
    const store = createFakeStore();
    const audit = vi.fn(async () => {});
    const execute = createExecutor({ store, audit });

    const result = await execute({ action: 'type', target: '登录密码', text: 'secret' });

    expect(result.response).toContain('密码');
    expect(result.response).toContain('本人');
    expect(store.enqueue).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'type', ok: false, code: 'sensitive_blocked' })
    );
  });

  it('refuses bank card targets before enqueueing', async () => {
    const store = createFakeStore();
    const execute = createExecutor({ store });

    const result = await execute({ action: 'type', target: '银行卡号', text: '6222' });

    expect(result.response).toContain('本人');
    expect(store.enqueue).not.toHaveBeenCalled();
  });

  it('generates a local file without writing its content into the audit log', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      file: {
        name: '香港慈善组织申请说明.docx',
        format: 'docx',
        folder: 'C:\\Users\\tester\\Downloads\\鲁港通生成文件'
      }
    } as any);
    const audit = vi.fn(async () => {});
    const execute = createExecutor({ store, audit });

    const result = await execute({
      action: 'generate_file',
      format: 'docx',
      fileName: '香港慈善组织申请说明',
      content: '这是一段不能写进审计正文'
    });

    expect(store.enqueue).toHaveBeenCalledWith({
      deviceId,
      command: expect.objectContaining({
        action: 'generate_file',
        format: 'docx',
        fileName: '香港慈善组织申请说明'
      })
    });
    expect(result.response).toContain('香港慈善组织申请说明.docx');
    expect(result.response).toContain('鲁港通生成文件');
    expect(result.response).toContain('只保存在你的电脑上');
    const record = audit.mock.calls[0][0] as any;
    expect(record).toMatchObject({ action: 'generate_file', ok: true });
    expect(JSON.stringify(record)).not.toContain('不能写进审计正文');
  });

  it('reports the file the user picked for upload', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      changed: true,
      file: { name: '申请书.docx' },
      snapshot
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'upload', target: '上传附件' });

    expect(store.enqueue).toHaveBeenCalledWith({
      deviceId,
      command: { action: 'upload', target: '上传附件' }
    });
    expect(result.response).toContain('申请书.docx');
    expect(result.response).toContain('已附加');
    expect(result.response).toContain('[e12]');
  });

  it('records the confirmation decision without the action label', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      snapshot,
      confirmation: { required: true, decision: 'allow', label: '提交申请' }
    } as any);
    const audit = vi.fn(async () => {});
    const execute = createExecutor({ store, audit });

    const result = await execute({ action: 'click', ref: 'e12' });

    expect(result.response).toContain('已提交');
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'click', ok: true, confirmation: 'allow' })
    );
    expect(JSON.stringify(audit.mock.calls[0][0])).not.toContain('提交申请');
  });

  it('hands the page back to the user without retrying', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: false,
      code: 'handed_over',
      stopped: true,
      confirmation: { required: true, decision: 'handoff', label: '提交申请' }
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'click', ref: 'e12' });

    expect(result.response).toContain('交还');
    expect(result.response).toContain('不要重试');
    expect(result.response).not.toContain('重新读取页面');
  });

  it('waits long enough for native confirmation when clicking', async () => {
    const store = createFakeStore();
    const execute = createExecutor({ store });

    await execute({ action: 'read' });
    await execute({ action: 'click', ref: 'e12' });

    const [readWait, clickWait] = (store.waitForResult as any).mock.calls;
    expect(readWait[0].timeoutMs).toBeLessThanOrEqual(60_000);
    expect(clickWait[0].timeoutMs).toBeGreaterThan(5 * 60 * 1000);
  });

  it('waits long enough for the user to pick a file when uploading', async () => {
    const store = createFakeStore();
    const execute = createExecutor({ store });

    await execute({ action: 'upload', target: '上传附件' });

    const uploadWait = (store.waitForResult as any).mock.calls[0];
    expect(uploadWait[0].timeoutMs).toBeGreaterThan(5 * 60 * 1000);
  });

  it('waits on the server before reading the page again', async () => {
    const store = createFakeStore();
    const sleep = vi.fn(async () => {});
    const execute = createExecutor({ store, sleep });

    const result = await execute({ action: 'wait', seconds: 3 });

    expect(sleep).toHaveBeenCalledWith(3_000);
    expect(store.enqueue).toHaveBeenCalledWith({ deviceId, command: { action: 'read' } });
    expect(result.response).toContain('操作已执行');
  });

  it('reports a timeout when the device never returns a result', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue(undefined as any);
    const audit = vi.fn(async () => {});
    const execute = createExecutor({ store, audit });

    const result = await execute({ action: 'read' });

    expect(result.response).toContain('没有返回结果');
    expect(result.response).toContain('确认');
    expect(result.response).toContain('选择文件');
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'read', ok: false, code: 'timeout' })
    );
  });

  it('passes the client stop message to the model and asks before retrying', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: false,
      stopped: true,
      message: '页面被再次关闭，我已停止自动重开。请确认是否还要继续操作这个页面，确认后我再继续。'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'read' });

    expect(result.response).toContain('页面被再次关闭');
    expect(result.response).toContain('询问用户');
    expect(result.response).not.toContain('请先重新读取页面');
  });

  it('does not enqueue when the user already pressed stop', async () => {
    const store = createFakeStore();
    const execute = createExecutor({ store, isStopped: () => true });

    const result = await execute({ action: 'read' });

    expect(result.response).toContain('停止');
    expect(store.enqueue).not.toHaveBeenCalled();
  });

  it('asks the user before continuing after the page was closed twice', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: false,
      code: 'page_closed_twice',
      stopped: true,
      message: '页面被再次关闭，我已停止自动重开。'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'read' });

    expect(result.response).toContain('询问用户');
    expect(result.response).toContain('是否继续');
    expect(result.response).not.toContain('操作已被桌面客户端停止');
  });

  it('tells the model to resume from the interrupted step after a page error', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: false,
      code: 'page_error',
      snapshot
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'read' });

    expect(result.response).toContain('重新读取页面');
    expect(result.response).toContain('从中断的步骤继续');
  });

  it('maps a failed desktop result to actionable Chinese guidance', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: false,
      code: 'not_found',
      message: 'element missing',
      snapshot
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'click', ref: 'e99' });

    expect(result.response).toContain('找不到目标元素');
    expect(result.response).toContain('重新读取页面');
    expect(result.response).toContain('[e12]');
  });

  it('saves the resume url and goal after a successful action', async () => {
    const store = createFakeStore();
    const execute = createExecutor({ store });

    await execute({ action: 'read' });

    expect(store.saveBrowserResume).toHaveBeenCalledWith({
      tmbId: 'tmb-1',
      chatId: 'chat-1',
      resume: {
        goal: '帮我填写姓名',
        url: snapshot.url,
        updatedAt: 1_700_000_000_000
      }
    });
  });

  it('reminds the model of the previous task when the user sends a new message', async () => {
    const store = createFakeStore();
    store.getBrowserResume.mockResolvedValue({
      goal: '上一轮：填写申请表',
      url: 'https://www.immd.gov.hk/hkt/apply.html',
      updatedAt: 1
    } as any);
    const execute = createExecutor({ store, messages: [userMessage('继续')] });

    const result = await execute({ action: 'read' });

    expect(result.response).toContain('上一轮浏览器任务');
    expect(result.response).toContain('上一轮：填写申请表');
    expect(result.response).toContain('https://www.immd.gov.hk/hkt/apply.html');
    expect(store.saveBrowserResume).toHaveBeenCalledWith(
      expect.objectContaining({
        resume: expect.objectContaining({
          goal: '上一轮：填写申请表',
          url: snapshot.url
        })
      })
    );
  });

  it('does not repeat the resume hint for the same task', async () => {
    const store = createFakeStore();
    store.getBrowserResume.mockResolvedValue({
      goal: '帮我填写姓名',
      url: snapshot.url,
      updatedAt: 1
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'read' });

    expect(result.response).not.toContain('上一轮浏览器任务');
  });

  it('keeps working when the audit writer fails', async () => {
    const store = createFakeStore();
    const audit = vi.fn(async () => {
      throw new Error('mongo down');
    });
    const execute = createExecutor({ store, audit });

    const result = await execute({ action: 'read' });

    expect(result.response).toContain('操作已执行');
  });
});

describe('desktop form filling', () => {
  const formSummary = {
    format: 'docx' as const,
    name: '慈善组织申请表.docx',
    title: '慈善组织申请表',
    fields: [
      { id: 'f1', label: '机构名称', kind: 'text' as const, required: true },
      { id: 'f2', label: '组织类型', kind: 'choice' as const, options: ['社团', '公司'] },
      { id: 'f3', label: '成立日期', kind: 'date' as const }
    ]
  };

  const fillFields = [{ field: 'f1', value: '香港慈善总会' }];

  it('opens a local form and lists field ids for the model to fill', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      form: formSummary,
      formToken: 'lgform_abc'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'open_form', hint: '请选择慈善组织申请表' });

    expect(store.enqueue).toHaveBeenCalledWith({
      deviceId,
      command: { action: 'open_form', hint: '请选择慈善组织申请表' }
    });
    expect(result.response).toContain('慈善组织申请表.docx');
    expect(result.response).toContain('Word');
    expect(result.response).toContain('f1');
    expect(result.response).toContain('机构名称');
    expect(result.response).toContain('必填');
    expect(result.response).toContain('社团');
    expect(result.response).toContain('fill_form');
  });

  it('warns the model when the field list was truncated', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      form: { ...formSummary, fieldsTruncated: true, warnings: ['部分表格列过多'] },
      formToken: 'lgform_abc'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'open_form' });

    expect(result.response).toContain('只列出了一部分');
    expect(result.response).toContain('部分表格列过多');
  });

  it('waits for the user to pick a form file and to confirm filling', async () => {
    const store = createFakeStore();
    const execute = createExecutor({ store });

    await execute({ action: 'open_form' });
    await execute({ action: 'fill_form', token: 'lgform_abc', fields: fillFields });

    const [openWait, fillWait] = (store.waitForResult as any).mock.calls;
    expect(openWait[0].timeoutMs).toBeGreaterThan(5 * 60 * 1000);
    expect(fillWait[0].timeoutMs).toBeGreaterThan(5 * 60 * 1000);
  });

  it('keeps the device online long enough while a form is being picked or confirmed', () => {
    expect(getDesktopCommandBusyTtlMs('open_form')).toBe(DESKTOP_BUSY_LONG_TTL_MS);
    expect(getDesktopCommandBusyTtlMs('fill_form')).toBe(DESKTOP_BUSY_LONG_TTL_MS);
  });

  it('fills a copy and tells the model where it was saved', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      file: {
        name: '慈善组织申请表-已填写.docx',
        format: 'docx',
        folder: '鲁港通生成文件'
      },
      fill: {
        filled: 3,
        skipped: ['「成立日期」缺少可用内容，已跳过'],
        warnings: ['工作表受保护，部分单元格只读']
      }
    } as any);
    const audit = vi.fn(async () => {});
    const execute = createExecutor({ store, audit });

    const result = await execute({
      action: 'fill_form',
      token: 'lgform_abc',
      fields: fillFields
    });

    expect(store.enqueue).toHaveBeenCalledWith({
      deviceId,
      command: { action: 'fill_form', token: 'lgform_abc', fields: fillFields }
    });
    expect(result.response).toContain('慈善组织申请表-已填写.docx');
    expect(result.response).toContain('共填写 3 项');
    expect(result.response).toContain('成立日期');
    expect(result.response).toContain('工作表受保护');
    expect(result.response).toContain('原文件');
    expect(JSON.stringify(audit.mock.calls[0][0])).not.toContain('香港慈善总会');
  });

  it('tells the model to reopen the form when the token expired', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({ ok: false, code: 'form_expired' } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'fill_form', token: 'stale', fields: fillFields });

    expect(result.response).toContain('失效');
    expect(result.response).toContain('open_form');
  });

  it('asks the user to fill password like fields by hand', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({ ok: false, code: 'form_field_blocked' } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'fill_form', token: 'lgform_abc', fields: fillFields });

    expect(result.response).toContain('本人');
    expect(result.response).toContain('密码');
  });

  it('does not retry after the user cancelled the fill confirmation', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: false,
      code: 'confirmation_declined',
      message: '你取消了这次表单填写，没有生成任何文件。'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'fill_form', token: 'lgform_abc', fields: fillFields });

    expect(result.response).toContain('没有生成副本');
    expect(result.response).not.toContain('提交确认');
  });

  it('tells the model to let the user pick the file again after cancelling', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({ ok: false, code: 'form_cancelled' } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'open_form' });

    expect(result.response).toContain('取消');
    expect(result.response).toContain('不要重试');
  });

  it('does not overwrite the page resume state with a local form action', async () => {
    const store = createFakeStore();
    store.getBrowserResume.mockResolvedValue({
      goal: '填写申请表',
      url: 'https://www.immd.gov.hk/hkt/apply.html',
      updatedAt: 1
    } as any);
    store.waitForResult.mockResolvedValue({
      ok: true,
      form: formSummary,
      formToken: 'lgform_abc'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'open_form' });

    expect(store.saveBrowserResume).not.toHaveBeenCalled();
    expect(result.response).not.toContain('上一轮浏览器任务');
  });
});

describe('desktop document editing', () => {
  const documentSummary = {
    format: 'docx' as const,
    name: '2024年工作计划.docx',
    paragraphs: [
      { index: 0, text: '2024年工作计划', style: 'Heading1' },
      { index: 1, text: '今年目标：2023年完成 10 个项目。' },
      { index: 2, text: '备注：无。' }
    ],
    tables: [{ index: 0, rows: 2, cells: 3, header: ['序号', '事项', '负责人'] }],
    warnings: ['文档内含批注，修改时不会保留']
  };

  const editOperations = [{ op: 'replace_text', find: '2023年', replace: '2024年', paragraph: 1 }];

  it('tells the model to open a local document before editing it', () => {
    const description = createBrowserOperationTool().function.description;

    expect(description).toContain('open_document');
    expect(description).toContain('edit_document');
    expect(description).toContain('副本');
    expect(description).toContain('原文件');
    expect(description).toContain('确认');
  });

  it('refuses an old client before opening a document', async () => {
    const store = createFakeStore();
    store.getDeviceAppVersionByOwner.mockResolvedValue('0.5.0');
    const audit = vi.fn(async () => {});
    const execute = createExecutor({ store, audit });

    const result = await execute({ action: 'open_document' });

    expect(result.response).toContain('升级');
    expect(store.enqueue).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'open_document', ok: false, code: 'desktop_upgrade_required' })
    );
  });

  it('refuses an old client before editing a document', async () => {
    const store = createFakeStore();
    store.getDeviceAppVersionByOwner.mockResolvedValue('0.5.9');
    const execute = createExecutor({ store });

    const result = await execute({
      action: 'edit_document',
      token: 'lgdoc_abc',
      operations: editOperations
    });

    expect(result.response).toContain('升级');
    expect(store.enqueue).not.toHaveBeenCalled();
  });

  it('opens a document and lists paragraph indexes for editing', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      document: documentSummary,
      documentToken: 'lgdoc_abc'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'open_document', hint: '请选择年度工作计划' });

    expect(store.enqueue).toHaveBeenCalledWith({
      deviceId,
      command: { action: 'open_document', hint: '请选择年度工作计划' }
    });
    expect(result.response).toContain('2024年工作计划.docx');
    expect(result.response).toContain('Word');
    expect(result.response).toContain('[1]');
    expect(result.response).toContain('2023年完成 10 个项目');
    expect(result.response).toContain('序号 | 事项 | 负责人');
    expect(result.response).toContain('批注');
    expect(result.response).toContain('replace_text');
    expect(result.response).toContain('edit_document');
  });

  it('shows sheet names and sample rows for excel documents', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      document: {
        format: 'xlsx',
        name: '预算表.xlsx',
        sheets: [
          {
            name: '总表',
            rowCount: 12,
            columnCount: 3,
            header: ['项目', '预算', '实际'],
            sampleRows: [['交通', '5000', '4200']]
          }
        ]
      },
      documentToken: 'lgdoc_xlsx'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'open_document' });

    expect(result.response).toContain('预算表.xlsx');
    expect(result.response).toContain('Excel');
    expect(result.response).toContain('「总表」');
    expect(result.response).toContain('列对照：A=项目；B=预算；C=实际');
    expect(result.response).toContain('第 2 行：A2=交通；B2=5000；C2=4200');
    expect(result.response).toContain('set_cell');
  });

  it('edits a copy and reports what was applied without the edit content', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      file: { name: '2024年工作计划-已修改.docx', format: 'docx', folder: '鲁港通生成文件' },
      edit: {
        applied: 2,
        skipped: ['「第 3 段」没有找到要替换的文字'],
        warnings: ['文档内含批注，修改时不会保留']
      }
    } as any);
    const audit = vi.fn(async () => {});
    const execute = createExecutor({ store, audit });

    const result = await execute({
      action: 'edit_document',
      token: 'lgdoc_abc',
      operations: editOperations
    });

    expect(store.enqueue).toHaveBeenCalledWith({
      deviceId,
      command: { action: 'edit_document', token: 'lgdoc_abc', operations: editOperations }
    });
    expect(result.response).toContain('2024年工作计划-已修改.docx');
    expect(result.response).toContain('鲁港通生成文件');
    expect(result.response).toContain('共完成 2 处修改');
    expect(result.response).toContain('第 3 段');
    expect(result.response).toContain('批注');
    expect(result.response).toContain('原文件');
    expect(JSON.stringify(audit.mock.calls[0][0])).not.toContain('2024年');
  });

  it('回传副本的新 token，让模型接着改而不再弹选择窗口', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      file: { name: '2024年工作计划-已修改.docx', format: 'docx', folder: '鲁港通生成文件' },
      edit: { applied: 1 },
      document: { ...documentSummary, name: '2024年工作计划-已修改.docx' },
      documentToken: 'lgdoc_copy'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({
      action: 'edit_document',
      token: 'lgdoc_abc',
      operations: editOperations
    });

    expect(result.response).toContain('lgdoc_copy');
    expect(result.response).toContain('继续');
    expect(result.response).not.toContain('先重新用 open_document 打开');
  });

  it('工具说明：Excel 也在右栏逐条确认，改完不要重新打开', () => {
    const description = createBrowserOperationTool().function.description;

    expect(description).toContain('Excel');
    expect(description).toContain('右栏');
    expect(description).toContain('副本');
    expect(description).not.toContain('同一份文档要接着改时，先重新 open_document');
  });

  it('tells the model to reopen the document when the token expired', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({ ok: false, code: 'document_expired' } as any);
    const execute = createExecutor({ store });

    const result = await execute({
      action: 'edit_document',
      token: 'stale',
      operations: editOperations
    });

    expect(result.response).toContain('失效');
    expect(result.response).toContain('open_document');
  });

  it('does not retry after the user cancelled the edit confirmation', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: false,
      code: 'confirmation_declined',
      message: '你取消了这次修改，没有生成任何副本。'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({
      action: 'edit_document',
      token: 'lgdoc_abc',
      operations: editOperations
    });

    expect(result.response).toContain('没有生成副本');
    expect(result.response).toContain('不要重试');
    expect(result.response).not.toContain('提交确认');
  });

  it('explains that nothing matched when the document had no change', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: false,
      code: 'document_no_change',
      message: '没有找到需要修改的文字，未生成副本。'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({
      action: 'edit_document',
      token: 'lgdoc_abc',
      operations: editOperations
    });

    expect(result.response).toContain('没有生成副本');
    expect(result.response).toContain('open_document');
  });

  it('asks the user to pick the document again after cancelling selection', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({ ok: false, code: 'document_cancelled' } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'open_document' });

    expect(result.response).toContain('取消');
    expect(result.response).toContain('不要重试');
  });

  it('waits for the user to pick and confirm a document and stays online', async () => {
    const store = createFakeStore();
    const execute = createExecutor({ store });

    await execute({ action: 'open_document' });
    await execute({
      action: 'edit_document',
      token: 'lgdoc_abc',
      operations: editOperations
    });

    const [openWait, editWait] = (store.waitForResult as any).mock.calls;
    expect(openWait[0].timeoutMs).toBeGreaterThan(5 * 60 * 1000);
    expect(editWait[0].timeoutMs).toBeGreaterThan(5 * 60 * 1000);
    expect(getDesktopCommandBusyTtlMs('open_document')).toBe(DESKTOP_BUSY_LONG_TTL_MS);
    expect(getDesktopCommandBusyTtlMs('edit_document')).toBe(DESKTOP_BUSY_LONG_TTL_MS);
  });

  it('does not overwrite the page resume state with a local document action', async () => {
    const store = createFakeStore();
    store.getBrowserResume.mockResolvedValue({
      goal: '填写申请表',
      url: 'https://www.immd.gov.hk/hkt/apply.html',
      updatedAt: 1
    } as any);
    store.waitForResult.mockResolvedValue({
      ok: true,
      document: documentSummary,
      documentToken: 'lgdoc_abc'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'open_document' });

    expect(store.saveBrowserResume).not.toHaveBeenCalled();
    expect(result.response).not.toContain('上一轮浏览器任务');
  });

  it('tells the model to read the file the user already opened in the panel', () => {
    const description = createBrowserOperationTool().function.description;

    expect(description).toContain('右栏');
    expect(description).toContain('不要先让用户重新选择');
    expect(description).toContain('PDF 只能读取');
  });

  it('reads the file opened in the right panel and keeps it editable', async () => {
    const store = createFakeStore();
    store.getBrowserResume.mockResolvedValue({
      goal: '填写申请表',
      url: 'https://www.immd.gov.hk/hkt/apply.html',
      updatedAt: 1
    } as any);
    store.waitForResult.mockResolvedValue({
      ok: true,
      document: documentSummary,
      documentToken: 'lgdoc_panel'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'read' });

    expect(store.enqueue).toHaveBeenCalledWith({ deviceId, command: { action: 'read' } });
    expect(result.response).toContain('右栏');
    expect(result.response).toContain('2024年工作计划.docx');
    expect(result.response).toContain('[1]');
    expect(result.response).toContain('2023年完成 10 个项目');
    expect(result.response).toContain('edit_document');
    expect(result.response).not.toContain('上一轮浏览器任务');
    expect(store.saveBrowserResume).not.toHaveBeenCalled();
  });

  it('reports a pdf opened in the right panel as read only', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      document: { format: 'pdf', name: '2024年報稅表.pdf' }
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'read' });

    expect(result.response).toContain('2024年報稅表.pdf');
    expect(result.response).toContain('PDF');
    expect(result.response).toContain('不能修改');
    expect(result.response).not.toContain('edit_document');
    expect(store.saveBrowserResume).not.toHaveBeenCalled();
  });
});

describe('desktop document editing · 参数容错与自主执行', () => {
  const editFileResult = {
    ok: true,
    file: { name: '预算表-已修改.xlsx', format: 'xlsx', folder: '鲁港通生成文件' },
    edit: { applied: 2 }
  };

  it('tells the model to act first and treat the panel list as the confirmation', () => {
    const description = createBrowserOperationTool().function.description;

    expect(description).toContain('不要先反问');
    expect(description).toContain('改动清单');
    expect(description).toContain('按提示修正');
  });

  it('normalizes string indexes, numeric text and column letters before dispatch', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue(editFileResult as any);
    const execute = createExecutor({ store });

    await execute({
      action: 'edit_document',
      token: 'lgdoc_abc',
      operations: [
        { op: 'set_cell', sheet: '总表', cell: 'b10', value: 5000 },
        { op: 'set_table_cell', table: '0', row: '1', cell: 'B', text: 300 },
        { op: 'append_row', sheet: '总表', values: ['场地租金', 10000] }
      ]
    });

    expect(store.enqueue).toHaveBeenCalledWith({
      deviceId,
      command: {
        action: 'edit_document',
        token: 'lgdoc_abc',
        operations: [
          { op: 'set_cell', sheet: '总表', cell: 'B10', value: '5000' },
          { op: 'set_table_cell', table: 0, row: 1, cell: 1, text: '300' },
          { op: 'append_row', sheet: '总表', values: ['场地租金', '10000'] }
        ]
      }
    });
  });

  it('explains which field is wrong instead of dispatching an unusable edit', async () => {
    const store = createFakeStore();
    const execute = createExecutor({ store });

    const result = await execute({
      action: 'edit_document',
      token: 'lgdoc_abc',
      operations: [{ op: 'set_cell', sheet: '总表', value: '5000' }]
    });

    expect(store.enqueue).not.toHaveBeenCalled();
    expect(result.response).toContain('set_cell');
    expect(result.response).toContain('cell');
    expect(result.response).toContain('立即重新发送');
  });

  it('tells the model to fix and resend when the client rejects the command', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: false,
      code: 'invalid_command',
      message: 'operations.0.text 需要填写文字内容'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({
      action: 'edit_document',
      token: 'lgdoc_abc',
      operations: [{ op: 'append_paragraph', text: '补充说明' }]
    });

    expect(result.response).toContain('operations.0.text');
    expect(result.response).toContain('立即重新发送');
    expect(result.response).not.toContain('确认页面状态');
  });

  it('prints the header row and sample row numbers so cell addresses are unambiguous', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      document: {
        format: 'xlsx',
        name: '收支預算表.xlsx',
        sheets: [
          {
            name: '收支預算',
            rowCount: 20,
            columnCount: 4,
            header: ['項目', '預算金額', '實際金額', '備註'],
            headerRow: 10,
            sampleRows: [
              ['場地租金', '10000', '', '按實際'],
              ['宣傳費用', '5000', '', ''],
              ['合計', '15000', '', '']
            ],
            sampleRowNumbers: [11, 12, 20]
          }
        ]
      },
      documentToken: 'lgdoc_budget'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'open_document' });

    expect(result.response).toContain('表头在第 10 行');
    expect(result.response).toContain('列对照：A=項目；B=預算金額；C=實際金額；D=備註');
    expect(result.response).toContain('第 11 行：A11=場地租金；B11=10000；D11=按實際');
    expect(result.response).toContain('第 20 行：A20=合計；B20=15000');
    expect(result.response).toContain('由用户确认');
    expect(result.response).toContain('set_cell');
  });

  it('prints merged and formula columns so the model never guesses the input column', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      document: {
        format: 'xlsx',
        name: '附件三_收支預算表範本.xlsx',
        sheets: [
          {
            name: 'Form',
            rowCount: 83,
            columnCount: 7,
            headerRow: 12,
            header: ['', '支出項目', '', '', '單價(元)', '數量', '數額(元)'],
            columns: [
              { col: 'A', header: '' },
              { col: 'B', header: '支出項目' },
              { col: 'C', header: '', mergedTo: 'B' },
              { col: 'D', header: '', mergedTo: 'B' },
              { col: 'E', header: '單價(元)' },
              { col: 'F', header: '數量' },
              { col: 'G', header: '數額(元)', formula: true }
            ],
            sampleRows: [['', '1. 往返交通費', '', '', '30', '2', '60']],
            sampleRowNumbers: [16]
          }
        ]
      },
      documentToken: 'lgdoc_columns'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'open_document' });

    expect(result.response).toContain('列对照：A=（无表头）');
    expect(result.response).toContain('B=支出項目');
    expect(result.response).toContain('C=（并入 B 列，填写用 B）');
    expect(result.response).toContain('G=數額(元)（公式列，不要填写）');
    expect(result.response).toContain('第 16 行：B16=1. 往返交通費；E16=30；F16=2；G16=60（公式）');
    expect(result.response).toContain('只填空白输入格');
  });
});

describe('desktop document editing · 首次即改与独立填写', () => {
  const formSummary = {
    format: 'xlsx',
    name: '民青局交流項目申請表.xlsx',
    sheets: [
      {
        name: 'Form',
        rowCount: 83,
        columnCount: 10,
        headerRow: 40,
        header: ['支出項目', '單位', '數量', '單價', '小計'],
        sampleRows: [
          ['團體名稱', '香港山東僑界聯合會', '', '', ''],
          ['1. 往返交通費', '人／程', '', '', '']
        ],
        sampleRowNumbers: [41, 42],
        rowLabels: [
          { row: 2, text: '團體名稱' },
          { row: 40, text: '支出項目' },
          { row: 42, text: '往返交通費' }
        ]
      }
    ]
  };

  it('prints the document token so the model can submit the first edit directly', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      document: formSummary,
      documentToken: 'lgdoc_form'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'open_document' });

    expect(result.response).toContain('lgdoc_form');
    expect(result.response).toContain('token');
    expect(result.response).toContain('原样');
  });

  it('prints the token when reading the file opened in the right panel', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      document: formSummary,
      documentToken: 'lgdoc_panel_form'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'read' });

    expect(result.response).toContain('lgdoc_panel_form');
    expect(result.response).toContain('原样');
  });

  it('never offers a token for a read only pdf', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      document: { format: 'pdf', name: '申請須知.pdf' }
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'read' });

    expect(result.response).not.toContain('token：');
    expect(result.response).toContain('不能修改');
  });

  it('does not claim success when open_document returns no document content', async () => {
    const store = createFakeStore();
    const audit = vi.fn(async () => {});
    const execute = createExecutor({ store, audit });

    const result = await execute({ action: 'open_document' });

    expect(result.response).not.toContain('操作已执行');
    expect(result.response).toContain('没有返回文档内容');
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'open_document', ok: false, code: 'document_missing' })
    );
  });

  it('renders row labels for form sheets whose rows are beyond the sample window', async () => {
    const store = createFakeStore();
    store.waitForResult.mockResolvedValue({
      ok: true,
      document: formSummary,
      documentToken: 'lgdoc_form'
    } as any);
    const execute = createExecutor({ store });

    const result = await execute({ action: 'open_document' });

    expect(result.response).toContain('行标签');
    expect(result.response).toContain('第 2 行 團體名稱');
  });

  it('forbids demo appends and separate files when the task is filling a real sheet', () => {
    const description = createBrowserOperationTool().function.description;

    expect(description).toContain('表尾');
    expect(description).toContain('另建');
    expect(description).toContain('待核对');
    expect(description).toContain('分两次');
  });

  it('asks the model to split the batch when the raw arguments are not valid json', async () => {
    const store = createFakeStore();
    const executor = createDesktopBrowserOperationExecutor({
      store: store as any,
      identity,
      chatId: 'chat-1',
      isStopped: () => false,
      audit: vi.fn(async () => {}),
      sleep: vi.fn(async () => {}),
      now: () => 1
    });

    const result = await executor({
      call: {
        id: 'call_1',
        type: 'function',
        function: {
          name: BROWSER_OPERATION_TOOL_NAME,
          arguments: '{"action":"edit_document","token":"lgdoc_abc","operations":[{"op":"set_cell"'
        }
      },
      messages: [userMessage('请直接填写右侧表格')]
    } as any);

    expect(store.enqueue).not.toHaveBeenCalled();
    expect(result.response).toContain('分两次');
  });
});
