import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const session = {
    sessionId: 'cloud-s-1',
    resourceUrl: 'https://viewer.example/1',
    browser: { initializeAsync: vi.fn() },
    callMcpTool: vi.fn(),
    delete: vi.fn().mockResolvedValue({ success: true })
  };
  const client = {
    create: vi.fn(),
    get: vi.fn()
  };
  return { session, client };
});

vi.mock('wuying-agentbay-sdk', () => ({
  AgentBay: vi.fn(function () {
    return mocks.client;
  }),
  setLogLevel: vi.fn(),
  CreateSessionParamsClass: vi.fn(function (params: unknown) {
    return { params };
  })
}));

import {
  createCloudBrowserSession,
  resizeCloudBrowserSession
} from '@fastgpt/service/support/builtinBrowser/agentbay';

process.env.AGENTBAY_API_KEY = 'test-key';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.browser.initializeAsync.mockResolvedValue(true);
  mocks.session.callMcpTool.mockResolvedValue({ success: true });
  mocks.client.create.mockResolvedValue({ success: true, session: mocks.session });
  mocks.client.get.mockResolvedValue({ success: true, session: mocks.session });
});

describe('createCloudBrowserSession', () => {
  it('开台序列：初始化后先导航到起始页，再按面板尺寸调整窗口', async () => {
    await expect(
      createCloudBrowserSession({ width: 479, height: 557 })
    ).resolves.toEqual({
      cloudSessionId: 'cloud-s-1',
      resourceUrl: 'https://viewer.example/1'
    });

    expect(mocks.session.callMcpTool).toHaveBeenNthCalledWith(1, 'browser_navigate', {
      url: 'https://www.gov.hk/'
    });
    expect(mocks.session.callMcpTool).toHaveBeenNthCalledWith(2, 'browser_resize', {
      width: 479,
      height: 473
    });
    expect(mocks.session.callMcpTool.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.session.browser.initializeAsync.mock.invocationCallOrder[0]
    );
  });

  it('未传面板尺寸：按默认尺寸适配', async () => {
    await createCloudBrowserSession();

    expect(mocks.session.callMcpTool).toHaveBeenNthCalledWith(2, 'browser_resize', {
      width: 480,
      height: 716
    });
  });

  it('面板尺寸为小数：按整数取整后适配', async () => {
    await createCloudBrowserSession({ width: 478.6, height: 556.6 });

    expect(mocks.session.callMcpTool).toHaveBeenNthCalledWith(2, 'browser_resize', {
      width: 479,
      height: 473
    });
  });

  it('面板尺寸超出下限：夹取到合理范围', async () => {
    await createCloudBrowserSession({ width: 200, height: 100 });

    expect(mocks.session.callMcpTool).toHaveBeenNthCalledWith(2, 'browser_resize', {
      width: 320,
      height: 240
    });
  });

  it('面板尺寸超出上限：夹取到合理范围', async () => {
    await createCloudBrowserSession({ width: 5000, height: 5000 });

    expect(mocks.session.callMcpTool).toHaveBeenNthCalledWith(2, 'browser_resize', {
      width: 1600,
      height: 1400
    });
  });

  it('起始页导航失败不阻断开台（尺寸适配仍尝试）', async () => {
    mocks.session.callMcpTool.mockImplementation((name: string) =>
      name === 'browser_navigate'
        ? Promise.reject(new Error('nav failed'))
        : Promise.resolve({ success: true })
    );

    await expect(
      createCloudBrowserSession({ width: 479, height: 557 })
    ).resolves.toEqual({
      cloudSessionId: 'cloud-s-1',
      resourceUrl: 'https://viewer.example/1'
    });

    expect(mocks.session.callMcpTool).toHaveBeenNthCalledWith(2, 'browser_resize', {
      width: 479,
      height: 473
    });
  });

  it('尺寸适配失败不阻断开台（尽力而为）', async () => {
    mocks.session.callMcpTool.mockImplementation((name: string) =>
      name === 'browser_resize'
        ? Promise.reject(new Error('resize failed'))
        : Promise.resolve({ success: true })
    );

    await expect(
      createCloudBrowserSession({ width: 479, height: 557 })
    ).resolves.toEqual({
      cloudSessionId: 'cloud-s-1',
      resourceUrl: 'https://viewer.example/1'
    });
  });

  it('工具层返回 success=false 也不阻断开台', async () => {
    mocks.session.callMcpTool.mockResolvedValue({
      success: false,
      errorMessage: 'No open pages available'
    });

    await expect(
      createCloudBrowserSession({ width: 479, height: 557 })
    ).resolves.toEqual({
      cloudSessionId: 'cloud-s-1',
      resourceUrl: 'https://viewer.example/1'
    });
  });
});

describe('resizeCloudBrowserSession', () => {
  it('会话存在：按面板尺寸调整窗口并返回 true', async () => {
    await expect(
      resizeCloudBrowserSession('cloud-s-1', { width: 479, height: 557 })
    ).resolves.toBe(true);

    expect(mocks.session.callMcpTool).toHaveBeenCalledWith('browser_resize', {
      width: 479,
      height: 473
    });
  });

  it('云端会话不存在：返回 false，不调用工具', async () => {
    mocks.client.get.mockResolvedValue({ success: false, session: undefined });

    await expect(
      resizeCloudBrowserSession('cloud-gone', { width: 479, height: 557 })
    ).resolves.toBe(false);
    expect(mocks.session.callMcpTool).not.toHaveBeenCalled();
  });

  it('工具调用异常：返回 false，不上抛', async () => {
    mocks.session.callMcpTool.mockRejectedValue(new Error('boom'));

    await expect(
      resizeCloudBrowserSession('cloud-s-1', { width: 479, height: 557 })
    ).resolves.toBe(false);
  });

  it('工具层返回 success=false：返回 false', async () => {
    mocks.session.callMcpTool.mockResolvedValue({ success: false });

    await expect(
      resizeCloudBrowserSession('cloud-s-1', { width: 479, height: 557 })
    ).resolves.toBe(false);
  });
});
