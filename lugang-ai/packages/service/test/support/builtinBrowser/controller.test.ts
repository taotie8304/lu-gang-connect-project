import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findOneMock,
  insertOneMock,
  updateOneMock,
  findMock,
  userFindByIdMock,
  createCloudSessionMock,
  refreshCloudSessionMock,
  closeCloudSessionMock,
  resizeCloudSessionMock,
  navigateCloudSessionMock,
  reloadCloudSessionMock,
  listTabsMock,
  newTabMock,
  selectTabMock,
  closeTabMock
} = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  insertOneMock: vi.fn(),
  updateOneMock: vi.fn(),
  findMock: vi.fn(),
  userFindByIdMock: vi.fn(),
  createCloudSessionMock: vi.fn(),
  refreshCloudSessionMock: vi.fn(),
  closeCloudSessionMock: vi.fn(),
  resizeCloudSessionMock: vi.fn(),
  navigateCloudSessionMock: vi.fn(),
  reloadCloudSessionMock: vi.fn(),
  listTabsMock: vi.fn(),
  newTabMock: vi.fn(),
  selectTabMock: vi.fn(),
  closeTabMock: vi.fn()
}));

vi.mock('@fastgpt/service/support/builtinBrowser/schema', () => ({
  MongoBuiltinBrowserSessions: {
    findOne: findOneMock,
    insertOne: insertOneMock,
    updateOne: updateOneMock,
    find: findMock
  }
}));

vi.mock('@fastgpt/service/support/builtinBrowser/agentbay', () => ({
  createCloudBrowserSession: createCloudSessionMock,
  refreshCloudBrowserSession: refreshCloudSessionMock,
  closeCloudBrowserSession: closeCloudSessionMock,
  resizeCloudBrowserSession: resizeCloudSessionMock,
  navigateCloudBrowserSession: navigateCloudSessionMock,
  reloadCloudBrowserSession: reloadCloudSessionMock,
  listCloudBrowserTabs: listTabsMock,
  newCloudBrowserTab: newTabMock,
  selectCloudBrowserTab: selectTabMock,
  closeCloudBrowserTab: closeTabMock,
  isBuiltinBrowserConfigured: vi.fn().mockReturnValue(true)
}));

vi.mock('@fastgpt/service/support/user/schema', () => ({
  MongoUser: { findById: userFindByIdMock }
}));

import {
  assertBuiltinBrowserUser,
  closeSession,
  closeTabSession,
  getSessionStatus,
  getTabsSession,
  navigateSession,
  newTabSession,
  openSession,
  reloadSession,
  resizeSession,
  selectTabSession,
  sweepOverdueSessions
} from '@fastgpt/service/support/builtinBrowser/controller';

const mockTeamId = '507f1f77bcf86cd799439011';
const mockTmbId = '507f1f77bcf86cd799439022';

const MINUTE_MS = 60 * 1000;
const MAX_MS = 30 * MINUTE_MS;

const now = new Date('2026-10-15T02:00:00.000Z');

const visibleTabs = [
  {
    index: 1,
    title: '主页 | 入境事务处',
    url: 'https://www.immd.gov.hk/hks/index.html',
    current: true
  },
  { index: 2, title: '', url: 'about:blank', current: false }
];

/** 构造 findOne({...}).lean() 链式 mock */
const leanChain = (doc: unknown) => ({
  lean: vi.fn().mockResolvedValue(doc)
});

const activeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: 'doc-1',
  teamId: mockTeamId,
  tmbId: mockTmbId,
  cloudSessionId: 'cloud-1',
  resourceUrl: 'https://viewer.example/old',
  status: 'active',
  openTime: new Date(now.getTime() - 10 * MINUTE_MS),
  expiresAt: new Date(now.getTime() + 10 * MINUTE_MS),
  ...overrides
});

beforeEach(() => {
  vi.clearAllMocks();
  insertOneMock.mockResolvedValue({});
  updateOneMock.mockResolvedValue({});
  closeCloudSessionMock.mockResolvedValue(undefined);
  resizeCloudSessionMock.mockResolvedValue(true);
  navigateCloudSessionMock.mockResolvedValue(true);
  reloadCloudSessionMock.mockResolvedValue(true);
  listTabsMock.mockResolvedValue(visibleTabs);
  newTabMock.mockResolvedValue(visibleTabs);
  selectTabMock.mockResolvedValue(true);
  closeTabMock.mockResolvedValue(true);
});

describe('openSession', () => {
  it('无进行中会话：新建云端会话并落库，剩余 30 分钟', async () => {
    findOneMock.mockReturnValue(leanChain(null));
    createCloudSessionMock.mockResolvedValue({
      cloudSessionId: 'cloud-1',
      resourceUrl: 'https://viewer.example/1'
    });

    await expect(openSession({ teamId: mockTeamId, tmbId: mockTmbId, now })).resolves.toEqual({
      resourceUrl: 'https://viewer.example/1',
      remainingMinutes: 30,
      expiresAt: new Date(now.getTime() + MAX_MS).toISOString(),
      reused: false
    });

    expect(insertOneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: mockTeamId,
        tmbId: mockTmbId,
        cloudSessionId: 'cloud-1',
        resourceUrl: 'https://viewer.example/1',
        status: 'active',
        openTime: now,
        expiresAt: new Date(now.getTime() + MAX_MS)
      })
    );
  });

  it('新建开台时透传面板视口：云端按面板尺寸开窗', async () => {
    findOneMock.mockReturnValue(leanChain(null));
    createCloudSessionMock.mockResolvedValue({
      cloudSessionId: 'cloud-1',
      resourceUrl: 'https://viewer.example/1'
    });

    await openSession({
      teamId: mockTeamId,
      tmbId: mockTmbId,
      viewport: { width: 479, height: 557 },
      now
    });

    expect(createCloudSessionMock).toHaveBeenCalledWith({ width: 479, height: 557 });
  });

  it('已有未过期会话：刷新画面地址后复用，不重复建台', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));
    refreshCloudSessionMock.mockResolvedValue({ resourceUrl: 'https://viewer.example/fresh' });

    await expect(openSession({ teamId: mockTeamId, tmbId: mockTmbId, now })).resolves.toEqual({
      resourceUrl: 'https://viewer.example/fresh',
      remainingMinutes: 10,
      expiresAt: new Date(now.getTime() + 10 * MINUTE_MS).toISOString(),
      reused: true
    });

    expect(createCloudSessionMock).not.toHaveBeenCalled();
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: 'doc-1' },
      { $set: { resourceUrl: 'https://viewer.example/fresh' } }
    );
  });

  it('复用已有会话时带视口：按当前面板尺寸重新贴合云端画面', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));
    refreshCloudSessionMock.mockResolvedValue({ resourceUrl: 'https://viewer.example/old' });
    resizeCloudSessionMock.mockResolvedValue(true);

    await openSession({
      teamId: mockTeamId,
      tmbId: mockTmbId,
      viewport: { width: 500, height: 600 },
      now
    });

    expect(resizeCloudSessionMock).toHaveBeenCalledWith('cloud-1', { width: 500, height: 600 });
  });

  it('复用刷新遇临时网络异常：沿用已记录地址，不动会话', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));
    refreshCloudSessionMock.mockRejectedValue(new Error('network'));

    await expect(openSession({ teamId: mockTeamId, tmbId: mockTmbId, now })).resolves.toEqual({
      resourceUrl: 'https://viewer.example/old',
      remainingMinutes: 10,
      expiresAt: new Date(now.getTime() + 10 * MINUTE_MS).toISOString(),
      reused: true
    });

    expect(createCloudSessionMock).not.toHaveBeenCalled();
  });

  it('已有已过期会话：关旧开新，旧单标记到期', async () => {
    findOneMock.mockReturnValue(
      leanChain(
        activeDoc({
          cloudSessionId: 'cloud-old',
          openTime: new Date(now.getTime() - 31 * MINUTE_MS),
          expiresAt: new Date(now.getTime() - 1 * MINUTE_MS)
        })
      )
    );
    createCloudSessionMock.mockResolvedValue({
      cloudSessionId: 'cloud-2',
      resourceUrl: 'https://viewer.example/2'
    });

    await expect(openSession({ teamId: mockTeamId, tmbId: mockTmbId, now })).resolves.toEqual({
      resourceUrl: 'https://viewer.example/2',
      remainingMinutes: 30,
      expiresAt: new Date(now.getTime() + MAX_MS).toISOString(),
      reused: false
    });

    expect(closeCloudSessionMock).toHaveBeenCalledWith('cloud-old');
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: 'doc-1' },
      {
        $set: expect.objectContaining({
          status: 'expired',
          closeReason: 'timeout',
          closeTime: now,
          durationMs: 31 * MINUTE_MS
        })
      }
    );
  });

  it('云端会话已被回收（刷新返回空）：旧单标记异常并新建', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));
    refreshCloudSessionMock.mockResolvedValue(null);
    createCloudSessionMock.mockResolvedValue({
      cloudSessionId: 'cloud-2',
      resourceUrl: 'https://viewer.example/2'
    });

    await expect(openSession({ teamId: mockTeamId, tmbId: mockTmbId, now })).resolves.toEqual({
      resourceUrl: 'https://viewer.example/2',
      remainingMinutes: 30,
      expiresAt: new Date(now.getTime() + MAX_MS).toISOString(),
      reused: false
    });

    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: 'doc-1' },
      { $set: expect.objectContaining({ status: 'error', closeReason: 'error' }) }
    );
  });

  it('并发双击撞唯一索引：关闭新建的云端会话并复用胜者', async () => {
    findOneMock.mockReturnValueOnce(leanChain(null)).mockReturnValueOnce(
      leanChain(
        activeDoc({
          cloudSessionId: 'cloud-winner',
          resourceUrl: 'https://viewer.example/w',
          expiresAt: new Date(now.getTime() + 29 * MINUTE_MS)
        })
      )
    );
    createCloudSessionMock.mockResolvedValue({
      cloudSessionId: 'cloud-new',
      resourceUrl: 'https://viewer.example/n'
    });
    insertOneMock.mockRejectedValue(
      Object.assign(new Error('E11000 duplicate key error'), { code: 11000 })
    );
    refreshCloudSessionMock.mockResolvedValue({ resourceUrl: 'https://viewer.example/w' });

    await expect(openSession({ teamId: mockTeamId, tmbId: mockTmbId, now })).resolves.toEqual({
      resourceUrl: 'https://viewer.example/w',
      remainingMinutes: 29,
      expiresAt: new Date(now.getTime() + 29 * MINUTE_MS).toISOString(),
      reused: true
    });

    expect(closeCloudSessionMock).toHaveBeenCalledWith('cloud-new');
  });
});

describe('getSessionStatus', () => {
  it('无进行中会话：active=false', async () => {
    findOneMock.mockReturnValue(leanChain(null));

    await expect(getSessionStatus({ tmbId: mockTmbId, now })).resolves.toEqual({ active: false });
  });

  it('进行中剩 11 分 30 秒：剩余取整为 12，返回画面地址与到期时间', async () => {
    const expiresAt = new Date(now.getTime() + 11.5 * MINUTE_MS);
    findOneMock.mockReturnValue(leanChain(activeDoc({ expiresAt })));

    await expect(getSessionStatus({ tmbId: mockTmbId, now })).resolves.toEqual({
      active: true,
      resourceUrl: 'https://viewer.example/old',
      remainingMinutes: 12,
      expiresAt: expiresAt.toISOString()
    });
  });

  it('已过期（请求时兜底校验）：关云端会话、标记到期、返回 active=false', async () => {
    findOneMock.mockReturnValue(
      leanChain(
        activeDoc({
          openTime: new Date(now.getTime() - 31 * MINUTE_MS),
          expiresAt: new Date(now.getTime() - 1 * MINUTE_MS)
        })
      )
    );

    await expect(getSessionStatus({ tmbId: mockTmbId, now })).resolves.toEqual({ active: false });

    expect(closeCloudSessionMock).toHaveBeenCalledWith('cloud-1');
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: 'doc-1' },
      { $set: expect.objectContaining({ status: 'expired', closeReason: 'timeout' }) }
    );
  });
});

describe('closeSession', () => {
  it('无进行中会话：幂等返回 closed=false，不触碰云端', async () => {
    findOneMock.mockReturnValue(leanChain(null));

    await expect(closeSession({ tmbId: mockTmbId, now })).resolves.toEqual({ closed: false });
    expect(closeCloudSessionMock).not.toHaveBeenCalled();
  });

  it('进行中用了 12 分 30 秒：关云端、标记用户关闭，时长取整 13 分钟', async () => {
    findOneMock.mockReturnValue(
      leanChain(activeDoc({ openTime: new Date(now.getTime() - 12.5 * MINUTE_MS) }))
    );

    await expect(closeSession({ tmbId: mockTmbId, now })).resolves.toEqual({
      closed: true,
      durationMinutes: 13
    });

    expect(closeCloudSessionMock).toHaveBeenCalledWith('cloud-1');
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: 'doc-1' },
      {
        $set: expect.objectContaining({
          status: 'closed',
          closeReason: 'user',
          closeTime: now,
          durationMs: 12.5 * MINUTE_MS
        })
      }
    );
  });
});

describe('sweepOverdueSessions', () => {
  it('扫描到期的进行中会话：逐一关台并标记到期', async () => {
    findMock.mockReturnValue(
      leanChain([
        activeDoc({
          _id: 'doc-1',
          cloudSessionId: 'cloud-1',
          expiresAt: new Date(now.getTime() - MINUTE_MS)
        }),
        activeDoc({
          _id: 'doc-2',
          cloudSessionId: 'cloud-2',
          expiresAt: new Date(now.getTime() - 5 * MINUTE_MS)
        })
      ])
    );

    await expect(sweepOverdueSessions({ now })).resolves.toBe(2);

    expect(closeCloudSessionMock).toHaveBeenCalledWith('cloud-1');
    expect(closeCloudSessionMock).toHaveBeenCalledWith('cloud-2');
    expect(updateOneMock).toHaveBeenCalledTimes(2);
  });

  it('无到期会话：不触碰云端，返回 0', async () => {
    findMock.mockReturnValue(leanChain([]));

    await expect(sweepOverdueSessions({ now })).resolves.toBe(0);
    expect(closeCloudSessionMock).not.toHaveBeenCalled();
  });
});

describe('resizeSession', () => {
  it('有进行中会话：按面板视口重新贴合，返回 resized=true', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));
    resizeCloudSessionMock.mockResolvedValue(true);

    await expect(
      resizeSession({ tmbId: mockTmbId, viewport: { width: 500, height: 600 }, now })
    ).resolves.toEqual({ resized: true });

    expect(resizeCloudSessionMock).toHaveBeenCalledWith('cloud-1', { width: 500, height: 600 });
  });

  it('无进行中会话：返回 resized=false，不触碰云端', async () => {
    findOneMock.mockReturnValue(leanChain(null));

    await expect(
      resizeSession({ tmbId: mockTmbId, viewport: { width: 500, height: 600 }, now })
    ).resolves.toEqual({ resized: false });
    expect(resizeCloudSessionMock).not.toHaveBeenCalled();
  });

  it('会话已过期：返回 resized=false，不触碰云端', async () => {
    findOneMock.mockReturnValue(
      leanChain(activeDoc({ expiresAt: new Date(now.getTime() - 1 * MINUTE_MS) }))
    );

    await expect(
      resizeSession({ tmbId: mockTmbId, viewport: { width: 500, height: 600 }, now })
    ).resolves.toEqual({ resized: false });
    expect(resizeCloudSessionMock).not.toHaveBeenCalled();
  });

  it('云端贴合失败：静默返回 resized=false，不影响用户', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));
    resizeCloudSessionMock.mockResolvedValue(false);

    await expect(
      resizeSession({ tmbId: mockTmbId, viewport: { width: 500, height: 600 }, now })
    ).resolves.toEqual({ resized: false });
  });
});

describe('navigateSession', () => {
  it('有进行中会话：归一化网址后请求云端跳转，navigated=true', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));
    navigateCloudSessionMock.mockResolvedValue(true);

    await expect(
      navigateSession({ tmbId: mockTmbId, url: 'www.immd.gov.hk', now })
    ).resolves.toEqual({ navigated: true });

    expect(navigateCloudSessionMock).toHaveBeenCalledWith('cloud-1', 'https://www.immd.gov.hk/');
  });

  it('网址非法：不触碰云端，直接 navigated=false', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));

    await expect(navigateSession({ tmbId: mockTmbId, url: 'hello', now })).resolves.toEqual({
      navigated: false
    });
    expect(navigateCloudSessionMock).not.toHaveBeenCalled();
    expect(findOneMock).not.toHaveBeenCalled();
  });

  it('无进行中会话：navigated=false，不触碰云端', async () => {
    findOneMock.mockReturnValue(leanChain(null));

    await expect(navigateSession({ tmbId: mockTmbId, url: 'www.gov.hk', now })).resolves.toEqual({
      navigated: false
    });
    expect(navigateCloudSessionMock).not.toHaveBeenCalled();
  });

  it('会话已过期：navigated=false，不触碰云端', async () => {
    findOneMock.mockReturnValue(
      leanChain(activeDoc({ expiresAt: new Date(now.getTime() - MINUTE_MS) }))
    );

    await expect(navigateSession({ tmbId: mockTmbId, url: 'www.gov.hk', now })).resolves.toEqual({
      navigated: false
    });
    expect(navigateCloudSessionMock).not.toHaveBeenCalled();
  });

  it('云端跳转失败：静默返回 navigated=false，不上抛', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));
    navigateCloudSessionMock.mockResolvedValue(false);

    await expect(navigateSession({ tmbId: mockTmbId, url: 'www.gov.hk', now })).resolves.toEqual({
      navigated: false
    });
  });
});

describe('reloadSession', () => {
  it('有进行中会话：请求云端原地刷新当前网页，reloaded=true', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));

    await expect(reloadSession({ tmbId: mockTmbId, now })).resolves.toEqual({ reloaded: true });
    expect(reloadCloudSessionMock).toHaveBeenCalledWith('cloud-1');
  });

  it('无进行中会话：reloaded=false，不触碰云端', async () => {
    findOneMock.mockReturnValue(leanChain(null));

    await expect(reloadSession({ tmbId: mockTmbId, now })).resolves.toEqual({ reloaded: false });
    expect(reloadCloudSessionMock).not.toHaveBeenCalled();
  });

  it('会话已过期：reloaded=false，不触碰云端', async () => {
    findOneMock.mockReturnValue(
      leanChain(activeDoc({ expiresAt: new Date(now.getTime() - MINUTE_MS) }))
    );

    await expect(reloadSession({ tmbId: mockTmbId, now })).resolves.toEqual({ reloaded: false });
    expect(reloadCloudSessionMock).not.toHaveBeenCalled();
  });
});

describe('标签页', () => {
  it('getTabsSession：无进行中会话返回空列表，不触碰云端', async () => {
    findOneMock.mockReturnValue(leanChain(null));

    await expect(getTabsSession({ tmbId: mockTmbId, now })).resolves.toEqual({ tabs: [] });
    expect(listTabsMock).not.toHaveBeenCalled();
  });

  it('getTabsSession：返回当前会话的用户标签', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));

    await expect(getTabsSession({ tmbId: mockTmbId, now })).resolves.toEqual({
      tabs: visibleTabs
    });
    expect(listTabsMock).toHaveBeenCalledWith('cloud-1');
  });

  it('getTabsSession：会话已过期返回空列表，不触碰云端', async () => {
    findOneMock.mockReturnValue(
      leanChain(activeDoc({ expiresAt: new Date(now.getTime() - MINUTE_MS) }))
    );

    await expect(getTabsSession({ tmbId: mockTmbId, now })).resolves.toEqual({ tabs: [] });
    expect(listTabsMock).not.toHaveBeenCalled();
  });

  it('getTabsSession：云端列表失败返回空列表（前端静默）', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));
    listTabsMock.mockResolvedValue(null);

    await expect(getTabsSession({ tmbId: mockTmbId, now })).resolves.toEqual({ tabs: [] });
  });

  it('newTabSession：无进行中会话返回空列表，不触碰云端', async () => {
    findOneMock.mockReturnValue(leanChain(null));

    await expect(newTabSession({ tmbId: mockTmbId, now })).resolves.toEqual({ tabs: [] });
    expect(newTabMock).not.toHaveBeenCalled();
  });

  it('newTabSession：新建后返回用户标签', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));

    await expect(newTabSession({ tmbId: mockTmbId, now })).resolves.toEqual({
      tabs: visibleTabs
    });
    expect(newTabMock).toHaveBeenCalledWith('cloud-1');
  });

  it('selectTabSession：非法索引直接拒绝，不触碰云端', async () => {
    await expect(selectTabSession({ tmbId: mockTmbId, index: 0, now })).resolves.toEqual({
      selected: false,
      tabs: []
    });
    expect(findOneMock).not.toHaveBeenCalled();
    expect(selectTabMock).not.toHaveBeenCalled();
  });

  it('selectTabSession：切换成功并返回最新标签', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));

    await expect(selectTabSession({ tmbId: mockTmbId, index: 2, now })).resolves.toEqual({
      selected: true,
      tabs: visibleTabs
    });
    expect(selectTabMock).toHaveBeenCalledWith('cloud-1', 2);
    expect(listTabsMock).toHaveBeenCalledWith('cloud-1');
  });

  it('selectTabSession：云端切换失败仍返回最新标签（对齐页面态）', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));
    selectTabMock.mockResolvedValue(false);

    await expect(selectTabSession({ tmbId: mockTmbId, index: 2, now })).resolves.toEqual({
      selected: false,
      tabs: visibleTabs
    });
  });

  it('closeTabSession：非法索引直接拒绝，不触碰云端', async () => {
    await expect(closeTabSession({ tmbId: mockTmbId, index: 0, now })).resolves.toEqual({
      closed: false,
      tabs: []
    });
    expect(findOneMock).not.toHaveBeenCalled();
    expect(closeTabMock).not.toHaveBeenCalled();
  });

  it('closeTabSession：关掉用户标签后返回剩余标签', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));
    listTabsMock.mockResolvedValue([
      { index: 1, title: '主页 | 入境事务处', url: 'https://www.immd.gov.hk/hks/index.html', current: true }
    ]);

    await expect(closeTabSession({ tmbId: mockTmbId, index: 2, now })).resolves.toEqual({
      closed: true,
      tabs: [
        {
          index: 1,
          title: '主页 | 入境事务处',
          url: 'https://www.immd.gov.hk/hks/index.html',
          current: true
        }
      ]
    });
    expect(closeTabMock).toHaveBeenCalledWith('cloud-1', 2);
    expect(newTabMock).not.toHaveBeenCalled();
  });

  it('closeTabSession：关掉最后一个用户标签后自动补一个空白标签', async () => {
    findOneMock.mockReturnValue(leanChain(activeDoc()));
    listTabsMock.mockResolvedValue([]);
    newTabMock.mockResolvedValue([
      { index: 1, title: '', url: 'about:blank', current: true }
    ]);

    await expect(closeTabSession({ tmbId: mockTmbId, index: 1, now })).resolves.toEqual({
      closed: true,
      tabs: [{ index: 1, title: '', url: 'about:blank', current: true }]
    });
    expect(newTabMock).toHaveBeenCalledWith('cloud-1');
  });

  it('closeTabSession：无进行中会话返回空列表，不触碰云端', async () => {
    findOneMock.mockReturnValue(leanChain(null));

    await expect(closeTabSession({ tmbId: mockTmbId, index: 1, now })).resolves.toEqual({
      closed: false,
      tabs: []
    });
    expect(closeTabMock).not.toHaveBeenCalled();
  });
});

describe('assertBuiltinBrowserUser', () => {
  it('管理员直通：不查库', async () => {
    await expect(
      assertBuiltinBrowserUser({ userId: 'u-1', isRoot: true })
    ).resolves.toBeUndefined();
    expect(userFindByIdMock).not.toHaveBeenCalled();
  });

  it('灰度账号 jinhui：放行', async () => {
    userFindByIdMock.mockReturnValue(leanChain({ username: 'jinhui@airscend.com' }));

    await expect(
      assertBuiltinBrowserUser({ userId: 'u-2', isRoot: false })
    ).resolves.toBeUndefined();
  });

  it('名单外账号：抛内测中文提示', async () => {
    userFindByIdMock.mockReturnValue(leanChain({ username: 'someone' }));

    await expect(assertBuiltinBrowserUser({ userId: 'u-3', isRoot: false })).rejects.toThrow(
      '该功能正在内测中，暂未对你开放'
    );
  });
});
