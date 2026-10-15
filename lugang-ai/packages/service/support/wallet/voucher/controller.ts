// 鲁港通 - 代金券核心引擎（Credits 改革批 3）：
// 管理员发放 / 注册赠礼 / 下单原子预扣 / 取消释放 / 支付成功定案；单次订单最多一张券，可部分使用。
import { MongoVouchers } from './schema';
import { MongoTeamMember } from '../../user/team/teamMemberSchema';
import { PRICE_SCALE } from '@fastgpt/global/support/wallet/constants';
import { VoucherSourceEnum } from '@fastgpt/global/support/wallet/voucher/constants';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import type {
  UserVoucherSchemaType,
  VoucherItemType
} from '@fastgpt/global/support/wallet/voucher/type';
import type { ClientSession } from '../../../common/mongo';

/** 注册赠礼面额（元） */
export const REGISTER_VOUCHER_AMOUNT_YUAN = 20;
/** 券被未完成订单占用时的提示（选券列表与下单失败处展示同一文案） */
export const VOUCHER_OCCUPIED_MESSAGE =
  '该代金券正在一笔未完成的订单中使用，请先继续支付或取消该订单';

/** 元 → 内部金额单位（元 × PRICE_SCALE） */
export const yuanToInternal = (yuan: number) => Math.round(yuan * PRICE_SCALE);
/** 内部金额单位 → 元 */
export const internalToYuan = (internal: number) => internal / PRICE_SCALE;

/** 抵扣数学：deduction = min(券剩余, 应付)；实付 = 应付 − deduction（由调用方计算） */
export const calcVoucherDeduct = ({
  priceInternal,
  remainingInternal
}: {
  priceInternal: number;
  remainingInternal: number;
}) => Math.min(priceInternal, remainingInternal);

const toVoucherItem = (doc: UserVoucherSchemaType): VoucherItemType => ({
  _id: String(doc._id),
  amount: internalToYuan(doc.amount),
  remainingAmount: internalToYuan(doc.remainingAmount),
  source: doc.source,
  note: doc.note,
  isLocked: !!doc.lockedBillId,
  createTime: doc.createTime
});

/** 注册赠礼：注册事务内创建 20 元券（source=register），与建户同事务保证一致性 */
export const createRegisterVoucher = async ({
  teamId,
  tmbId,
  session
}: {
  teamId: string;
  tmbId: string;
  session?: ClientSession;
}) => {
  const amount = yuanToInternal(REGISTER_VOUCHER_AMOUNT_YUAN);
  await MongoVouchers.create(
    [
      {
        teamId,
        tmbId,
        amount,
        remainingAmount: amount,
        source: VoucherSourceEnum.register,
        issuedBy: 'system',
        note: '注册赠送'
      }
    ],
    { session }
  );
};

/** 管理员批量发放：金额校验（> 0、最多两位小数）→ 团队成员校验 → 每人一张 */
export const issueVouchers = async ({
  teamId,
  tmbIds,
  amountYuan,
  note,
  issuedBy
}: {
  teamId: string;
  tmbIds: string[];
  /** 面额（元，最多两位小数） */
  amountYuan: number;
  note?: string;
  /** 发放人（管理员 tmbId） */
  issuedBy: string;
}) => {
  if (!Number.isFinite(amountYuan) || amountYuan <= 0) {
    throw new Error('代金券金额必须大于 0');
  }
  const cents = amountYuan * 100;
  if (Math.abs(cents - Math.round(cents)) > 1e-6) {
    throw new Error('代金券金额最多保留两位小数');
  }
  if (tmbIds.length === 0) {
    throw new Error('请至少选择一名用户');
  }

  const memberCount = await MongoTeamMember.countDocuments({
    teamId,
    _id: { $in: tmbIds },
    status: TeamMemberStatusEnum.active
  });
  if (memberCount !== tmbIds.length) {
    throw new Error('部分用户不存在或不在当前团队，请刷新后重试');
  }

  const amount = yuanToInternal(amountYuan);
  await MongoVouchers.create(
    tmbIds.map((tmbId) => ({
      teamId,
      tmbId,
      amount,
      remainingAmount: amount,
      source: VoucherSourceEnum.admin,
      issuedBy,
      note: note ?? ''
    }))
  );

  return { count: tmbIds.length };
};

/**
 * 下单原子预扣（防双花）：条件更新要求「未占用 + 余额充足」，并发下只有一方成功；
 * 失败方回读券状态，区分「被其他订单占用 / 余额已变化」给出可操作提示。
 * @returns deduct 本次抵扣金额（内部单位）
 */
export const lockVoucherForBill = async ({
  voucherId,
  tmbId,
  priceInternal,
  orderId
}: {
  voucherId: string;
  tmbId: string;
  /** 订单原价（内部单位） */
  priceInternal: number;
  /** 本次订单的商户订单号（作为占用标识） */
  orderId: string;
}): Promise<{ deduct: number }> => {
  const voucher = await MongoVouchers.findOne({ _id: voucherId, tmbId }).lean();
  if (!voucher) {
    throw new Error('代金券不存在或不属于当前账号');
  }
  if (voucher.remainingAmount <= 0) {
    throw new Error('该代金券已无可用余额，请选择其他代金券');
  }

  const deduct = calcVoucherDeduct({
    priceInternal,
    remainingInternal: voucher.remainingAmount
  });

  const updated = await MongoVouchers.updateOne(
    { _id: voucherId, tmbId, lockedBillId: '', remainingAmount: { $gte: deduct } },
    { $set: { lockedBillId: orderId }, $inc: { remainingAmount: -deduct } }
  );
  if (updated.modifiedCount !== 1) {
    const latest = await MongoVouchers.findOne({ _id: voucherId, tmbId }).lean();
    if (latest?.lockedBillId) {
      throw new Error(VOUCHER_OCCUPIED_MESSAGE);
    }
    throw new Error('该代金券可用余额不足，请重新选择代金券');
  }

  return { deduct };
};

/** 订单取消/关闭：释放预扣（条件更新保证幂等，重复调用不再重复返还） */
export const releaseVoucherByBill = async ({
  voucherId,
  orderId,
  deductAmount
}: {
  voucherId?: string;
  orderId: string;
  /** 预扣金额（内部单位） */
  deductAmount: number;
}) => {
  if (!voucherId) return;
  await MongoVouchers.updateOne(
    { _id: voucherId, lockedBillId: orderId },
    { $set: { lockedBillId: '' }, $inc: { remainingAmount: deductAmount } }
  );
};

/** 支付成功：解锁并写入使用记录（定案；条件更新保证幂等） */
export const finalizeVoucherByBill = async ({
  voucherId,
  orderId,
  deductAmount
}: {
  voucherId?: string;
  orderId: string;
  /** 抵扣金额（内部单位） */
  deductAmount: number;
}) => {
  if (!voucherId) return;
  await MongoVouchers.updateOne(
    { _id: voucherId, lockedBillId: orderId },
    {
      $set: { lockedBillId: '' },
      $push: { usedBills: { billId: orderId, deducted: deductAmount, at: new Date() } }
    }
  );
};

/** 用户持券列表（充值选券弹窗数据源） */
export const getUserVouchers = async ({
  tmbId
}: {
  tmbId: string;
}): Promise<VoucherItemType[]> => {
  const docs = await MongoVouchers.find({ tmbId }).sort({ createTime: -1 }).lean();
  return docs.map(toVoucherItem);
};

/** 管理员查看指定成员持券（用户管理页发券/持券弹窗） */
export const getMemberVouchers = async ({
  teamId,
  tmbId
}: {
  teamId: string;
  tmbId: string;
}): Promise<VoucherItemType[]> => {
  const docs = await MongoVouchers.find({ teamId, tmbId }).sort({ createTime: -1 }).lean();
  return docs.map(toVoucherItem);
};
