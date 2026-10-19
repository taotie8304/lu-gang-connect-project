import { describe, expect, it, vi } from 'vitest';
import {
  AI_SESSION_IDLE_MS,
  AiController,
  type AiControllerBrowser
} from '../src/main/ai/controller';
import type { AiPageDriver } from '../src/main/ai/executor';
import type { AiAuditRecord } from '../src/main/ai/audit';
import type { AiPageElement, AiPageSnapshot } from '../src/main/ai/snapshot';
import type { DesktopBrowserState } from '../src/shared/ipc';

const PAGE_URL = 'https://www.gov.hk/en/residents/form';
const ALLOWED = ['.gov.hk'];

const makeSnapshot = (elements: Partial<AiPageElement>[] = []): AiPageSnapshot => ({
  url: PAGE_URL,
  title: '测试表单',
  text: '请填写申请信息',
  scroll: { x: 0, y: 0, viewportWidth: 1280, viewportHeight: 800, pageHeight: 2000 },
  elements: elements.map((element, index) => ({
    ref: `e${index + 1}`,
    role: 'textbox',
    name: '',
    tag: 'input',
    ...element
  }))
});

const textField = (name: string, extra: Partial<AiPageElement> = {}): Partial<AiPageElement> => ({
  role: 'textbox',
  name,
  tag: 'input',
  type: 'text',
  ...extra
});

const createBrowser = (): AiControllerBrowser & {
  state: DesktopBrowserState;
  openPanel: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
} => {
  const state: DesktopBrowserState = {
    panelOpen: true,
    activeTabId: 1,
    tabs: [{ id: 1, title: '测试表单', url: PAGE_URL, current: true }],
    loading: false
  };
  return {
    state,
    openPanel: vi.fn(() => {
      state.panelOpen = true;
      return state;
    }),
    navigate: vi.fn((url: string) => {
      state.tabs = [{ id: 1, title: '测试表单', url, current: true }];
      state.activeTabId = 1;
      return true;
    }),
    getState: vi.fn(() => state)
  };
};

const createDriver = (initial: AiPageSnapshot) => {
  let current = initial;
  const driver: AiPageDriver = {
    snapshot: vi.fn(async () => current),
    resolve: vi.fn(async () => ({
      found: true,
      visible: true,
      rect: { x: 10, y: 10, width: 100, height: 24 }
    })),
    prepareInput: vi.fn(async () => ({ ok: true })),
    selectOption: vi.fn(async () => ({ ok: true })),
    scroll: vi.fn(async () => ({
      before: current.scroll,
      after: current.scroll,
      changed: false
    })),
    clickAt: vi.fn(async () => undefined),
    insertText: vi.fn(async () => undefined),
    navigate: vi.fn(async () => undefined),
    settle: vi.fn(async () => undefined)
  };
  return {
    driver,
    setSnapshot: (next: AiPageSnapshot) => {
      current = next;
    },
    snapshotCalls: () => (driver.snapshot as ReturnType<typeof vi.fn>).mock.calls.length
  };
};

const createController = (
  options: {
    elements?: Partial<AiPageElement>[];
    now?: () => number;
    audit?: (record: AiAuditRecord) => Promise<void> | void;
  } = {}
) => {
  const browser = createBrowser();
  const harness = createDriver(makeSnapshot(options.elements ?? []));
  const controller = new AiController({
    browser,
    driver: harness.driver,
    allowedHosts: ALLOWED,
    now: options.now,
    audit: options.audit
  });
  return { browser, controller, ...harness };
};

describe('AI 桌面控制器 · 指令执行与自愈', () => {
  it('成功操作后进入运行状态并记录会话网址', async () => {
    const { controller } = createController({ elements: [textField('申请人姓名')] });

    const result = await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });

    expect(result.ok).toBe(true);
    const state = controller.getState();
    expect(state.status).toBe('running');
    expect(state.sessionUrl).toBe(PAGE_URL);
    expect(state.reopens).toBe(0);
  });

  it('连续两次失败后停止，用户未确认前不再执行', async () => {
    const { controller, snapshotCalls } = createController();

    const first = await controller.execute({ action: 'click', target: '不存在的按钮' });
    expect(first.ok).toBe(false);
    expect(first.stopped).toBeFalsy();

    const second = await controller.execute({ action: 'click', target: '不存在的按钮' });
    expect(second.stopped).toBe(true);
    expect(second.message).toContain('连续两次');

    const state = controller.getState();
    expect(state.status).toBe('stopped');
    expect(state.stopReason).toBe('too_many_failures');

    const callsBefore = snapshotCalls();
    const third = await controller.execute({ action: 'click', target: '不存在的按钮' });
    expect(third.stopped).toBe(true);
    expect(snapshotCalls()).toBe(callsBefore);
  });

  it('用户确认继续后重置停止状态并重新执行', async () => {
    const { controller, setSnapshot } = createController();
    await controller.execute({ action: 'click', target: '不存在的按钮' });
    await controller.execute({ action: 'click', target: '不存在的按钮' });
    expect(controller.getState().status).toBe('stopped');

    setSnapshot(makeSnapshot([textField('申请人姓名')]));
    const resumed = await controller.execute(
      { action: 'type', target: '申请人姓名', text: '李四' },
      { resume: true }
    );

    expect(resumed.ok).toBe(true);
    expect(controller.getState().status).toBe('running');
    expect(controller.getState().stopReason).toBeUndefined();
  });

  it('敏感字段被拦截时立即停止整个会话', async () => {
    const { controller } = createController({
      elements: [textField('登录密码', { type: 'password' })]
    });

    const result = await controller.execute({
      action: 'type',
      target: '登录密码',
      text: 'secret'
    });

    expect(result.ok).toBe(false);
    expect(result.stopped).toBe(true);
    expect(controller.getState().stopReason).toBe('sensitive_blocked');
    expect(controller.getState().message).toContain('不能代为输入');
  });

  it('高风险按钮被拦截时立即停止整个会话', async () => {
    const { controller } = createController({
      elements: [{ role: 'button', name: '提交申请', tag: 'button' }]
    });

    const result = await controller.execute({ action: 'click', target: '提交申请' });

    expect(result.ok).toBe(false);
    expect(result.stopped).toBe(true);
    expect(controller.getState().stopReason).toBe('high_risk_blocked');
  });

  it('页面被关闭后自动重开一次并恢复已填写的非敏感内容', async () => {
    const { browser, controller, driver } = createController({
      elements: [textField('申请人姓名')]
    });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });
    expect(driver.insertText).toHaveBeenCalledTimes(1);

    await controller.handleTabClosed({ id: 1, url: PAGE_URL, active: true });

    expect(browser.openPanel).toHaveBeenCalledTimes(1);
    expect(browser.navigate).toHaveBeenCalledWith(PAGE_URL);
    expect(driver.insertText).toHaveBeenCalledTimes(2);
    expect(driver.insertText).toHaveBeenLastCalledWith('张三');
    const state = controller.getState();
    expect(state.status).toBe('running');
    expect(state.reopens).toBe(1);
  });

  it('页面连续两次被关闭后停止自动重开', async () => {
    const { browser, controller } = createController({
      elements: [textField('申请人姓名')]
    });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });

    await controller.handleTabClosed({ id: 1, url: PAGE_URL, active: true });
    await controller.handleTabClosed({ id: 1, url: PAGE_URL, active: true });

    expect(browser.navigate).toHaveBeenCalledTimes(1);
    const state = controller.getState();
    expect(state.status).toBe('stopped');
    expect(state.stopReason).toBe('page_closed_twice');
    expect(state.message).toContain('再次关闭');
  });

  it('用户关闭非 AI 操作的标签页不会触发重开', async () => {
    const { browser, controller } = createController({
      elements: [textField('申请人姓名')]
    });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });

    await controller.handleTabClosed({ id: 2, url: 'https://www.gov.hk/other', active: false });

    expect(browser.navigate).not.toHaveBeenCalled();
    expect(controller.getState().reopens).toBe(0);
  });

  it('用户关闭整个面板后自动重开当前任务页面', async () => {
    const { browser, controller } = createController({
      elements: [textField('申请人姓名')]
    });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });

    await controller.handlePanelClosed();

    expect(browser.openPanel).toHaveBeenCalledTimes(1);
    expect(browser.navigate).toHaveBeenCalledWith(PAGE_URL);
    expect(controller.getState().reopens).toBe(1);
  });

  it('会话空闲超时后关闭页面不再自动重开', async () => {
    let now = 1_000;
    const { browser, controller } = createController({
      elements: [textField('申请人姓名')],
      now: () => now
    });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });

    now += AI_SESSION_IDLE_MS + 1;
    expect(controller.getState().status).toBe('idle');

    await controller.handleTabClosed({ id: 1, url: PAGE_URL, active: true });

    expect(browser.navigate).not.toHaveBeenCalled();
    expect(controller.getState().reopens).toBe(0);
  });

  it('用户主动停止后拒绝后续指令', async () => {
    const { controller, snapshotCalls } = createController({
      elements: [textField('申请人姓名')]
    });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });

    const stopped = controller.stop();
    expect(stopped.status).toBe('stopped');
    expect(stopped.stopReason).toBe('stopped_by_user');
    expect(stopped.message).toContain('已停止');

    const callsBefore = snapshotCalls();
    const result = await controller.execute({ action: 'read' });
    expect(result.stopped).toBe(true);
    expect(snapshotCalls()).toBe(callsBefore);
  });

  it('停止指令会结束当前会话', async () => {
    const { controller } = createController();
    const result = await controller.execute({ action: 'stop' });

    expect(result.ok).toBe(true);
    expect(result.stopped).toBe(true);
    expect(controller.getState().stopReason).toBe('stopped_by_user');
  });

  it('审计只记录操作元数据，不包含用户输入内容', async () => {
    const records: AiAuditRecord[] = [];
    const { controller } = createController({
      elements: [textField('申请人姓名')],
      audit: (record) => {
        records.push(record);
      }
    });

    await controller.execute(
      { action: 'type', target: '申请人姓名', text: '张三的私密内容' },
      { commandId: 'cmd-1' }
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      commandId: 'cmd-1',
      action: 'type',
      outcome: 'ok',
      host: 'www.gov.hk',
      path: '/en/residents/form',
      target: '申请人姓名'
    });
    expect(JSON.stringify(records[0])).not.toContain('张三的私密内容');
  });

  it('自动重开会写入重开审计记录', async () => {
    const records: AiAuditRecord[] = [];
    const { controller } = createController({
      elements: [textField('申请人姓名')],
      audit: (record) => {
        records.push(record);
      }
    });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });

    await controller.handleTabClosed({ id: 1, url: PAGE_URL, active: true });

    const reopen = records.find((record) => record.action === 'reopen');
    expect(reopen).toMatchObject({ outcome: 'ok', reopen: true, host: 'www.gov.hk' });
  });
});
