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
  resizeCloudSessionMock
} = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  insertOneMock: vi.fn(),
  updateOneMock: vi.fn(),
  findMock: vi.fn(),
  userFindByIdMock: vi.fn(),
  createCloudSessionMock: vi.fn(),
  refreshCloudSessionMock: vi.fn(),
  closeCloudSessionMock: vi.fn(),
  resizeCloudSessionMock: vi.fn()
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
  isBuiltinBrowserConfigured: vi.fn().mockReturnValue(true)
}));

vi.mock('@fastgpt/service/support/user/schema', () => ({
  MongoUser: { findById: userFindByIdMock }
}));

import {
  assertBuiltinBrowserUser,
  closeSession,
  getSessionStatus,
  openSession,
  resizeSession,
  sweepOverdueSessions
} from '@fastgpt/service/support/builtinBrowser/controller';

const mockTeamId = '507f1f77bcf86cd799439011';
const mockTmbId = '507f1f77bcf86cd799439022';

const MINUTE_MS = 60 * 1000;
const MAX_MS = 30 * MINUTE_MS;

const now = new Date('2026-10-15T02:00:00.000Z');

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
    findOneMock
      .mockReturnValueOnce(leanChain(null))
      .mockReturnValueOnce(leanChain(activeDoc({ cloudSessionId: 'cloud-winner', resourceUrl: 'https://viewer.example/w', expiresAt: new Date(now.getTime() + 29 * MINUTE_MS) })));
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
    findOneMock.mockReturnValue(leanChain(activeDoc({ openTime: new Date(now.getTime() - 12.5 * MINUTE_MS) })));

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
        activeDoc({ _id: 'doc-1', cloudSessionId: 'cloud-1', expiresAt: new Date(now.getTime() - MINUTE_MS) }),
        activeDoc({ _id: 'doc-2', cloudSessionId: 'cloud-2', expiresAt: new Date(now.getTime() - 5 * MINUTE_MS) })
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

describe('assertBuiltinBrowserUser', () => {
  it('管理员直通：不查库', async () => {
    await expect(assertBuiltinBrowserUser({ userId: 'u-1', isRoot: true })).resolves.toBeUndefined();
    expect(userFindByIdMock).not.toHaveBeenCalled();
  });

  it('灰度账号 jinhui：放行', async () => {
    userFindByIdMock.mockReturnValue(leanChain({ username: 'jinhui' }));

    await expect(
      assertBuiltinBrowserUser({ userId: 'u-2', isRoot: false })
    ).resolves.toBeUndefined();
  });

  it('名单外账号：抛内测中文提示', async () => {
    userFindByIdMock.mockReturnValue(leanChain({ username: 'someone' }));

    await expect(
      assertBuiltinBrowserUser({ userId: 'u-3', isRoot: false })
    ).rejects.toThrow('该功能正在内测中，暂未对你开放');
  });
});
