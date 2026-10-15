// 鲁港通 - 每日打卡结算（Credits 改革批 2）：
// 按北京时间自然日一人一次，连签第 7 天及其倍数额外 +10（当天共 15）；奖励复用积分入账函数即时到账。
import { MongoUserCheckins } from './schema';
import { incrUserPoints } from '../points/controller';
import type {
  UserCheckinSettleResponse,
  UserCheckinStatusResponse
} from '@fastgpt/global/support/wallet/checkin/type';

/** 每日基础奖励（Credits） */
const DAILY_REWARD = 5;
/** 连签周期内额外奖励（第 7 天当天共 15） */
const STREAK_BONUS = 10;
/** 连签周期天数 */
const STREAK_CYCLE = 7;

const ALREADY_CHECKED_MESSAGE = '今日已打卡，明天再来即可继续累积连签';

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 求某时刻对应的北京时间自然日（YYYY-MM-DD；固定 UTC+8，无夏令时） */
export const getBeijingDate = (date: Date): string => {
  const shifted = new Date(date.getTime() + BEIJING_OFFSET_MS);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${month}-${day}`;
};

/** 连续打卡奖励：基础 5，连签第 7 天及其倍数共 15 */
export const calcCheckinReward = (streak: number) =>
  streak % STREAK_CYCLE === 0 ? DAILY_REWARD + STREAK_BONUS : DAILY_REWARD;

/** 打卡状态查询（驱动账户中心打卡卡片） */
export const getCheckinStatus = async ({
  tmbId,
  now = new Date()
}: {
  tmbId: string;
  now?: Date;
}): Promise<UserCheckinStatusResponse> => {
  const doc = await MongoUserCheckins.findOne({ tmbId }).lean();
  const today = getBeijingDate(now);
  const yesterday = getBeijingDate(new Date(now.getTime() - DAY_MS));

  if (doc?.lastCheckinDate === today) {
    // 今日已打卡：预告明日续签后的奖励
    return {
      checkedToday: true,
      streak: doc.streak,
      nextRewardPreview: calcCheckinReward(doc.streak + 1)
    };
  }
  if (doc?.lastCheckinDate === yesterday) {
    return {
      checkedToday: false,
      streak: doc.streak,
      nextRewardPreview: calcCheckinReward(doc.streak + 1)
    };
  }
  // 从未打卡或已断签：连签从 0 展示，下一次从 1 起算
  return { checkedToday: false, streak: 0, nextRewardPreview: calcCheckinReward(1) };
};

/** 打卡结算：条件原子更新防并发双发，成功后即时入账 */
export const checkin = async ({
  teamId,
  tmbId,
  now = new Date()
}: {
  teamId: string;
  tmbId: string;
  now?: Date;
}): Promise<UserCheckinSettleResponse> => {
  const today = getBeijingDate(now);
  const yesterday = getBeijingDate(new Date(now.getTime() - DAY_MS));

  const existing = await MongoUserCheckins.findOne({ tmbId }).lean();
  if (existing?.lastCheckinDate === today) {
    throw new Error(ALREADY_CHECKED_MESSAGE);
  }

  const streak = existing?.lastCheckinDate === yesterday ? existing.streak + 1 : 1;
  const reward = calcCheckinReward(streak);

  try {
    // 仅当记录不存在或最后打卡日不是今天才计数（并发时后到者不匹配条件，撞唯一索引被拒）
    await MongoUserCheckins.updateOne(
      { tmbId, lastCheckinDate: { $ne: today } },
      {
        $set: { teamId, lastCheckinDate: today, streak, lastReward: reward },
        $inc: { totalCheckins: 1 }
      },
      { upsert: true }
    );
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      throw new Error(ALREADY_CHECKED_MESSAGE);
    }
    throw error;
  }

  await incrUserPoints({ teamId, tmbId, points: reward });

  return { streak, reward };
};
