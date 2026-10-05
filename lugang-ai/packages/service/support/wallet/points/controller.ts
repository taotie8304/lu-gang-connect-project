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

/** 充值/赠送入账（累计获得与余额同步增加） */
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

  const freePoints = getFreePointsAmount();
  await MongoUserPoints.updateOne(
    { tmbId },
    {
      $setOnInsert: {
        teamId,
        tmbId,
        totalPoints: freePoints,
        surplusPoints: freePoints,
        currentSubLevel: StandardSubLevelEnum.free
      },
      $inc: { totalPoints: points, surplusPoints: points }
    },
    { upsert: true, session }
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
