import { describe, expect, it, vi } from 'vitest';
import {
  AI_SESSION_IDLE_MS,
  AiController,
  type AiControllerBrowser
} from '../src/main/ai/controller';
import type {
  AiConfirmationDecision,
  AiConfirmer,
  AiFailureHighlight,
  AiFileGenerator,
  AiFormConfirmer,
  AiFormFiller,
  AiFormOpener,
  AiPageDriver
} from '../src/main/ai/executor';
import type { AiAuditRecord } from '../src/main/ai/audit';
import type { ParsedForm } from '../src/main/ai/form/types';
import type { AiPageElement, AiPageSnapshot } from '../src/main/ai/snapshot';
import type { DesktopBrowserState, DesktopSiteAiMode } from '../src/shared/ipc';

const PAGE_URL = 'https://www.gov.hk/en/residents/form';

const makeSnapshot = (
  elements: Partial<AiPageElement>[] = [],
  overrides: Partial<AiPageSnapshot> = {}
): AiPageSnapshot => ({
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
  })),
  ...overrides
});

const textField = (name: string, extra: Partial<AiPageElement> = {}): Partial<AiPageElement> => ({
  role: 'textbox',
  name,
  tag: 'input',
  type: 'text',
  ...extra
});

const createBrowser = (
  siteAiModes: Record<string, DesktopSiteAiMode> = {}
): AiControllerBrowser & {
  state: DesktopBrowserState;
  openPanel: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  activateTab: ReturnType<typeof vi.fn>;
  setAiLockedTab: ReturnType<typeof vi.fn>;
  showFailureHighlight: ReturnType<typeof vi.fn>;
  clearFailureHighlight: ReturnType<typeof vi.fn>;
  selectTab: (id: number) => void;
} => {
  const state: DesktopBrowserState = {
    panelOpen: true,
    activeTabId: 1,
    tabs: [{ id: 1, title: '测试表单', url: PAGE_URL, current: true }],
    loading: false,
    canGoBack: false,
    canGoForward: false,
    zoomPercent: 100
  };
  const selectTab = (id: number) => {
    if (!state.tabs.some((tab) => tab.id === id)) return;
    state.activeTabId = id;
    state.tabs = state.tabs.map((tab) => ({ ...tab, current: tab.id === id }));
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
    getState: vi.fn(() => state),
    activateTab: vi.fn((id: number) => {
      selectTab(id);
      return state;
    }),
    setAiLockedTab: vi.fn((_id: number | null) => undefined),
    // 鲁港通 - 站点 AI 权限按 origin 查表，未设置的站点默认允许
    getSiteAiMode: vi.fn((origin: string) => siteAiModes[origin] ?? 'allow'),
    showFailureHighlight: vi.fn((_tabId: number, _highlight: AiFailureHighlight) => undefined),
    clearFailureHighlight: vi.fn((_tabId: number) => undefined),
    selectTab
  };
};

const createDriver = (
  initial: AiPageSnapshot,
  options: {
    afterClick?: AiPageSnapshot;
    coveredBy?: {
      tag?: string;
      role?: string;
      name?: string;
      rect?: { x: number; y: number; width: number; height: number };
    };
  } = {}
) => {
  let current = initial;
  const driver: AiPageDriver = {
    snapshot: vi.fn(async () => current),
    resolve: vi.fn(async () => ({
      found: true,
      visible: true,
      rect: { x: 10, y: 10, width: 100, height: 24 },
      ...(options.coveredBy ? { coveredBy: options.coveredBy } : {})
    })),
    prepareInput: vi.fn(async () => ({ ok: true })),
    selectOption: vi.fn(async () => ({ ok: true })),
    scroll: vi.fn(async () => ({
      before: current.scroll,
      after: current.scroll,
      changed: false
    })),
    fileInput: vi.fn(async () => ({
      found: true,
      isFile: true,
      count: 0,
      names: []
    })),
    setFileInputFiles: vi.fn(async () => true),
    clickAt: vi.fn(async () => {
      if (options.afterClick) current = options.afterClick;
    }),
    insertText: vi.fn(async () => undefined),
    navigate: vi.fn(async () => undefined),
    captureScreen: async () => ({ mime: 'image/jpeg', base64: 'abc', width: 100, height: 100 }),
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
    idleMs?: number;
    audit?: (record: AiAuditRecord) => Promise<void> | void;
    confirm?: AiConfirmer;
    generateFile?: AiFileGenerator;
    openForm?: AiFormOpener;
    fillForm?: AiFormFiller;
    confirmForm?: AiFormConfirmer;
    afterClick?: AiPageSnapshot;
    siteAiModes?: Record<string, DesktopSiteAiMode>;
    coveredBy?: {
      tag?: string;
      role?: string;
      name?: string;
      rect?: { x: number; y: number; width: number; height: number };
    };
  } = {}
) => {
  const browser = createBrowser(options.siteAiModes);
  const harness = createDriver(makeSnapshot(options.elements ?? []), {
    afterClick: options.afterClick,
    coveredBy: options.coveredBy
  });
  const controller = new AiController({
    browser,
    driver: harness.driver,
    now: options.now,
    idleMs: options.idleMs,
    audit: options.audit,
    confirm: options.confirm,
    generateFile: options.generateFile,
    openForm: options.openForm,
    fillForm: options.fillForm,
    confirmForm: options.confirmForm
  });
  return { browser, controller, ...harness };
};

describe('AI 桌面控制器 · 指令执行与自愈', () => {
  it('操作会话持续 10 分钟', () => {
    expect(AI_SESSION_IDLE_MS).toBe(10 * 60 * 1000);
  });

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
    expect(second.code).toBe('too_many_failures');
    expect(second.message).toContain('连续两次');

    const state = controller.getState();
    expect(state.status).toBe('stopped');
    expect(state.stopReason).toBe('too_many_failures');

    const callsBefore = snapshotCalls();
    const third = await controller.execute({ action: 'click', target: '不存在的按钮' });
    expect(third.stopped).toBe(true);
    expect(third.code).toBe('too_many_failures');
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

  it('支付类按钮被拦截时立即停止整个会话', async () => {
    const confirm = vi.fn<AiConfirmer>(async () => 'allow');
    const { controller } = createController({
      elements: [{ role: 'button', name: '确认支付', tag: 'button' }],
      confirm
    });

    const result = await controller.execute({ action: 'click', target: '确认支付' });

    expect(result.ok).toBe(false);
    expect(result.stopped).toBe(true);
    expect(controller.getState().stopReason).toBe('high_risk_blocked');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('提交申请经用户确认后只执行一次并停止会话', async () => {
    const records: AiAuditRecord[] = [];
    const confirm = vi.fn<AiConfirmer>(async () => 'allow');
    const { controller, driver } = createController({
      elements: [{ role: 'button', name: '提交申请', tag: 'button' }],
      confirm,
      afterClick: makeSnapshot([], {}),
      audit: (record) => {
        records.push(record);
      }
    });

    const result = await controller.execute(
      { action: 'click', target: '提交申请' },
      { commandId: 'cmd-submit' }
    );

    expect(result.ok).toBe(true);
    expect(result.stopped).toBe(true);
    expect(driver.clickAt).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({
      status: 'stopped',
      stopReason: 'submitted'
    });
    expect(controller.getState().message).toContain('结束');
    expect(records[0]).toMatchObject({
      commandId: 'cmd-submit',
      action: 'click',
      outcome: 'stopped',
      target: '提交申请',
      confirmation: { required: true, decision: 'allow', label: '提交申请' }
    });

    const next = await controller.execute({ action: 'click', target: '下一步' });
    expect(next.stopped).toBe(true);
    expect(driver.clickAt).toHaveBeenCalledTimes(1);
  });

  it('用户选择自己提交后停止并交还页面', async () => {
    const { controller, driver } = createController({
      elements: [{ role: 'button', name: '提交申请', tag: 'button' }],
      confirm: async () => 'handoff'
    });

    const result = await controller.execute({ action: 'click', target: '提交申请' });

    expect(result.ok).toBe(false);
    expect(result.stopped).toBe(true);
    expect(controller.getState().stopReason).toBe('handed_over');
    expect(driver.clickAt).not.toHaveBeenCalled();
  });

  it('用户在确认框取消或超时后停止会话', async () => {
    const cancelHarness = createController({
      elements: [{ role: 'button', name: 'publish', tag: 'button', text: '发布文章' }],
      confirm: async () => 'cancel'
    });
    const cancelled = await cancelHarness.controller.execute({
      action: 'click',
      target: '发布文章'
    });
    expect(cancelled.ok).toBe(false);
    expect(cancelHarness.controller.getState().stopReason).toBe('confirmation_declined');
    expect(cancelHarness.driver.clickAt).not.toHaveBeenCalled();

    const timeoutHarness = createController({
      elements: [{ role: 'button', name: '删除记录', tag: 'button' }],
      confirm: async () => 'timeout'
    });
    const timeout = await timeoutHarness.controller.execute({
      action: 'click',
      target: '删除记录'
    });
    expect(timeout.ok).toBe(false);
    expect(timeoutHarness.controller.getState().stopReason).toBe('confirmation_timeout');
    expect(timeoutHarness.driver.clickAt).not.toHaveBeenCalled();
  });

  it('客户端无法弹出确认框时停止而不是直接提交', async () => {
    const { controller, driver } = createController({
      elements: [{ role: 'button', name: '提交申请', tag: 'button' }]
    });

    const result = await controller.execute({ action: 'click', target: '提交申请' });

    expect(result.ok).toBe(false);
    expect(result.stopped).toBe(true);
    expect(controller.getState().stopReason).toBe('confirmation_unavailable');
    expect(driver.clickAt).not.toHaveBeenCalled();
  });

  it('确认后点击未显示成功结果时停止并交用户核对', async () => {
    const { controller, driver } = createController({
      elements: [{ role: 'button', name: '提交申请', tag: 'button' }],
      confirm: async () => 'allow',
      afterClick: makeSnapshot([], { text: '系统繁忙' })
    });

    const result = await controller.execute({
      action: 'click',
      target: '提交申请',
      expect: '提交成功'
    });

    expect(result.ok).toBe(false);
    expect(result.stopped).toBe(true);
    expect(result.code).toBe('submission_unconfirmed');
    expect(controller.getState().stopReason).toBe('submission_unconfirmed');
    expect(result.message).toContain('提交成功');
    expect(driver.clickAt).toHaveBeenCalledTimes(1);
  });

  it('生成文件审计只记动作与结果，不记文件名或内容', async () => {
    const records: AiAuditRecord[] = [];
    const { controller } = createController({
      generateFile: async (input) => ({
        name: `${input.fileName}.${input.format}`,
        format: input.format,
        folder: '下载 / 鲁港通生成文件',
        path: 'C:\\Users\\tester\\Downloads\\鲁港通生成文件\\机密申请书.docx'
      }),
      audit: (record) => {
        records.push(record);
      }
    });

    const result = await controller.execute({
      action: 'generate_file',
      format: 'docx',
      fileName: '机密申请书',
      content: '身份证号 123456'
    });

    expect(result.ok).toBe(true);
    expect(records).toHaveLength(1);
    expect(records[0].action).toBe('generate_file');
    expect(JSON.stringify(records[0])).not.toContain('机密申请书');
    expect(JSON.stringify(records[0])).not.toContain('123456');
    expect(JSON.stringify(records[0])).not.toContain('C:\\');
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

  it('页面被关闭导致的失败不计入连续失败次数', async () => {
    const { controller, driver } = createController({
      elements: [textField('申请人姓名')]
    });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });

    await controller.handleTabClosed({ id: 1, url: PAGE_URL, active: true });

    // 页面刚关闭时读取失败属于关页副作用，不应消耗连续失败额度
    (driver.snapshot as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('page closed'));
    const closedFailure = await controller.execute({ action: 'read' });
    expect(closedFailure.ok).toBe(false);
    expect(closedFailure.code).toBe('page_error');
    expect(closedFailure.stopped).toBeFalsy();

    // 真正的第一次操作失败仍不停止；若关页失败被计数，这里就会停止
    const firstRealFailure = await controller.execute({ action: 'click', target: '不存在的按钮' });
    expect(firstRealFailure.ok).toBe(false);
    expect(firstRealFailure.stopped).toBeFalsy();
    expect(controller.getState().status).toBe('running');
  });

  it('页面被关闭时立即取消等待中的提交确认', async () => {
    let settle: (decision: AiConfirmationDecision) => void = () => undefined;
    const confirm = Object.assign(
      vi.fn(
        () =>
          new Promise<AiConfirmationDecision>((resolve) => {
            settle = resolve;
          })
      ),
      {
        cancel: vi.fn((reason?: 'cancel' | 'page_closed') => {
          settle(reason === 'page_closed' ? 'page_closed' : 'cancel');
        })
      }
    );
    const { controller, driver } = createController({
      elements: [{ role: 'button', name: '提交申请', tag: 'button' }],
      confirm
    });

    const pending = controller.execute({ action: 'click', target: '提交申请' });
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));

    await controller.handleTabClosed({ id: 1, url: PAGE_URL, active: true });
    const result = await pending;

    expect(confirm.cancel).toHaveBeenCalledWith('page_closed');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('page_error');
    expect(result.message).toContain('页面被关闭');
    expect(driver.clickAt).not.toHaveBeenCalled();
    expect(controller.getState().status).toBe('running');
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

  it('用户停止时取消等待中的提交确认', async () => {
    let settle: (decision: AiConfirmationDecision) => void = () => undefined;
    const confirm = Object.assign(
      vi.fn(
        () =>
          new Promise<AiConfirmationDecision>((resolve) => {
            settle = resolve;
          })
      ),
      { cancel: vi.fn(() => settle('cancel')) }
    );
    const { controller, driver } = createController({
      elements: [{ role: 'button', name: '提交申请', tag: 'button' }],
      confirm
    });

    const pending = controller.execute({ action: 'click', target: '提交申请' });
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    controller.stop();
    const result = await pending;

    expect(confirm.cancel).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('confirmation_declined');
    expect(driver.clickAt).not.toHaveBeenCalled();
  });

  it('表单动作只处理本机文件，不打开办事浏览器', async () => {
    const form: ParsedForm = {
      format: 'docx',
      name: '申请表.docx',
      fields: [
        {
          id: 'f1',
          label: '申请人姓名',
          kind: 'text',
          locator: { type: 'docx-paragraph', paragraph: 1, labelEnd: 6 }
        }
      ],
      path: 'C:\\表单\\申请表.docx'
    };
    const { browser, controller } = createController({ openForm: async () => form });
    browser.state.panelOpen = false;
    browser.state.tabs = [];
    browser.state.activeTabId = null;

    const result = await controller.execute({ action: 'open_form' });

    expect(result.ok).toBe(true);
    expect(browser.openPanel).not.toHaveBeenCalled();
  });

  it('用户停止时取消等待中的表单填写确认', async () => {
    const form: ParsedForm = {
      format: 'docx',
      name: '申请表.docx',
      fields: [
        {
          id: 'f1',
          label: '申请人姓名',
          kind: 'text',
          locator: { type: 'docx-paragraph', paragraph: 1, labelEnd: 6 }
        }
      ],
      path: 'C:\\表单\\申请表.docx'
    };
    let settle: (decision: 'allow' | 'cancel') => void = () => undefined;
    const confirmForm = Object.assign(
      vi.fn(
        () =>
          new Promise<'allow' | 'cancel'>((resolve) => {
            settle = resolve;
          })
      ),
      { cancel: vi.fn(() => settle('cancel')) }
    );
    const fillForm = vi.fn(async () => ({
      name: '申请表-已填写.docx',
      format: 'docx' as const,
      folder: '鲁港通生成文件',
      path: 'C:\\下载\\鲁港通生成文件\\申请表-已填写.docx',
      filled: 1,
      skipped: [],
      warnings: []
    }));
    const { controller } = createController({
      openForm: async () => form,
      fillForm,
      confirmForm
    });

    const opened = await controller.execute({ action: 'open_form' });
    const pending = controller.execute({
      action: 'fill_form',
      token: opened.formToken as string,
      fields: [{ field: 'f1', value: '张三' }]
    });
    await vi.waitFor(() => expect(confirmForm).toHaveBeenCalledTimes(1));
    controller.stop();
    const result = await pending;

    expect(confirmForm.cancel).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('confirmation_declined');
    expect(fillForm).not.toHaveBeenCalled();
  });
});

describe('AI 桌面控制器 · 卡死自愈与读取边界', () => {
  it('页面长时间无响应时按超时返回，不阻塞后续指令', async () => {
    const browser = createBrowser();
    const harness = createDriver(makeSnapshot([textField('申请人姓名')]));
    let hang = true;
    (harness.driver.snapshot as ReturnType<typeof vi.fn>).mockImplementation(() =>
      hang
        ? new Promise<AiPageSnapshot>(() => undefined)
        : Promise.resolve(makeSnapshot([textField('申请人姓名')]))
    );
    const controller = new AiController({
      browser,
      driver: harness.driver,
      actionTimeoutMs: 20,
      longActionTimeoutMs: 200
    });

    const first = await controller.execute({ action: 'read' });
    expect(first.ok).toBe(false);
    expect(first.code).toBe('timeout');
    expect(first.message).toContain('页面响应超时');

    hang = false;
    const second = await controller.execute({ action: 'read' });
    expect(second.ok).toBe(true);
  });

  it('右栏没有网页时读取直接失败，不新建空白标签', async () => {
    const browser = createBrowser();
    browser.state.tabs = [];
    browser.state.activeTabId = null;
    browser.state.panelOpen = false;
    const harness = createDriver(makeSnapshot());
    const controller = new AiController({ browser, driver: harness.driver });

    const result = await controller.execute({ action: 'read' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('page_error');
    expect(result.message).toContain('网页');
    expect(browser.openPanel).not.toHaveBeenCalled();
    expect(harness.snapshotCalls()).toBe(0);
  });

  it('右栏打开本机文件时读取提示先读取文件', async () => {
    const browser = createBrowser();
    browser.state.tabs = [];
    browser.state.activeTabId = null;
    browser.state.panelOpen = false;
    const harness = createDriver(makeSnapshot());
    const controller = new AiController({
      browser,
      driver: harness.driver,
      hasLocalDocuments: () => true
    });

    const result = await controller.execute({ action: 'read' });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('文件');
    expect(browser.openPanel).not.toHaveBeenCalled();
  });

  it('右栏打开文件时不打开面板，直接读取文件', async () => {
    const browser = createBrowser();
    browser.state.tabs = [];
    browser.state.activeTabId = null;
    browser.state.panelOpen = false;
    const harness = createDriver(makeSnapshot());
    const controller = new AiController({
      browser,
      driver: harness.driver,
      hasLocalDocuments: () => true,
      readActiveDocument: () => ({
        format: 'pdf',
        fileName: '申请须知.pdf',
        path: 'C:\\Users\\tester\\Desktop\\申请须知.pdf'
      })
    });

    const result = await controller.execute({ action: 'read' });

    expect(result.ok).toBe(true);
    expect(result.document).toMatchObject({ format: 'pdf', name: '申请须知.pdf' });
    expect(browser.openPanel).not.toHaveBeenCalled();
    expect(harness.snapshotCalls()).toBe(0);
  });

  it('右栏只有空白页且没有打开文件时直接给出可操作提示', async () => {
    const browser = createBrowser();
    browser.state.tabs = [{ id: 1, title: '', url: 'about:blank', current: true }];
    const harness = createDriver(makeSnapshot());
    const controller = new AiController({ browser, driver: harness.driver });

    const result = await controller.execute({ action: 'read' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('page_error');
    expect(result.message).toContain('网页');
    expect(browser.openPanel).not.toHaveBeenCalled();
    expect(harness.snapshotCalls()).toBe(0);
  });

  it('右栏有可读网页时仍按网页读取', async () => {
    const { controller, snapshotCalls } = createController();

    const result = await controller.execute({ action: 'read' });

    expect(result.ok).toBe(true);
    expect(result.snapshot?.url).toBe(PAGE_URL);
    expect(snapshotCalls()).toBe(1);
  });

  it('需要用户操作的动作按长等待上限计时', async () => {
    const browser = createBrowser();
    const harness = createDriver(
      makeSnapshot([{ role: 'button', name: '下一步', tag: 'button' }])
    );
    (harness.driver.settle as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(resolve, 40))
    );
    const controller = new AiController({
      browser,
      driver: harness.driver,
      actionTimeoutMs: 10,
      longActionTimeoutMs: 400
    });

    const result = await controller.execute({ action: 'click', target: '下一步' });

    expect(result.ok).toBe(true);
  });

  it('读取超时后审计记录为 failed/timeout', async () => {
    const records: AiAuditRecord[] = [];
    const browser = createBrowser();
    const harness = createDriver(makeSnapshot());
    (harness.driver.snapshot as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise<AiPageSnapshot>(() => undefined)
    );
    const controller = new AiController({
      browser,
      driver: harness.driver,
      actionTimeoutMs: 10,
      longActionTimeoutMs: 100,
      audit: (record) => {
        records.push(record);
      }
    });

    await controller.execute({ action: 'read' });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ action: 'read', outcome: 'failed', errorCode: 'timeout' });
  });
});

const lastStep = (controller: AiController) => {
  const steps = controller.getState().steps;
  return steps[steps.length - 1];
};

describe('AI 桌面控制器 · 标签锁定与一键接管', () => {
  it('AI 会话开始后锁定当前标签，停止后解锁', async () => {
    const { controller, browser } = createController({
      elements: [textField('申请人姓名')]
    });
    expect(controller.getState().lockedTabId).toBeNull();
    expect(browser.setAiLockedTab).not.toHaveBeenCalled();

    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });

    expect(controller.getState().lockedTabId).toBe(1);
    expect(browser.setAiLockedTab).toHaveBeenLastCalledWith(1);

    controller.stop();
    expect(controller.getState().lockedTabId).toBeNull();
    expect(browser.setAiLockedTab).toHaveBeenLastCalledWith(null);
  });

  it('用户切到其他标签后，下一条指令执行前自动切回锁定标签', async () => {
    const { controller, browser } = createController({
      elements: [textField('申请人姓名')]
    });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });

    browser.state.tabs.push({
      id: 2,
      title: '其他页面',
      url: 'https://www.gov.hk/other',
      current: false
    });
    browser.selectTab(2);
    expect(browser.state.activeTabId).toBe(2);

    await controller.execute({ action: 'read' });

    expect(browser.activateTab).toHaveBeenCalledWith(1);
    expect(browser.state.activeTabId).toBe(1);
    expect(controller.getState().lockedTabId).toBe(1);
  });

  it('接管后暂停会话、取消等待中的确认，在途指令回传 user_handover', async () => {
    let settle: (decision: AiConfirmationDecision) => void = () => undefined;
    const confirm = Object.assign(
      vi.fn(
        () =>
          new Promise<AiConfirmationDecision>((resolve) => {
            settle = resolve;
          })
      ),
      {
        cancel: vi.fn((reason?: 'cancel' | 'page_closed') =>
          settle(reason === 'page_closed' ? 'page_closed' : 'cancel')
        )
      }
    );
    const { controller } = createController({
      elements: [{ role: 'button', name: '提交申请', tag: 'button' }],
      confirm
    });

    const pending = controller.execute({ action: 'click', target: '提交申请' });
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));

    const state = controller.pause();
    expect(state.status).toBe('paused');
    expect(confirm.cancel).toHaveBeenCalledTimes(1);

    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.code).toBe('user_handover');
    expect(controller.getState().status).toBe('paused');
  });

  it('接管期间的后续指令一律拒绝且不消耗连续失败次数', async () => {
    const { controller, snapshotCalls } = createController({
      elements: [textField('申请人姓名')]
    });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });
    controller.pause();

    const calls = snapshotCalls();
    const rejected = await controller.execute({ action: 'click', target: '不存在的按钮' });
    expect(rejected.ok).toBe(false);
    expect(rejected.code).toBe('user_handover');
    expect(snapshotCalls()).toBe(calls);

    const again = await controller.execute({ action: 'click', target: '不存在的按钮' });
    expect(again.code).toBe('user_handover');
    expect(controller.getState().status).toBe('paused');

    // 继续后第一次失败只累计一次，不会直接触发「连续两次」停止
    controller.resume();
    const firstFailure = await controller.execute({ action: 'click', target: '不存在的按钮' });
    expect(firstFailure.stopped).toBeFalsy();
    expect(controller.getState().status).toBe('running');
  });

  it('让 AI 继续后恢复运行并重新锁定原标签', async () => {
    const { controller, browser } = createController({
      elements: [textField('申请人姓名')]
    });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });
    controller.pause();
    expect(controller.getState().lockedTabId).toBe(1);

    const resumed = controller.resume();
    expect(resumed.status).toBe('running');
    expect(resumed.lockedTabId).toBe(1);
    expect(browser.setAiLockedTab).toHaveBeenLastCalledWith(1);

    const result = await controller.execute({ action: 'read' });
    expect(result.ok).toBe(true);
  });

  it('用户选择自己提交后也可通过继续恢复', async () => {
    const { controller } = createController({
      elements: [{ role: 'button', name: '提交申请', tag: 'button' }],
      confirm: async () => 'handoff'
    });
    await controller.execute({ action: 'click', target: '提交申请' });
    expect(controller.getState().stopReason).toBe('handed_over');
    expect(controller.getState().lockedTabId).toBeNull();

    const resumed = controller.resume();
    expect(resumed.status).toBe('running');
    expect(controller.getState().stopReason).toBeUndefined();
    expect(controller.getState().lockedTabId).toBe(1);
  });

  it('闲置到期后自动解锁，标签恢复可关闭', async () => {
    const { controller } = createController({ elements: [textField('申请人姓名')], idleMs: 20 });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });
    expect(controller.getState().lockedTabId).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(controller.getState().status).toBe('idle');
    expect(controller.getState().lockedTabId).toBeNull();
  });

  it('接管后闲置到期同样解锁', async () => {
    const { controller } = createController({ elements: [textField('申请人姓名')], idleMs: 20 });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });
    controller.pause();
    expect(controller.getState().lockedTabId).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(controller.getState().status).toBe('idle');
    expect(controller.getState().lockedTabId).toBeNull();
  });
});

describe('AI 桌面控制器 · 本次操作时间线', () => {
  it('按执行顺序记录动作与目标，绝不记录输入内容', async () => {
    const { controller } = createController({ elements: [textField('申请人姓名')] });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三的私密内容' });
    await controller.execute({ action: 'read' });

    const state = controller.getState();
    expect(state.steps.map((step) => step.action)).toEqual(['type', 'read']);
    expect(state.steps[0]).toMatchObject({ target: '申请人姓名', status: 'ok' });
    expect(JSON.stringify(state.steps)).not.toContain('张三的私密内容');
  });

  it('打开网页只记录域名，长目标截断到 40 字', async () => {
    const longTarget = '申'.repeat(60);
    const { controller } = createController({
      elements: [{ role: 'textbox', name: longTarget, tag: 'input', type: 'text' }]
    });
    await controller.execute({
      action: 'navigate',
      url: 'https://www.immd.gov.hk/path?token=abc'
    });
    await controller.execute({ action: 'type', target: longTarget, text: 'x' });

    const state = controller.getState();
    expect(state.steps[0].target).toBe('www.immd.gov.hk');
    const truncated = state.steps[1].target ?? '';
    expect(truncated.endsWith('…')).toBe(true);
    expect(truncated.length).toBe(41);
  });

  it('等待用户确认时当前步骤标为等待确认，结束后归档为失败', async () => {
    let settle: (decision: AiConfirmationDecision) => void = () => undefined;
    const confirm = Object.assign(
      vi.fn(
        () =>
          new Promise<AiConfirmationDecision>((resolve) => {
            settle = resolve;
          })
      ),
      { cancel: vi.fn(() => settle('cancel')) }
    );
    const { controller } = createController({
      elements: [{ role: 'button', name: '提交申请', tag: 'button' }],
      confirm
    });

    const pending = controller.execute({ action: 'click', target: '提交申请' });
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(lastStep(controller)?.status).toBe('confirming');

    settle('cancel');
    await pending;
    expect(lastStep(controller)?.status).toBe('failed');
  });

  it('内存保留最近 50 条，面板只取最近 30 条', async () => {
    const { controller } = createController({ elements: [textField('申请人姓名')] });
    for (let index = 0; index < 55; index += 1) {
      await controller.execute({ action: 'read' });
    }

    expect(controller.getState().steps).toHaveLength(30);
    expect((controller as unknown as { steps: unknown[] }).steps).toHaveLength(50);
  });

  it('停止与接管都会留下记录，新会话开始时清空', async () => {
    const { controller } = createController({ elements: [textField('申请人姓名')] });
    await controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });
    controller.pause();
    expect(controller.getState().steps.map((step) => step.action)).toEqual(['type', 'pause']);
    controller.resume();
    expect(controller.getState().steps.map((step) => step.action)).toEqual([
      'type',
      'pause',
      'resume'
    ]);
    controller.stop();
    expect(controller.getState().steps.map((step) => step.action)).toEqual([
      'type',
      'pause',
      'resume',
      'stop'
    ]);

    await controller.execute({ action: 'read' }, { resume: true });
    expect(controller.getState().steps.map((step) => step.action)).toEqual(['read']);
  });
});

const PAGE_ORIGIN = 'https://www.gov.hk';

describe('AI 桌面控制器 · 站点级 AI 权限', () => {
  it('仅读取站点拒绝点击，给出改回入口且不消耗失败次数', async () => {
    const { controller, driver, snapshotCalls } = createController({
      elements: [{ role: 'button', name: '下一步', tag: 'button' }],
      siteAiModes: { [PAGE_ORIGIN]: 'read_only' }
    });

    const rejected = await controller.execute({ action: 'click', target: '下一步' });

    expect(rejected.ok).toBe(false);
    expect(rejected.code).toBe('site_read_only');
    expect(rejected.message).toContain('仅读取');
    expect(rejected.message).toContain('允许操作');
    expect(rejected.stopped).toBeFalsy();
    expect(driver.clickAt).not.toHaveBeenCalled();
    expect(snapshotCalls()).toBe(0);

    const again = await controller.execute({ action: 'click', target: '下一步' });
    expect(again.code).toBe('site_read_only');

    // 连续两次被拒不累计；随后第一次真实失败仍只是第一次，不应直接停止
    const firstFailure = await controller.execute({ action: 'click', target: '不存在的按钮' });
    expect(firstFailure.ok).toBe(false);
    expect(firstFailure.stopped).toBeFalsy();
    expect(controller.getState().status).toBe('running');

    const state = controller.getState();
    expect(state.steps[0]).toMatchObject({
      action: 'click',
      status: 'failed',
      code: 'site_read_only'
    });
  });

  it('仅读取站点放行读取与滚动', async () => {
    const { controller } = createController({
      siteAiModes: { [PAGE_ORIGIN]: 'read_only' }
    });

    const read = await controller.execute({ action: 'read' });
    expect(read.ok).toBe(true);

    const scroll = await controller.execute({ action: 'scroll', direction: 'down' });
    expect(scroll.ok).toBe(true);
  });

  it('禁止 AI 站点拒绝读取与导航，改回允许后恢复', async () => {
    const siteAiModes: Record<string, DesktopSiteAiMode> = {
      'https://blocked.example': 'blocked'
    };
    const { controller, browser, driver } = createController({ siteAiModes });
    browser.state.tabs = [
      { id: 1, title: '受限站点', url: 'https://blocked.example/home', current: true }
    ];

    const read = await controller.execute({ action: 'read' });
    expect(read.ok).toBe(false);
    expect(read.code).toBe('site_blocked');
    expect(read.message).toContain('禁止 AI');
    expect(read.message).toContain('允许操作');

    const blockedNav = await controller.execute({
      action: 'navigate',
      url: 'https://blocked.example/next'
    });
    expect(blockedNav.code).toBe('site_blocked');
    expect(browser.navigate).not.toHaveBeenCalled();
    expect(driver.navigate).not.toHaveBeenCalled();

    // 离开受限站点不受限制：navigate 按目标站点判定
    const escape = await controller.execute({ action: 'navigate', url: PAGE_URL });
    expect(escape.ok).toBe(true);
    expect(driver.navigate).toHaveBeenCalledWith(PAGE_URL);

    siteAiModes['https://blocked.example'] = 'allow';
    const restored = await controller.execute({ action: 'navigate', url: 'https://blocked.example/' });
    expect(restored.ok).toBe(true);
  });

  it('禁止 AI 站点仍允许停止会话', async () => {
    const { controller } = createController({
      siteAiModes: { [PAGE_ORIGIN]: 'blocked' }
    });

    const result = await controller.execute({ action: 'stop' });

    expect(result.ok).toBe(true);
    expect(result.stopped).toBe(true);
  });

  it('站点被禁时本机文件类动作不受影响', async () => {
    const generateFile = vi.fn(async () => ({
      name: '说明.docx',
      format: 'docx' as const,
      folder: '鲁港通生成文件',
      path: 'C:\\下载\\鲁港通生成文件\\说明.docx'
    }));
    const { controller } = createController({
      siteAiModes: { [PAGE_ORIGIN]: 'blocked' },
      generateFile
    });

    const result = await controller.execute({
      action: 'generate_file',
      format: 'docx',
      fileName: '说明',
      content: '正文'
    });

    expect(result.ok).toBe(true);
    expect(generateFile).toHaveBeenCalledTimes(1);
  });

  it('站点拒绝写入审计但不进入聊天错误计数', async () => {
    const records: AiAuditRecord[] = [];
    const { controller } = createController({
      elements: [{ role: 'button', name: '下一步', tag: 'button' }],
      siteAiModes: { [PAGE_ORIGIN]: 'read_only' },
      audit: (record) => {
        records.push(record);
      }
    });

    await controller.execute({ action: 'click', target: '下一步' }, { commandId: 'cmd-site' });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      commandId: 'cmd-site',
      action: 'click',
      outcome: 'failed',
      errorCode: 'site_read_only'
    });
  });
});

describe('AI 桌面控制器 · 失败可视化', () => {
  it('定位失败时画页面说明条，返回给上行的结果不含本机标注', async () => {
    const { controller, browser } = createController();

    const result = await controller.execute({ action: 'click', target: '不存在的按钮' });

    expect(result.ok).toBe(false);
    expect(result.highlight).toBeUndefined();
    expect(browser.showFailureHighlight).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ kind: 'page', message: expect.stringContaining('重新读取') })
    );
  });

  it('目标被遮挡时上报目标与遮挡层坐标', async () => {
    const { controller, browser } = createController({
      elements: [{ role: 'button', name: '注册', tag: 'button' }],
      coveredBy: {
        role: 'dialog',
        name: '隐私提示',
        rect: { x: 0, y: 0, width: 1280, height: 720 }
      }
    });

    const result = await controller.execute({ action: 'click', target: '注册' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('element_covered');
    expect(result.highlight).toBeUndefined();
    expect(browser.showFailureHighlight).toHaveBeenCalledWith(1, {
      kind: 'covered',
      target: { x: 10, y: 10, width: 100, height: 24 },
      cover: { x: 0, y: 0, width: 1280, height: 720 },
      coverName: '隐私提示',
      message: expect.stringContaining('遮挡')
    });
  });

  it('下一次操作前撤掉上一轮标注', async () => {
    const { controller, browser } = createController({
      elements: [textField('申请人姓名')]
    });

    await controller.execute({ action: 'click', target: '不存在的按钮' });
    expect(browser.showFailureHighlight).toHaveBeenCalledTimes(1);

    await controller.execute({ action: 'read' });
    expect(browser.clearFailureHighlight).toHaveBeenCalledTimes(1);
  });

  it('停止与接管都会立即撤掉标注', async () => {
    const stopHarness = createController();
    await stopHarness.controller.execute({ action: 'click', target: '不存在的按钮' });
    stopHarness.controller.stop();
    expect(stopHarness.browser.clearFailureHighlight).toHaveBeenCalled();

    const pauseHarness = createController({
      elements: [textField('申请人姓名')]
    });
    await pauseHarness.controller.execute({ action: 'type', target: '申请人姓名', text: '张三' });
    await pauseHarness.controller.execute({ action: 'click', target: '不存在的按钮' });
    pauseHarness.controller.pause();
    expect(pauseHarness.browser.clearFailureHighlight).toHaveBeenCalled();
  });

  it('页面超时也给出说明条', async () => {
    const browser = createBrowser();
    const harness = createDriver(makeSnapshot());
    (harness.driver.snapshot as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise<AiPageSnapshot>(() => undefined)
    );
    const controller = new AiController({
      browser,
      driver: harness.driver,
      actionTimeoutMs: 10,
      longActionTimeoutMs: 200
    });

    const result = await controller.execute({ action: 'read' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('timeout');
    expect(result.highlight).toBeUndefined();
    expect(browser.showFailureHighlight).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ kind: 'page' })
    );
  });
});
