import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { adjustUserPointsByAdmin } from '@fastgpt/service/support/wallet/points/controller';

const mockTeamId = '507f1f77bcf86cd799439011';
const mockTmbId = '507f1f77bcf86cd799439022';

/** 构造 MongoUserPoints.findOne({...}).session(...).lean() 链式 mock */
const findOneChain = (doc: unknown) => ({
  session: vi.fn().mockReturnValue({
    lean: vi.fn().mockResolvedValue(doc)
  })
});

const existingAccount = {
  teamId: mockTeamId,
  tmbId: mockTmbId,
  totalPoints: 1000,
  surplusPoints: 800
};

describe('adjustUserPointsByAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOneMock.mockReturnValue(findOneChain(existingAccount));
    updateOneMock.mockResolvedValue({ modifiedCount: 1 });
  });

  it('增加 Credits：累计获得与余额同步递增', async () => {
    await adjustUserPointsByAdmin({ teamId: mockTeamId, tmbId: mockTmbId, delta: 100 });

    expect(updateOneMock).toHaveBeenCalledWith(
      { tmbId: mockTmbId },
      { $inc: { totalPoints: 100, surplusPoints: 100 } }
    );
  });

  it('扣减 Credits：条件更新保证余额充足，累计获得不变', async () => {
    await adjustUserPointsByAdmin({ teamId: mockTeamId, tmbId: mockTmbId, delta: -200 });

    expect(updateOneMock).toHaveBeenCalledWith(
      { tmbId: mockTmbId, surplusPoints: { $gte: 200 } },
      { $inc: { surplusPoints: -200 } }
    );
  });

  it('扣减超过当前余额：拒绝并给出可操作提示', async () => {
    updateOneMock.mockResolvedValue({ modifiedCount: 0 });

    await expect(
      adjustUserPointsByAdmin({ teamId: mockTeamId, tmbId: mockTmbId, delta: -900 })
    ).rejects.toThrow('扣减数量不能超过用户当前 Credits 余额，请调整后重试');
  });

  it('调整量为 0：拒绝', async () => {
    await expect(
      adjustUserPointsByAdmin({ teamId: mockTeamId, tmbId: mockTmbId, delta: 0 })
    ).rejects.toThrow('Credits 调整数量必须为非零整数');
    expect(updateOneMock).not.toHaveBeenCalled();
  });

  it('调整量非整数：拒绝', async () => {
    await expect(
      adjustUserPointsByAdmin({ teamId: mockTeamId, tmbId: mockTmbId, delta: 1.5 })
    ).rejects.toThrow('Credits 调整数量必须为非零整数');
    expect(updateOneMock).not.toHaveBeenCalled();
  });

  it('账户尚未初始化：先按免费档额度建户，再执行调整', async () => {
    findOneMock.mockReturnValue(findOneChain(null));
    createMock.mockResolvedValue([
      { toObject: () => ({ teamId: mockTeamId, tmbId: mockTmbId, totalPoints: 300 }) }
    ]);

    await adjustUserPointsByAdmin({ teamId: mockTeamId, tmbId: mockTmbId, delta: 50 });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock).toHaveBeenCalledWith(
      { tmbId: mockTmbId },
      { $inc: { totalPoints: 50, surplusPoints: 50 } }
    );
  });
});
