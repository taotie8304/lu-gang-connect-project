// 鲁港通 - 套餐权益门槛：桌面 AI（控制内置浏览器与操作文件）仅进阶及以上且未过期的账号可用
import { isDesktopAiPlanLevel } from '@fastgpt/global/support/wallet/sub/constants';

export { isDesktopAiPlanLevel };

export type PlanEntitlementAccount = {
  currentSubLevel?: string | null;
  expiredTime?: Date | number | string | null;
};

/** 到期时间缺失或已过期都按无权益处理，避免脏数据长期放行 */
export const isDesktopAiPlanActive = (
  account: PlanEntitlementAccount | null | undefined,
  now: Date | number = Date.now()
): boolean => {
  if (!account || !isDesktopAiPlanLevel(account.currentSubLevel)) return false;
  if (!account.expiredTime) return false;
  const expiresAt = new Date(account.expiredTime).getTime();
  return Number.isFinite(expiresAt) && expiresAt > new Date(now).getTime();
};

type PlanEntitlementAccountReader = (
  tmbId: string
) => Promise<PlanEntitlementAccount | null | undefined>;

const readUserPointsAccount: PlanEntitlementAccountReader = async (tmbId) => {
  // 延迟加载模型，避免仅做纯逻辑判定的调用方在模块加载期就连 Mongo
  const { MongoUserPoints } = await import('./schema');
  return MongoUserPoints.findOne({ tmbId }).select('currentSubLevel expiredTime').lean();
};

/** 读取个人积分账户判断当前是否享有桌面 AI 能力；账号不存在（未初始化）按无权益处理 */
export const hasDesktopAiPlanEntitlement = async (
  { tmbId }: { tmbId?: string },
  {
    readAccount = readUserPointsAccount,
    now = Date.now()
  }: { readAccount?: PlanEntitlementAccountReader; now?: Date | number } = {}
): Promise<boolean> => {
  if (!tmbId) return false;
  const account = await readAccount(tmbId);
  return isDesktopAiPlanActive(account, now);
};
