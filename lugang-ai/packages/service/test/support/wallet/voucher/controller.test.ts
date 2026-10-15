import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMock, findOneMock, createMock, updateOneMock, countMembersMock } = vi.hoisted(() => ({
  findMock: vi.fn(),
  findOneMock: vi.fn(),
  createMock: vi.fn(),
  updateOneMock: vi.fn(),
  countMembersMock: vi.fn()
}));

vi.mock('@fastgpt/service/support/wallet/voucher/schema', () => ({
  MongoVouchers: {
    find: findMock,
    findOne: findOneMock,
    create: createMock,
    updateOne: updateOneMock
  }
}));

vi.mock('@fastgpt/service/support/user/team/teamMemberSchema', () => ({
  MongoTeamMember: {
    countDocuments: countMembersMock
  }
}));

import {
  VOUCHER_OCCUPIED_MESSAGE,
  calcVoucherDeduct,
  createRegisterVoucher,
  finalizeVoucherByBill,
  getMemberVouchers,
  getUserVouchers,
  internalToYuan,
  issueVouchers,
  lockVoucherForBill,
  releaseVoucherByBill,
  yuanToInternal
} from '@fastgpt/service/support/wallet/voucher/controller';

const mockTeamId = '507f1f77bcf86cd799439011';
const mockTmbId = '507f1f77bcf86cd799439022';
const mockVoucherId = '507f1f77bcf86cd799439033';
const mockOrderId = 'LG1700000000abcdef123456';

/** 构造 MongoVouchers.findOne({...}).lean() 链式 mock */
const leanChain = (doc: unknown) => ({
  lean: vi.fn().mockResolvedValue(doc)
});

describe('金额换算', () => {
  it('元转内部单位（整数元）', () => {
    expect(yuanToInternal(20)).toBe(2000000);
  });

  it('元转内部单位（两位小数）', () => {
    expect(yuanToInternal(0.01)).toBe(1000);
  });

  it('内部单位转元', () => {
    expect(internalToYuan(2000000)).toBe(20);
  });
});

describe('calcVoucherDeduct', () => {
  it('券剩余低于应付：抵扣券全部剩余（部分抵扣）', () => {
    expect(calcVoucherDeduct({ priceInternal: 1000000, remainingInternal: 500000 })).toBe(500000);
  });

  it('券剩余高于应付：只抵扣应付（留余）', () => {
    expect(calcVoucherDeduct({ priceInternal: 1000000, remainingInternal: 3000000 })).toBe(1000000);
  });

  it('券剩余为 0：抵扣 0', () => {
    expect(calcVoucherDeduct({ priceInternal: 1000000, remainingInternal: 0 })).toBe(0);
  });
});

describe('createRegisterVoucher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('创建 20 元注册赠券（source=register，issuedBy=system，随注册事务落库）', async () => {
    createMock.mockResolvedValue([]);

    await createRegisterVoucher({ teamId: mockTeamId, tmbId: mockTmbId, session: 'mockSession' });

    expect(createMock).toHaveBeenCalledWith(
      [
        {
          teamId: mockTeamId,
          tmbId: mockTmbId,
          amount: 2000000,
          remainingAmount: 2000000,
          source: 'register',
          issuedBy: 'system',
          note: '注册赠送'
        }
      ],
      { session: 'mockSession' }
    );
  });
});

describe('issueVouchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('批量发放：每名用户一张，金额与来源正确', async () => {
    countMembersMock.mockResolvedValue(2);
    createMock.mockResolvedValue([]);

    const res = await issueVouchers({
      teamId: mockTeamId,
      tmbIds: ['tmb-a', 'tmb-b'],
      amountYuan: 20.5,
      note: '补偿',
      issuedBy: mockTmbId
    });

    expect(res).toEqual({ count: 2 });
    expect(createMock).toHaveBeenCalledWith([
      {
        teamId: mockTeamId,
        tmbId: 'tmb-a',
        amount: 2050000,
        remainingAmount: 2050000,
        source: 'admin',
        issuedBy: mockTmbId,
        note: '补偿'
      },
      {
        teamId: mockTeamId,
        tmbId: 'tmb-b',
        amount: 2050000,
        remainingAmount: 2050000,
        source: 'admin',
        issuedBy: mockTmbId,
        note: '补偿'
      }
    ]);
  });

  it('金额不大于 0：拒绝', async () => {
    await expect(
      issueVouchers({ teamId: mockTeamId, tmbIds: ['tmb-a'], amountYuan: 0, issuedBy: mockTmbId })
    ).rejects.toThrow('代金券金额必须大于 0');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('金额超过两位小数：拒绝', async () => {
    await expect(
      issueVouchers({
        teamId: mockTeamId,
        tmbIds: ['tmb-a'],
        amountYuan: 1.234,
        issuedBy: mockTmbId
      })
    ).rejects.toThrow('代金券金额最多保留两位小数');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('未选择用户：拒绝', async () => {
    await expect(
      issueVouchers({ teamId: mockTeamId, tmbIds: [], amountYuan: 10, issuedBy: mockTmbId })
    ).rejects.toThrow('请至少选择一名用户');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('目标用户不存在或不在团队：拒绝', async () => {
    countMembersMock.mockResolvedValue(1);

    await expect(
      issueVouchers({
        teamId: mockTeamId,
        tmbIds: ['tmb-a', 'tmb-b'],
        amountYuan: 10,
        issuedBy: mockTmbId
      })
    ).rejects.toThrow('部分用户不存在或不在当前团队，请刷新后重试');
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe('lockVoucherForBill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('部分抵扣：原子预扣券剩余并锁定订单', async () => {
    findOneMock.mockReturnValue(
      leanChain({
        _id: mockVoucherId,
        tmbId: mockTmbId,
        amount: 500000,
        remainingAmount: 500000,
        lockedBillId: ''
      })
    );
    updateOneMock.mockResolvedValue({ modifiedCount: 1 });

    await expect(
      lockVoucherForBill({
        voucherId: mockVoucherId,
        tmbId: mockTmbId,
        priceInternal: 1000000,
        orderId: mockOrderId
      })
    ).resolves.toEqual({ deduct: 500000 });

    expect(updateOneMock).toHaveBeenCalledWith(
      {
        _id: mockVoucherId,
        tmbId: mockTmbId,
        lockedBillId: '',
        remainingAmount: { $gte: 500000 }
      },
      { $set: { lockedBillId: mockOrderId }, $inc: { remainingAmount: -500000 } }
    );
  });

  it('券额充足：只扣应付，券上留余', async () => {
    findOneMock.mockReturnValue(
      leanChain({ _id: mockVoucherId, tmbId: mockTmbId, remainingAmount: 3000000, lockedBillId: '' })
    );
    updateOneMock.mockResolvedValue({ modifiedCount: 1 });

    await expect(
      lockVoucherForBill({
        voucherId: mockVoucherId,
        tmbId: mockTmbId,
        priceInternal: 1000000,
        orderId: mockOrderId
      })
    ).resolves.toEqual({ deduct: 1000000 });

    expect(updateOneMock).toHaveBeenCalledWith(
      expect.objectContaining({ remainingAmount: { $gte: 1000000 } }),
      { $set: { lockedBillId: mockOrderId }, $inc: { remainingAmount: -1000000 } }
    );
  });

  it('券不存在或不属于当前用户：拒绝', async () => {
    findOneMock.mockReturnValue(leanChain(null));

    await expect(
      lockVoucherForBill({
        voucherId: mockVoucherId,
        tmbId: mockTmbId,
        priceInternal: 1000000,
        orderId: mockOrderId
      })
    ).rejects.toThrow('代金券不存在或不属于当前账号');
    expect(updateOneMock).not.toHaveBeenCalled();
  });

  it('券余额为 0：拒绝', async () => {
    findOneMock.mockReturnValue(
      leanChain({ _id: mockVoucherId, tmbId: mockTmbId, remainingAmount: 0, lockedBillId: '' })
    );

    await expect(
      lockVoucherForBill({
        voucherId: mockVoucherId,
        tmbId: mockTmbId,
        priceInternal: 1000000,
        orderId: mockOrderId
      })
    ).rejects.toThrow('该代金券已无可用余额，请选择其他代金券');
    expect(updateOneMock).not.toHaveBeenCalled();
  });

  it('并发原子性：条件更新失败且券已被其他订单占用 → 占用提示', async () => {
    findOneMock
      .mockReturnValueOnce(leanChain({ _id: mockVoucherId, remainingAmount: 2000000, lockedBillId: '' }))
      .mockReturnValueOnce(leanChain({ _id: mockVoucherId, remainingAmount: 2000000, lockedBillId: 'LG-other' }));
    updateOneMock.mockResolvedValue({ modifiedCount: 0 });

    await expect(
      lockVoucherForBill({
        voucherId: mockVoucherId,
        tmbId: mockTmbId,
        priceInternal: 1000000,
        orderId: mockOrderId
      })
    ).rejects.toThrow(VOUCHER_OCCUPIED_MESSAGE);
  });

  it('并发原子性：条件更新失败且券余额已变化 → 余额不足提示', async () => {
    findOneMock
      .mockReturnValueOnce(leanChain({ _id: mockVoucherId, remainingAmount: 2000000, lockedBillId: '' }))
      .mockReturnValueOnce(leanChain({ _id: mockVoucherId, remainingAmount: 100, lockedBillId: '' }));
    updateOneMock.mockResolvedValue({ modifiedCount: 0 });

    await expect(
      lockVoucherForBill({
        voucherId: mockVoucherId,
        tmbId: mockTmbId,
        priceInternal: 1000000,
        orderId: mockOrderId
      })
    ).rejects.toThrow('该代金券可用余额不足，请重新选择代金券');
  });

  it('占用提示文案固定为可操作中文说明', () => {
    expect(VOUCHER_OCCUPIED_MESSAGE).toBe(
      '该代金券正在一笔未完成的订单中使用，请先继续支付或取消该订单'
    );
  });
});

describe('releaseVoucherByBill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('订单取消：解锁并将预扣金额退回券', async () => {
    updateOneMock.mockResolvedValue({ modifiedCount: 1 });

    await releaseVoucherByBill({
      voucherId: mockVoucherId,
      orderId: mockOrderId,
      deductAmount: 500000
    });

    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: mockVoucherId, lockedBillId: mockOrderId },
      { $set: { lockedBillId: '' }, $inc: { remainingAmount: 500000 } }
    );
  });

  it('订单未用券：不做任何操作', async () => {
    await releaseVoucherByBill({ voucherId: '', orderId: mockOrderId, deductAmount: 0 });

    expect(updateOneMock).not.toHaveBeenCalled();
  });
});

describe('finalizeVoucherByBill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('支付成功：解锁并写入使用记录（定案）', async () => {
    updateOneMock.mockResolvedValue({ modifiedCount: 1 });

    await finalizeVoucherByBill({
      voucherId: mockVoucherId,
      orderId: mockOrderId,
      deductAmount: 500000
    });

    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: mockVoucherId, lockedBillId: mockOrderId },
      {
        $set: { lockedBillId: '' },
        $push: { usedBills: { billId: mockOrderId, deducted: 500000, at: expect.any(Date) } }
      }
    );
  });

  it('订单未用券：不做任何操作', async () => {
    await finalizeVoucherByBill({ voucherId: '', orderId: mockOrderId, deductAmount: 0 });

    expect(updateOneMock).not.toHaveBeenCalled();
  });
});

describe('getUserVouchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('返回用户持券（金额换算为元，占用标记透出）', async () => {
    const createTime = new Date('2026-10-15T04:00:00.000Z');
    findMock.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: mockVoucherId,
            tmbId: mockTmbId,
            amount: 2000000,
            remainingAmount: 1500000,
            source: 'admin',
            note: '补偿',
            lockedBillId: '',
            createTime
          },
          {
            _id: 'voucher-b',
            tmbId: mockTmbId,
            amount: 2000000,
            remainingAmount: 2000000,
            source: 'register',
            note: '注册赠送',
            lockedBillId: mockOrderId,
            createTime
          }
        ])
      })
    });

    await expect(getUserVouchers({ tmbId: mockTmbId })).resolves.toEqual([
      {
        _id: mockVoucherId,
        amount: 20,
        remainingAmount: 15,
        source: 'admin',
        note: '补偿',
        isLocked: false,
        createTime
      },
      {
        _id: 'voucher-b',
        amount: 20,
        remainingAmount: 20,
        source: 'register',
        note: '注册赠送',
        isLocked: true,
        createTime
      }
    ]);

    expect(findMock).toHaveBeenCalledWith({ tmbId: mockTmbId });
  });
});

describe('getMemberVouchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('管理员查看指定成员持券：按团队与成员过滤', async () => {
    findMock.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([])
      })
    });

    await getMemberVouchers({ teamId: mockTeamId, tmbId: mockTmbId });

    expect(findMock).toHaveBeenCalledWith({ teamId: mockTeamId, tmbId: mockTmbId });
  });
});
