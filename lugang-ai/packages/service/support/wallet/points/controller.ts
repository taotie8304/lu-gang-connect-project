// 鲁港通 - 个人积分账户核心引擎（N4 支付配套）：
// 注册赠送、购买入账、对话按次扣费共用同一账户；余额 <= 0 时由 checkUserAIPoints 拦截下一次使用。
import { MongoUserPoints } from './schema';
import { StandardSubLevelEnum, subModeMap } from '@fastgpt/global/support/wallet/sub/constants';
import type { SubModeEnum } from '@fastgpt/global/support/wallet/sub/constants';
import type { ClientSession } from '../../../common/mongo';
import { addMonths } from 'date-fns';
import dayjs from 'dayjs';

/** 免费档注册赠送额度（与价格页免费版展示口径一致） */
export const getFreePointsAmount = () =>
  global.subPlans?.standard?.[StandardSubLevelEnum.free]?.totalPoints ?? 300;

/**
 * 读取用户积分账户；不存在时按免费档赠送额度初始化。
 * 幂等：存量用户首次触发（对话/面板）时自动补发免费积分，无需单独迁移脚本。
 */
export const getOrInitUserPoints = async ({
  teamId,
  tmbId,
  session
}: {
  teamId: string;
  tmbId: string;
  session?: ClientSession;
}) => {
  const existing = await MongoUserPoints.findOne({ tmbId })
    .session(session ?? null)
    .lean();
  if (existing) return existing;

  const freePoints = getFreePointsAmount();
  try {
    const [created] = await MongoUserPoints.create(
      [
        {
          teamId,
          tmbId,
          totalPoints: freePoints,
          surplusPoints: freePoints,
          currentSubLevel: StandardSubLevelEnum.free
        }
      ],
      { session, ordered: true }
    );
    return created.toObject();
  } catch (error) {
    // 并发初始化撞唯一索引：回读已创建的账户
    const fallback = await MongoUserPoints.findOne({ tmbId })
      .session(session ?? null)
      .lean();
    if (fallback) return fallback;
    throw error;
  }
};

/** 充值/赠送入账（累计获得与余额同步增加；先幂等初始化账户再纯增量更新，避免同路径双算子冲突） */
export const incrUserPoints = async ({
  teamId,
  tmbId,
  points,
  session
}: {
  teamId: string;
  tmbId: string;
  points: number;
  session?: ClientSession;
}) => {
  if (!points) return;

  await getOrInitUserPoints({ teamId, tmbId, session });
  await MongoUserPoints.updateOne(
    { tmbId },
    { $inc: { totalPoints: points, surplusPoints: points } },
    { session }
  );
};

/** 套餐购买入账：积分递增，档位更新，到期时间按「在有效期上顺延」滚动 */
export const grantUserPlan = async ({
  teamId,
  tmbId,
  level,
  subMode,
  grantPoints
}: {
  teamId: string;
  tmbId: string;
  level: `${StandardSubLevelEnum}`;
  subMode: `${SubModeEnum}`;
  grantPoints: number;
}) => {
  const account = await getOrInitUserPoints({ teamId, tmbId });
  const now = new Date();
  const baseTime =
    account?.expiredTime && dayjs(account.expiredTime).isAfter(now)
      ? new Date(account.expiredTime)
      : now;

  await MongoUserPoints.updateOne(
    { tmbId },
    {
      $set: {
        currentSubLevel: level,
        currentMode: subMode,
        expiredTime: addMonths(baseTime, subModeMap[subMode].durationMonth)
      },
      $inc: { totalPoints: grantPoints, surplusPoints: grantPoints }
    }
  );
};

/**
 * 管理员调整 Credits：正数增加（累计获得与余额同步递增），负数扣减（只动余额，条件更新保证不超扣）。
 * 扣减失败即余额不足，返回可操作提示；账户未初始化时先按免费档建户再调整。
 */
export const adjustUserPointsByAdmin = async ({
  teamId,
  tmbId,
  delta
}: {
  teamId: string;
  tmbId: string;
  /** 调整量：正数增加、负数扣减（非零整数） */
  delta: number;
}) => {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error('Credits 调整数量必须为非零整数');
  }

  await getOrInitUserPoints({ teamId, tmbId });

  if (delta > 0) {
    await MongoUserPoints.updateOne(
      { tmbId },
      { $inc: { totalPoints: delta, surplusPoints: delta } }
    );
    return;
  }

  const deduct = -delta;
  const updated = await MongoUserPoints.updateOne(
    { tmbId, surplusPoints: { $gte: deduct } },
    { $inc: { surplusPoints: -deduct } }
  );
  if (updated.modifiedCount !== 1) {
    throw new Error('扣减数量不能超过用户当前 Credits 余额，请调整后重试');
  }
};

/** 对话按次扣费（允许透支为负，下次发起对话前由门槛拦截） */
export const deductUserPoints = async ({
  tmbId,
  points
}: {
  tmbId: string;
  points: number;
}) => {
  if (!points) return;
  await MongoUserPoints.updateOne({ tmbId }, { $inc: { surplusPoints: -points } });
};
