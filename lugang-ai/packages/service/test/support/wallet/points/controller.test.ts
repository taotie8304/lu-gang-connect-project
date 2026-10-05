import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addMonths } from 'date-fns';
import { StandardSubLevelEnum, SubModeEnum } from '@fastgpt/global/support/wallet/sub/constants';

const { findOneMock, createMock, updateOneMock } = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  createMock: vi.fn(),
  updateOneMock: vi.fn()
}));

vi.mock('@fastgpt/service/support/wallet/points/schema', () => ({
  MongoUserPoints: {
    findOne: findOneMock,
    create: createMock,
    updateOne: updateOneMock
  }
}));

import {
  getFreePointsAmount,
  getOrInitUserPoints,
  incrUserPoints,
  grantUserPlan,
  deductUserPoints
} from '@fastgpt/service/support/wallet/points/controller';

const mockTeamId = '507f1f77bcf86cd799439011';
const mockTmbId = '507f1f77bcf86cd799439022';

/** 构造 MongoUserPoints.findOne({...}).session(...).lean() 链式 mock */
const findOneChain = (doc: unknown) => ({
  session: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(doc)
  })
});

describe('getFreePointsAmount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (global as any).subPlans;
  });

  it('读取 global.subPlans 免费档配置额度', () => {
    (global as any).subPlans = {
      standard: {
        [StandardSubLevelEnum.free]: {
          totalPoints: 500
        }
      }
    };

    expect(getFreePointsAmount()).toBe(500);
  });

  it('无配置时兜底 300', () => {
    expect(getFreePointsAmount()).toBe(300);
  });
});

describe('getOrInitUserPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (global as any).subPlans;
  });

  it('账户已存在时直接返回，不创建', async () => {
    const existing = { teamId: mockTeamId, tmbId: mockTmbId, totalPoints: 300, surplusPoints: 300 };
    findOneMock.mockReturnValue(findOneChain(existing));

    await expect(getOrInitUserPoints({ teamId: mockTeamId, tmbId: mockTmbId })).resolves.toBe(
      existing
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it('账户不存在时按免费档额度初始化创建', async () => {
    findOneMock.mockReturnValue(findOneChain(null));
    const created = { teamId: mockTeamId, tmbId: mockTmbId, totalPoints: 300, surplusPoints: 300 };
    createMock.mockResolvedValue([{ toObject: () => created }]);

    await expect(getOrInitUserPoints({ teamId: mockTeamId, tmbId: mockTmbId })).resolves.toBe(
      created
    );
    expect(createMock).toHaveBeenCalledWith(
      [
        {
          teamId: mockTeamId,
          tmbId: mockTmbId,
          totalPoints: 300,
          surplusPoints: 300,
          currentSubLevel: StandardSubLevelEnum.free
        }
      ],
      { session: undefined, ordered: true }
    );
  });

  it('并发初始化撞唯一索引时回读已创建账户', async () => {
    const fallback = { teamId: mockTeamId, tmbId: mockTmbId, totalPoints: 300, surplusPoints: 300 };
    findOneMock
      .mockReturnValueOnce(findOneChain(null))
      .mockReturnValueOnce(findOneChain(fallback));
    createMock.mockRejectedValue(new Error('E11000 duplicate key'));

    await expect(getOrInitUserPoints({ teamId: mockTeamId, tmbId: mockTmbId })).resolves.toBe(
      fallback
    );
  });

  it('创建失败且回读为空时抛出原错误', async () => {
    const error = new Error('db down');
    findOneMock.mockReturnValue(findOneChain(null));
    createMock.mockRejectedValue(error);

    await expect(getOrInitUserPoints({ teamId: mockTeamId, tmbId: mockTmbId })).rejects.toBe(
      error
    );
  });
});

describe('incrUserPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (global as any).subPlans;
  });

  it('入账时累计获得与余额同步递增', async () => {
    updateOneMock.mockResolvedValue({});

    await incrUserPoints({ teamId: mockTeamId, tmbId: mockTmbId, points: 1000 });

    expect(updateOneMock).toHaveBeenCalledWith(
      { tmbId: mockTmbId },
      {
        $setOnInsert: {
          teamId: mockTeamId,
          tmbId: mockTmbId,
          totalPoints: 300,
          surplusPoints: 300,
          currentSubLevel: StandardSubLevelEnum.free
        },
        $inc: { totalPoints: 1000, surplusPoints: 1000 }
      },
      { upsert: true, session: undefined }
    );
  });

  it('points 为 0 时跳过写入', async () => {
    await incrUserPoints({ teamId: mockTeamId, tmbId: mockTmbId, points: 0 });

    expect(updateOneMock).not.toHaveBeenCalled();
  });
});

describe('deductUserPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('按消耗量扣减余额（允许透支为负）', async () => {
    updateOneMock.mockResolvedValue({});

    await deductUserPoints({ tmbId: mockTmbId, points: 42 });

    expect(updateOneMock).toHaveBeenCalledWith(
      { tmbId: mockTmbId },
      { $inc: { surplusPoints: -42 } }
    );
  });

  it('points 为 0 时跳过写入', async () => {
    await deductUserPoints({ tmbId: mockTmbId, points: 0 });

    expect(updateOneMock).not.toHaveBeenCalled();
  });
});

describe('grantUserPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (global as any).subPlans;
  });

  it('账户仍在有效期内时到期时间在原有基础上顺延', async () => {
    const future = new Date('2027-01-15T00:00:00.000Z');
    findOneMock.mockReturnValue(
      findOneChain({ teamId: mockTeamId, tmbId: mockTmbId, expiredTime: future })
    );
    updateOneMock.mockResolvedValue({});

    await grantUserPlan({
      teamId: mockTeamId,
      tmbId: mockTmbId,
      level: StandardSubLevelEnum.basic,
      subMode: SubModeEnum.year,
      grantPoints: 6900
    });

    expect(updateOneMock).toHaveBeenCalledWith(
      { tmbId: mockTmbId },
      {
        $set: {
          currentSubLevel: StandardSubLevelEnum.basic,
          currentMode: SubModeEnum.year,
          expiredTime: addMonths(future, 12)
        },
        $inc: { totalPoints: 6900, surplusPoints: 6900 }
      }
    );
  });

  it('账户已过期时到期时间从当前时间起算', async () => {
    const past = new Date('2025-01-01T00:00:00.000Z');
    findOneMock.mockReturnValue(
      findOneChain({ teamId: mockTeamId, tmbId: mockTmbId, expiredTime: past })
    );
    updateOneMock.mockResolvedValue({});

    await grantUserPlan({
      teamId: mockTeamId,
      tmbId: mockTmbId,
      level: StandardSubLevelEnum.basic,
      subMode: SubModeEnum.month,
      grantPoints: 1000
    });

    const setArg = updateOneMock.mock.calls[0][1].$set;
    const expected = addMonths(new Date(), 1);
    expect(Math.abs(new Date(setArg.expiredTime).getTime() - expected.getTime())).toBeLessThan(
      5000
    );
  });

  it('新账户购买时按所选周期计算到期时间并递增积分', async () => {
    findOneMock.mockReturnValue(findOneChain(null));
    createMock.mockResolvedValue([
      { toObject: () => ({ teamId: mockTeamId, tmbId: mockTmbId, totalPoints: 300 }) }
    ]);
    updateOneMock.mockResolvedValue({});

    await grantUserPlan({
      teamId: mockTeamId,
      tmbId: mockTmbId,
      level: StandardSubLevelEnum.advanced,
      subMode: SubModeEnum.year,
      grantPoints: 9800
    });

    const [filter, update] = updateOneMock.mock.calls[0];
    expect(filter).toEqual({ tmbId: mockTmbId });
    expect(update.$set.currentSubLevel).toBe(StandardSubLevelEnum.advanced);
    expect(update.$set.currentMode).toBe(SubModeEnum.year);
    expect(update.$inc).toEqual({ totalPoints: 9800, surplusPoints: 9800 });

    const expected = addMonths(new Date(), 12);
    expect(Math.abs(new Date(update.$set.expiredTime).getTime() - expected.getTime())).toBeLessThan(
      5000
    );
  });
});
