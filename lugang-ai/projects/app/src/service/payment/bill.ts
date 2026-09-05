// 鲁港通 - 订单服务（N4 在线支付，支付宝当面付）
// 生命周期：创建(NOTPAY) -> 支付宝预下单出码 -> 轮询查单/异步通知双通道核销 -> 发放套餐/积分
import { addLog } from '@fastgpt/service/common/system/log';
import { MongoBill, type BillSchemaType } from '@fastgpt/service/support/wallet/bill/schema';
import { MongoTeamSub } from '@fastgpt/service/support/wallet/sub/schema';
import { sortStandPlans, clearTeamPlanCache } from '@fastgpt/service/support/wallet/sub/utils';
import { PRICE_SCALE } from '@fastgpt/global/support/wallet/constants';
import {
  BillStatusEnum,
  BillTypeEnum,
  BillPayWayEnum
} from '@fastgpt/global/support/wallet/bill/constants';
import {
  StandardSubLevelEnum,
  SubModeEnum,
  SubTypeEnum,
  subModeMap,
  standardSubLevelMap
} from '@fastgpt/global/support/wallet/sub/constants';
import {
  getStandardPlanReadPrice,
  getStandardPlanGrantPoints,
  getExtraPointsPackage,
  getExtraPointsGrantPoints
} from '@fastgpt/global/support/wallet/bill/lugangPrice';
import { getNanoid } from '@fastgpt/global/common/string/tools';
import { addMonths } from 'date-fns';
import dayjs from 'dayjs';
import { alipayPrecreate, alipayQueryOrder } from './alipay';

/** 商户订单号：日期前缀 + 随机串，仅字母数字（支付宝 out_trade_no 限制） */
const generateOrderId = () =>
  `LG${Date.now()}${getNanoid(12).replace(/[^a-zA-Z0-9]/g, '')}`;

type CreateBillParams =
  | {
      type: `${BillTypeEnum.standSubPlan}`;
      level: `${StandardSubLevelEnum}`;
      subMode: `${SubModeEnum}`;
      teamId: string;
      tmbId: string;
    }
  | {
      type: `${BillTypeEnum.extraPoints}`;
      extraPoints: number;
      month: number;
      teamId: string;
      tmbId: string;
    };

/**
 * 创建支付订单：计价 -> 落库 -> 支付宝预下单 -> 回填收款码。
 * 计价口径与前端价格页完全一致（标准套餐年付 10 个月价；积分包按配置包价格）。
 */
export const createAlipayBill = async (params: CreateBillParams) => {
  const { teamId, tmbId, type } = params;
  const subPlans = global.subPlans;

  let readPrice: number;
  let subject: string;
  const metadata: Record<string, unknown> = { payWay: BillPayWayEnum.alipay };

  if (type === BillTypeEnum.standSubPlan) {
    const { level, subMode } = params;
    const price = getStandardPlanReadPrice({ subPlans, level, subMode });
    const grantPoints = getStandardPlanGrantPoints({ subPlans, level, subMode });
    if (price === null || grantPoints === null) {
      throw new Error('该套餐暂未开放购买，请联系管理员配置套餐');
    }
    readPrice = price;
    subject = `鲁港通-${standardSubLevelMap[level].label}-${
      subMode === SubModeEnum.year ? '年付' : '月付'
    }`;
    metadata.subMode = subMode;
    metadata.standSubLevel = level;
    metadata.month = subModeMap[subMode].durationMonth;
    metadata.totalPoints = grantPoints;
  } else if (type === BillTypeEnum.extraPoints) {
    const { extraPoints, month } = params;
    const pkg = getExtraPointsPackage({ subPlans, points: extraPoints, month });
    if (!pkg) {
      throw new Error('未找到对应的积分套餐，请从购买页的积分包中选择后重试');
    }
    readPrice = pkg.price;
    subject = `鲁港通-额外积分包-${extraPoints}分`;
    metadata.extraPoints = extraPoints;
    metadata.month = month;
    metadata.totalPoints = getExtraPointsGrantPoints(pkg);
  } else {
    throw new Error('该商品类型暂不支持在线支付');
  }

  if (!(readPrice > 0)) {
    throw new Error('订单金额异常，无法发起支付');
  }

  const orderId = generateOrderId();
  const [bill] = await MongoBill.create([
    {
      teamId,
      tmbId,
      orderId,
      status: BillStatusEnum.NOTPAY,
      type,
      payWay: BillPayWayEnum.alipay,
      price: Math.round(readPrice * PRICE_SCALE),
      metadata,
      createTime: new Date()
    }
  ]);

  const qrCode = await alipayPrecreate({
    outTradeNo: orderId,
    totalAmount: readPrice,
    subject
  });
  await MongoBill.updateOne({ _id: bill._id }, { $set: { qrCode } });

  addLog.info('支付宝订单创建成功', { orderId, teamId, type, readPrice });

  return {
    billId: String(bill._id),
    qrCode,
    readPrice,
    payment: BillPayWayEnum.alipay
  };
};

/**
 * 查询支付结果（前端弹窗轮询入口）：
 * 订单仍为待支付时主动向支付宝查单，查到已付款立即核销并发放。
 */
export const checkBillPayResult = async ({
  teamId,
  billId
}: {
  teamId: string;
  billId: string;
}): Promise<{ status: `${BillStatusEnum}`; description?: string }> => {
  const bill = await MongoBill.findOne({ _id: billId, teamId }).lean();
  if (!bill) {
    throw new Error('订单不存在或无权查看');
  }
  if (bill.status !== BillStatusEnum.NOTPAY) {
    return { status: bill.status };
  }

  const { tradeStatus, tradeNo } = await alipayQueryOrder({ outTradeNo: bill.orderId });
  if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
    await settleBill(bill, tradeNo);
    return { status: BillStatusEnum.SUCCESS };
  }
  if (tradeStatus === 'TRADE_CLOSED') {
    await MongoBill.updateOne(
      { _id: bill._id, status: BillStatusEnum.NOTPAY },
      { $set: { status: BillStatusEnum.CLOSED } }
    );
    return { status: BillStatusEnum.CLOSED };
  }
  return { status: BillStatusEnum.NOTPAY };
};

/**
 * 核销订单：状态原子翻转保证幂等（前端轮询与支付宝异步通知并发到达只发放一次），
 * 翻转成功后再执行发放；发放异常记录错误日志，由管理员凭订单号排查补发。
 */
export const settleBill = async (
  bill: Pick<BillSchemaType, '_id' | 'orderId' | 'price' | 'type' | 'metadata' | 'teamId'>,
  tradeNo?: string
) => {
  const updated = await MongoBill.updateOne(
    { _id: bill._id, status: BillStatusEnum.NOTPAY },
    {
      $set: {
        status: BillStatusEnum.SUCCESS,
        tradeNo,
        payTime: new Date(),
        paidAmount: bill.price
      }
    }
  );
  if (updated.modifiedCount !== 1) {
    return;
  }

  addLog.info('支付宝订单核销，开始发放权益', { orderId: bill.orderId });

  try {
    await grantBillRights(bill);
  } catch (error) {
    addLog.error('订单已核销但权益发放失败，需人工排查补发', {
      orderId: bill.orderId,
      error
    });
  }
};

/**
 * 发放权益（写团队订阅表，与系统套餐读取逻辑同源）：
 * - 标准套餐：作用于当前生效的套餐记录（续费延期/升降级换档），积分叠加；无生效记录则新建
 * - 额外积分：新建一条积分订阅，独立有效期
 */
const grantBillRights = async (
  bill: Pick<BillSchemaType, '_id' | 'orderId' | 'type' | 'metadata' | 'teamId'>
) => {
  const teamId = bill.teamId;
  const grantPoints = bill.metadata.totalPoints ?? 0;

  if (bill.type === BillTypeEnum.standSubPlan) {
    const level = bill.metadata.standSubLevel as `${StandardSubLevelEnum}`;
    const subMode = (bill.metadata.subMode ?? SubModeEnum.month) as `${SubModeEnum}`;
    const monthCount = subModeMap[subMode].durationMonth;
    const now = new Date();

    const plans = await MongoTeamSub.find({ teamId, type: SubTypeEnum.standard }).lean();
    const activePlan = sortStandPlans(
      plans.filter((plan) => !dayjs(plan.expiredTime).isBefore(now))
    )[0];

    if (activePlan) {
      // 续费/升降级：在同一记录上延期并叠加积分，保留剩余积分
      const baseTime = dayjs(activePlan.expiredTime).isBefore(now)
        ? now
        : new Date(activePlan.expiredTime);
      await MongoTeamSub.updateOne(
        { _id: activePlan._id },
        {
          $set: {
            currentSubLevel: level,
            nextSubLevel: level,
            currentMode: subMode,
            nextMode: subMode,
            expiredTime: addMonths(baseTime, monthCount)
          },
          $inc: { totalPoints: grantPoints, surplusPoints: grantPoints }
        }
      );
    } else {
      // 新购：新建订阅记录（free 记录保留，付费记录按等级权重优先生效）
      await MongoTeamSub.create([
        {
          teamId,
          type: SubTypeEnum.standard,
          startTime: now,
          expiredTime: addMonths(now, monthCount),
          currentMode: subMode,
          nextMode: subMode,
          currentSubLevel: level,
          nextSubLevel: level,
          totalPoints: grantPoints,
          surplusPoints: grantPoints
        }
      ]);
    }
  } else if (bill.type === BillTypeEnum.extraPoints) {
    const monthCount = bill.metadata.month ?? 1;
    const now = new Date();
    await MongoTeamSub.create([
      {
        teamId,
        type: SubTypeEnum.extraPoints,
        startTime: now,
        expiredTime: addMonths(now, monthCount),
        totalPoints: grantPoints,
        surplusPoints: grantPoints
      }
    ]);
  }

  await clearTeamPlanCache(String(teamId));
};

/**
 * 取消未支付订单。
 */
export const cancelAlipayBill = async ({ teamId, billId }: { teamId: string; billId: string }) => {
  const bill = await MongoBill.findOne({ _id: billId, teamId }).lean();
  if (!bill) {
    throw new Error('订单不存在或无权操作');
  }
  if (bill.status !== BillStatusEnum.NOTPAY) {
    throw new Error('仅未支付的订单可以取消');
  }
  await MongoBill.updateOne(
    { _id: bill._id, status: BillStatusEnum.NOTPAY },
    { $set: { status: BillStatusEnum.CLOSED } }
  );
};

/**
 * 订单分页列表（账户中心订单页）。
 */
export const getBillList = async ({
  teamId,
  type,
  offset = 0,
  pageSize = 20
}: {
  teamId: string;
  type?: `${BillTypeEnum}`;
  offset?: number;
  pageSize?: number;
}) => {
  const query = type ? { teamId, type } : { teamId };
  const [list, total] = await Promise.all([
    MongoBill.find(query)
      .sort({ createTime: -1 })
      .skip(offset)
      .limit(pageSize)
      .lean(),
    MongoBill.countDocuments(query)
  ]);
  return { list, total };
};
