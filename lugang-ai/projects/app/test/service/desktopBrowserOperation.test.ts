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
import { DESKTOP_BROWSER_RESUME_TTL_MS } from '@fastgpt/service/support/desktopCommand/constant';
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

const callTool = (args: Record<string, unknown>) =>
  ({
    call: {
      id: 'call_1',
      type: 'function',
      function: {
        name: BROWSER_OPERATION_TOOL_NAME,
        arguments: JSON.stringify(args)
      }
    },
    messages: [userMessage('帮我填写姓名')]
  }) as any;

const createFakeStore = () => ({
  getDeviceByOwner: vi.fn(async () => deviceId as string | undefined),
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
    expect(tool.function.description).toContain('生成');
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

  it('rejects oversized generated file content and rows', () => {
    expect(
      BrowserOperationArgsSchema.safeParse({
        action: 'generate_file',
        format: 'docx',
        fileName: '超长文件',
        content: 'x'.repeat(8001)
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
