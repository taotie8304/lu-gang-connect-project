import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findOneMock, updateOneMock, incrUserPointsMock } = vi.hoisted(() => ({
  findOneMock: vi.fn(),
  updateOneMock: vi.fn(),
  incrUserPointsMock: vi.fn()
}));

vi.mock('@fastgpt/service/support/wallet/checkin/schema', () => ({
  MongoUserCheckins: {
    findOne: findOneMock,
    updateOne: updateOneMock
  }
}));

vi.mock('@fastgpt/service/support/wallet/points/controller', () => ({
  incrUserPoints: incrUserPointsMock
}));

import {
  calcCheckinReward,
  checkin,
  getBeijingDate,
  getCheckinStatus
} from '@fastgpt/service/support/wallet/checkin/controller';

const mockTeamId = '507f1f77bcf86cd799439011';
const mockTmbId = '507f1f77bcf86cd799439022';

/** 北京时间当天 12:00（UTC 04:00） */
const baseNow = new Date('2026-10-15T04:00:00.000Z');

/** 构造 MongoUserCheckins.findOne({...}).lean() 链式 mock */
const leanChain = (doc: unknown) => ({
  lean: vi.fn().mockResolvedValue(doc)
});

describe('getBeijingDate', () => {
  it('北京时间当天 23:59 仍算当天', () => {
    expect(getBeijingDate(new Date('2026-10-15T15:59:59.000Z'))).toBe('2026-10-15');
  });

  it('北京时间过零点进入新一天', () => {
    expect(getBeijingDate(new Date('2026-10-15T16:00:00.000Z'))).toBe('2026-10-16');
  });
});

describe('calcCheckinReward', () => {
  it('平日基础奖励 5', () => {
    expect(calcCheckinReward(1)).toBe(5);
  });

  it('连签第 7 天共 15（基础 5 + 额外 10）', () => {
    expect(calcCheckinReward(7)).toBe(15);
  });

  it('每 7 天循环触发（第 14 天再 +10）', () => {
    expect(calcCheckinReward(14)).toBe(15);
  });

  it('第 8 天回到基础奖励', () => {
    expect(calcCheckinReward(8)).toBe(5);
  });
});

describe('getCheckinStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('从未打卡：未打卡、连签 0、预告 5', async () => {
    findOneMock.mockReturnValue(leanChain(null));

    await expect(getCheckinStatus({ tmbId: mockTmbId, now: baseNow })).resolves.toEqual({
      checkedToday: false,
      streak: 0,
      nextRewardPreview: 5
    });
  });

  it('今日已打卡：连签不变，预告顺延到明天的奖励', async () => {
    findOneMock.mockReturnValue(
      leanChain({ teamId: mockTeamId, tmbId: mockTmbId, streak: 6, lastCheckinDate: '2026-10-15' })
    );

    await expect(getCheckinStatus({ tmbId: mockTmbId, now: baseNow })).resolves.toEqual({
      checkedToday: true,
      streak: 6,
      nextRewardPreview: 15
    });
  });

  it('昨日打过：今日可续签，预告按续签后连签计算', async () => {
    findOneMock.mockReturnValue(
      leanChain({ teamId: mockTeamId, tmbId: mockTmbId, streak: 6, lastCheckinDate: '2026-10-14' })
    );

    await expect(getCheckinStatus({ tmbId: mockTmbId, now: baseNow })).resolves.toEqual({
      checkedToday: false,
      streak: 6,
      nextRewardPreview: 15
    });
  });

  it('断签：连签清零展示，预告回到 5', async () => {
    findOneMock.mockReturnValue(
      leanChain({ teamId: mockTeamId, tmbId: mockTmbId, streak: 5, lastCheckinDate: '2026-10-12' })
    );

    await expect(getCheckinStatus({ tmbId: mockTmbId, now: baseNow })).resolves.toEqual({
      checkedToday: false,
      streak: 0,
      nextRewardPreview: 5
    });
  });
});

describe('checkin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOneMock.mockResolvedValue({});
    incrUserPointsMock.mockResolvedValue(undefined);
  });

  it('首日打卡：建立记录，连签 1，发 5 Credits', async () => {
    findOneMock.mockReturnValue(leanChain(null));

    await expect(checkin({ teamId: mockTeamId, tmbId: mockTmbId, now: baseNow })).resolves.toEqual({
      streak: 1,
      reward: 5
    });

    expect(updateOneMock).toHaveBeenCalledWith(
      { tmbId: mockTmbId, lastCheckinDate: { $ne: '2026-10-15' } },
      {
        $set: {
          teamId: mockTeamId,
          lastCheckinDate: '2026-10-15',
          streak: 1,
          lastReward: 5
        },
        $inc: { totalCheckins: 1 }
      },
      { upsert: true }
    );
    expect(incrUserPointsMock).toHaveBeenCalledWith({
      teamId: mockTeamId,
      tmbId: mockTmbId,
      points: 5
    });
  });

  it('连签累加：昨日已签连签 3 天 → 4 天，发 5 Credits', async () => {
    findOneMock.mockReturnValue(
      leanChain({ teamId: mockTeamId, tmbId: mockTmbId, streak: 3, lastCheckinDate: '2026-10-14' })
    );

    await expect(checkin({ teamId: mockTeamId, tmbId: mockTmbId, now: baseNow })).resolves.toEqual({
      streak: 4,
      reward: 5
    });
    expect(incrUserPointsMock).toHaveBeenCalledWith({
      teamId: mockTeamId,
      tmbId: mockTmbId,
      points: 5
    });
  });

  it('断签重置：3 天前签过连签 5 天 → 重新从 1 起算', async () => {
    findOneMock.mockReturnValue(
      leanChain({ teamId: mockTeamId, tmbId: mockTmbId, streak: 5, lastCheckinDate: '2026-10-12' })
    );

    await expect(checkin({ teamId: mockTeamId, tmbId: mockTmbId, now: baseNow })).resolves.toEqual({
      streak: 1,
      reward: 5
    });
  });

  it('连签第 7 天：连签 6 天 → 7 天，发 15 Credits', async () => {
    findOneMock.mockReturnValue(
      leanChain({ teamId: mockTeamId, tmbId: mockTmbId, streak: 6, lastCheckinDate: '2026-10-14' })
    );

    await expect(checkin({ teamId: mockTeamId, tmbId: mockTmbId, now: baseNow })).resolves.toEqual({
      streak: 7,
      reward: 15
    });
    expect(incrUserPointsMock).toHaveBeenCalledWith({
      teamId: mockTeamId,
      tmbId: mockTmbId,
      points: 15
    });
  });

  it('重复打卡拒绝：今日已签，抛可操作中文提示且不入账', async () => {
    findOneMock.mockReturnValue(
      leanChain({ teamId: mockTeamId, tmbId: mockTmbId, streak: 2, lastCheckinDate: '2026-10-15' })
    );

    await expect(checkin({ teamId: mockTeamId, tmbId: mockTmbId, now: baseNow })).rejects.toThrow(
      '今日已打卡'
    );
    expect(updateOneMock).not.toHaveBeenCalled();
    expect(incrUserPointsMock).not.toHaveBeenCalled();
  });

  it('并发双击撞唯一索引：按今日已打卡处理，不重复入账', async () => {
    findOneMock.mockReturnValue(
      leanChain({ teamId: mockTeamId, tmbId: mockTmbId, streak: 2, lastCheckinDate: '2026-10-14' })
    );
    updateOneMock.mockRejectedValue(
      Object.assign(new Error('E11000 duplicate key error'), { code: 11000 })
    );

    await expect(checkin({ teamId: mockTeamId, tmbId: mockTmbId, now: baseNow })).rejects.toThrow(
      '今日已打卡'
    );
    expect(incrUserPointsMock).not.toHaveBeenCalled();
  });

  it('跨日判定：北京时间过零点后按新一天续签', async () => {
    // UTC 2026-10-15 16:30 = 北京时间 2026-10-16 00:30
    const crossNow = new Date('2026-10-15T16:30:00.000Z');
    findOneMock.mockReturnValue(
      leanChain({ teamId: mockTeamId, tmbId: mockTmbId, streak: 2, lastCheckinDate: '2026-10-15' })
    );

    await expect(checkin({ teamId: mockTeamId, tmbId: mockTmbId, now: crossNow })).resolves.toEqual({
      streak: 3,
      reward: 5
    });
    expect(updateOneMock).toHaveBeenCalledWith(
      { tmbId: mockTmbId, lastCheckinDate: { $ne: '2026-10-16' } },
      expect.objectContaining({
        $set: expect.objectContaining({ lastCheckinDate: '2026-10-16', streak: 3 })
      }),
      { upsert: true }
    );
  });
});
