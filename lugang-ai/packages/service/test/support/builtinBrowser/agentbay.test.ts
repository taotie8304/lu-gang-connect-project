import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const session = {
    sessionId: 'cloud-s-1',
    resourceUrl: 'https://viewer.example/1',
    browser: { initializeAsync: vi.fn() },
    callMcpTool: vi.fn(),
    command: { executeCommand: vi.fn() },
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
  closeCloudBrowserTab,
  createCloudBrowserSession,
  listCloudBrowserTabs,
  navigateCloudBrowserSession,
  newCloudBrowserTab,
  parseCloudBrowserTabs,
  resizeCloudBrowserSession,
  selectCloudBrowserTab
} from '@fastgpt/service/support/builtinBrowser/agentbay';

process.env.AGENTBAY_API_KEY = 'test-key';

const TABS_TEXT = [
  '### Open tabs',
  '- 0: [新标签页] (about:blank)',
  '- 1: (current) [主页 | 入境事务处] (https://www.immd.gov.hk/hks/index.html)',
  ''
].join('\n');

let pageSize = { width: 0, height: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  pageSize = { width: 0, height: 0 };
  mocks.session.browser.initializeAsync.mockResolvedValue(true);
  mocks.session.command.executeCommand.mockResolvedValue({ success: true, stdout: '' });
  mocks.client.create.mockResolvedValue({ success: true, session: mocks.session });
  mocks.client.get.mockResolvedValue({ success: true, session: mocks.session });
  mocks.session.callMcpTool.mockImplementation((name: string, args?: any) => {
    if (name === 'browser_resize') {
      pageSize = { width: args?.width, height: args?.height };
      return Promise.resolve({ success: true });
    }
    if (name === 'browser_evaluate') {
      return Promise.resolve({ success: true, data: `### Result\n${JSON.stringify(pageSize)}\n` });
    }
    if (name === 'browser_tabs') {
      return Promise.resolve({ success: true, data: TABS_TEXT });
    }
    return Promise.resolve({ success: true });
  });
});

const execCommands = () =>
  mocks.session.command.executeCommand.mock.calls.map((call) => String(call[0]));

describe('createCloudBrowserSession', () => {
  it('开台：初始化后建立占位标签与空白用户标签，不再导航起始页', async () => {
    await expect(createCloudBrowserSession({ width: 479, height: 557 })).resolves.toEqual({
      cloudSessionId: 'cloud-s-1',
      resourceUrl: 'https://viewer.example/1'
    });

    expect(mocks.session.callMcpTool.mock.calls.filter(([name]) => name === 'browser_navigate'))
      .toHaveLength(0);
    const newTabCalls = mocks.session.callMcpTool.mock.calls.filter(
      ([name, args]) => name === 'browser_tabs' && args?.action === 'new'
    );
    expect(newTabCalls).toHaveLength(2);
    expect(mocks.session.callMcpTool.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.session.browser.initializeAsync.mock.invocationCallOrder[0]
    );
  });

  it('开台按面板视口适配，并同步云窗口外框（视口 + 10×100）', async () => {
    await createCloudBrowserSession({ width: 479, height: 557 });

    expect(mocks.session.callMcpTool).toHaveBeenCalledWith('browser_resize', {
      width: 479,
      height: 561
    });
    expect(
      execCommands().some(
        (cmd) => cmd.includes('lugang-wd-geom') && cmd.includes('489 661')
      )
    ).toBe(true);
    expect(
      execCommands().some((cmd) => cmd.includes('wmctrl -i -r "$ID"') && cmd.includes('489,661'))
    ).toBe(true);
  });

  it('未传面板尺寸：按默认视口与窗口外框适配', async () => {
    await createCloudBrowserSession();

    expect(mocks.session.callMcpTool).toHaveBeenCalledWith('browser_resize', {
      width: 480,
      height: 804
    });
    expect(
      execCommands().some(
        (cmd) => cmd.includes('lugang-wd-geom') && cmd.includes('490 904')
      )
    ).toBe(true);
  });

  it('面板尺寸为小数：按整数取整后适配', async () => {
    await createCloudBrowserSession({ width: 478.6, height: 556.6 });

    expect(mocks.session.callMcpTool).toHaveBeenCalledWith('browser_resize', {
      width: 479,
      height: 561
    });
  });

  it('面板尺寸超出下限：夹取到合理范围', async () => {
    await createCloudBrowserSession({ width: 200, height: 100 });

    expect(mocks.session.callMcpTool).toHaveBeenCalledWith('browser_resize', {
      width: 320,
      height: 240
    });
  });

  it('面板尺寸超出上限：夹取到合理范围', async () => {
    await createCloudBrowserSession({ width: 5000, height: 5000 });

    expect(mocks.session.callMcpTool).toHaveBeenCalledWith('browser_resize', {
      width: 1600,
      height: 1400
    });
  });

  it('标签初始化失败不阻断开台', async () => {
    mocks.session.callMcpTool.mockImplementation((name: string) =>
      name === 'browser_tabs'
        ? Promise.reject(new Error('tabs failed'))
        : Promise.resolve({ success: true })
    );

    await expect(createCloudBrowserSession({ width: 479, height: 557 })).resolves.toEqual({
      cloudSessionId: 'cloud-s-1',
      resourceUrl: 'https://viewer.example/1'
    });
  });

  it('尺寸适配失败不阻断开台（尽力而为）', async () => {
    mocks.session.callMcpTool.mockImplementation((name: string) =>
      name === 'browser_resize'
        ? Promise.reject(new Error('resize failed'))
        : Promise.resolve({ success: true })
    );

    await expect(createCloudBrowserSession({ width: 479, height: 557 })).resolves.toEqual({
      cloudSessionId: 'cloud-s-1',
      resourceUrl: 'https://viewer.example/1'
    });
  });

  it('工具层返回 success=false 也不阻断开台', async () => {
    mocks.session.callMcpTool.mockResolvedValue({
      success: false,
      errorMessage: 'No open pages available'
    });

    await expect(createCloudBrowserSession({ width: 479, height: 557 })).resolves.toEqual({
      cloudSessionId: 'cloud-s-1',
      resourceUrl: 'https://viewer.example/1'
    });
  });
});

describe('resizeCloudBrowserSession', () => {
  it('会话存在：按面板尺寸调整窗口并返回 true', async () => {
    await expect(resizeCloudBrowserSession('cloud-s-1', { width: 479, height: 557 })).resolves.toBe(
      true
    );

    expect(mocks.session.callMcpTool).toHaveBeenCalledWith('browser_resize', {
      width: 479,
      height: 561
    });
    expect(
      execCommands().some((cmd) => cmd.includes('wmctrl -i -r "$ID"') && cmd.includes('489,661'))
    ).toBe(true);
  });

  it('resize 一次失败后重试成功：返回 true 且调用两次', async () => {
    mocks.session.callMcpTool.mockImplementation((name: string, args?: any) => {
      if (name === 'browser_resize') {
        const callCount = mocks.session.callMcpTool.mock.calls.filter(
          ([tool]) => tool === 'browser_resize'
        ).length;
        pageSize = { width: args?.width, height: args?.height };
        return Promise.resolve({ success: callCount > 1 });
      }
      if (name === 'browser_evaluate') {
        return Promise.resolve({ success: true, data: `### Result\n${JSON.stringify(pageSize)}\n` });
      }
      return Promise.resolve({ success: true });
    });

    await expect(resizeCloudBrowserSession('cloud-s-1', { width: 479, height: 557 })).resolves.toBe(
      true
    );
    expect(
      mocks.session.callMcpTool.mock.calls.filter(([name]) => name === 'browser_resize')
    ).toHaveLength(2);
  });

  it('页面视口校验不一致：再补一次 resize', async () => {
    let evaluateCount = 0;
    mocks.session.callMcpTool.mockImplementation((name: string, args?: any) => {
      if (name === 'browser_resize') {
        pageSize = { width: args?.width, height: args?.height };
        return Promise.resolve({ success: true });
      }
      if (name === 'browser_evaluate') {
        evaluateCount += 1;
        const size =
          evaluateCount === 1 ? { width: 320, height: 240 } : pageSize;
        return Promise.resolve({ success: true, data: `### Result\n${JSON.stringify(size)}\n` });
      }
      return Promise.resolve({ success: true });
    });

    await expect(resizeCloudBrowserSession('cloud-s-1', { width: 479, height: 557 })).resolves.toBe(
      true
    );
    expect(
      mocks.session.callMcpTool.mock.calls.filter(([name]) => name === 'browser_resize')
    ).toHaveLength(2);
  });

  it('校验工具不可用：以 resize 结果为准', async () => {
    mocks.session.callMcpTool.mockImplementation((name: string, args?: any) => {
      if (name === 'browser_resize') {
        pageSize = { width: args?.width, height: args?.height };
        return Promise.resolve({ success: true });
      }
      if (name === 'browser_evaluate') {
        return Promise.resolve({ success: false });
      }
      return Promise.resolve({ success: true });
    });

    await expect(resizeCloudBrowserSession('cloud-s-1', { width: 479, height: 557 })).resolves.toBe(
      true
    );
  });

  it('窗口外框同步失败不影响 resize 结果', async () => {
    mocks.session.command.executeCommand.mockRejectedValue(new Error('cmd failed'));

    await expect(resizeCloudBrowserSession('cloud-s-1', { width: 479, height: 557 })).resolves.toBe(
      true
    );
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

    await expect(resizeCloudBrowserSession('cloud-s-1', { width: 479, height: 557 })).resolves.toBe(
      false
    );
  });

  it('工具层持续返回 success=false：返回 false', async () => {
    mocks.session.callMcpTool.mockResolvedValue({ success: false });

    await expect(resizeCloudBrowserSession('cloud-s-1', { width: 479, height: 557 })).resolves.toBe(
      false
    );
  });
});

describe('navigateCloudBrowserSession', () => {
  it('会话存在：调用浏览器导航工具并返回 true', async () => {
    await expect(
      navigateCloudBrowserSession('cloud-s-1', 'https://www.immd.gov.hk/')
    ).resolves.toBe(true);

    expect(mocks.session.callMcpTool).toHaveBeenCalledWith('browser_navigate', {
      url: 'https://www.immd.gov.hk/'
    });
  });

  it('云端会话不存在：返回 false，不调用工具', async () => {
    mocks.client.get.mockResolvedValue({ success: false, session: undefined });

    await expect(
      navigateCloudBrowserSession('cloud-gone', 'https://www.immd.gov.hk/')
    ).resolves.toBe(false);
    expect(mocks.session.callMcpTool).not.toHaveBeenCalled();
  });

  it('工具调用异常：返回 false，不上抛', async () => {
    mocks.session.callMcpTool.mockRejectedValue(new Error('boom'));

    await expect(
      navigateCloudBrowserSession('cloud-s-1', 'https://www.immd.gov.hk/')
    ).resolves.toBe(false);
  });

  it('工具层返回 success=false：返回 false', async () => {
    mocks.session.callMcpTool.mockResolvedValue({ success: false });

    await expect(
      navigateCloudBrowserSession('cloud-s-1', 'https://www.immd.gov.hk/')
    ).resolves.toBe(false);
  });
});

describe('云端看门狗部署（钉窗 v3：位置 + 尺寸）', () => {
  it('开台成功后部署：停旧 → 落盘脚本 → 后台启动', async () => {
    await createCloudBrowserSession({ width: 479, height: 557 });

    const commands = execCommands();
    expect(commands.filter((cmd) => cmd.includes('[l]ugang-wd'))).toHaveLength(1);
    expect(commands.filter((cmd) => cmd.includes('base64 -d'))).toHaveLength(1);
    expect(commands.filter((cmd) => cmd.includes('setsid nohup'))).toHaveLength(1);
  });

  it('看门狗脚本按存档几何钉住窗口位置与尺寸', async () => {
    await createCloudBrowserSession({ width: 479, height: 557 });

    const deployCommand = execCommands().find((cmd) => cmd.includes('base64 -d')) ?? '';
    const encoded = deployCommand.match(/echo '([^']+)' \| base64 -d/)?.[1] ?? '';
    const script = Buffer.from(encoded, 'base64').toString('utf8');

    expect(script).toContain('lugang-wd-geom');
    expect(script).toContain('wmctrl -i -r "$ID" -e 0,10,10,"$W","$H"');
  });

  it('看门狗部署失败不阻断开台', async () => {
    mocks.session.command.executeCommand.mockRejectedValue(new Error('cmd failed'));

    await expect(createCloudBrowserSession({ width: 479, height: 557 })).resolves.toEqual({
      cloudSessionId: 'cloud-s-1',
      resourceUrl: 'https://viewer.example/1'
    });
  });
});

describe('标签页解析与操作', () => {
  it('解析标签列表文本：标题 / 网址 / 当前标记', () => {
    expect(parseCloudBrowserTabs(TABS_TEXT)).toEqual([
      { index: 0, title: '新标签页', url: 'about:blank', current: false },
      {
        index: 1,
        title: '主页 | 入境事务处',
        url: 'https://www.immd.gov.hk/hks/index.html',
        current: true
      }
    ]);
  });

  it('无法解析或空列表：返回空数组', () => {
    expect(parseCloudBrowserTabs('No open tabs.')).toEqual([]);
    expect(parseCloudBrowserTabs('')).toEqual([]);
  });

  it('listCloudBrowserTabs：过滤隐藏占位标签，只返回用户标签', async () => {
    await expect(listCloudBrowserTabs('cloud-s-1')).resolves.toEqual([
      {
        index: 1,
        title: '主页 | 入境事务处',
        url: 'https://www.immd.gov.hk/hks/index.html',
        current: true
      }
    ]);
  });

  it('listCloudBrowserTabs 失败：返回 null', async () => {
    mocks.session.callMcpTool.mockRejectedValue(new Error('boom'));

    await expect(listCloudBrowserTabs('cloud-s-1')).resolves.toBeNull();
  });

  it('newCloudBrowserTab：创建后返回用户标签', async () => {
    mocks.session.callMcpTool.mockImplementation((name: string, args?: any) => {
      if (name === 'browser_tabs' && args?.action === 'new') {
        return Promise.resolve({
          success: true,
          data: [
            '### Open tabs',
            '- 0: [新标签页] (about:blank)',
            '- 1: [主页 | 入境事务处] (https://www.immd.gov.hk/hks/index.html)',
            '- 2: (current) [] (about:blank)',
            ''
          ].join('\n')
        });
      }
      return Promise.resolve({ success: true });
    });

    await expect(newCloudBrowserTab('cloud-s-1')).resolves.toEqual([
      {
        index: 1,
        title: '主页 | 入境事务处',
        url: 'https://www.immd.gov.hk/hks/index.html',
        current: false
      },
      { index: 2, title: '', url: 'about:blank', current: true }
    ]);
    expect(mocks.session.callMcpTool).toHaveBeenCalledWith('browser_tabs', { action: 'new' });
  });

  it('newCloudBrowserTab 失败：返回 null', async () => {
    mocks.session.callMcpTool.mockResolvedValue({ success: false });

    await expect(newCloudBrowserTab('cloud-s-1')).resolves.toBeNull();
  });

  it('selectCloudBrowserTab：只允许切换用户标签（index ≥ 1）', async () => {
    await expect(selectCloudBrowserTab('cloud-s-1', 1)).resolves.toBe(true);
    expect(mocks.session.callMcpTool).toHaveBeenCalledWith('browser_tabs', {
      action: 'select',
      index: 1
    });

    mocks.session.callMcpTool.mockClear();
    await expect(selectCloudBrowserTab('cloud-s-1', 0)).resolves.toBe(false);
    expect(mocks.session.callMcpTool).not.toHaveBeenCalled();
  });

  it('closeCloudBrowserTab：只允许关闭用户标签（index ≥ 1）', async () => {
    await expect(closeCloudBrowserTab('cloud-s-1', 2)).resolves.toBe(true);
    expect(mocks.session.callMcpTool).toHaveBeenCalledWith('browser_tabs', {
      action: 'close',
      index: 2
    });

    mocks.session.callMcpTool.mockClear();
    await expect(closeCloudBrowserTab('cloud-s-1', 0)).resolves.toBe(false);
    expect(mocks.session.callMcpTool).not.toHaveBeenCalled();
  });
});
