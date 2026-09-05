// 鲁港通 - 支付订单计价工具（N4 在线支付，支付宝当面付）
// 计价规则与前端价格页展示口径一致：标准套餐年付按 10 个月计价；积分包按配置包价格
import type { SubPlanType } from '../sub/type';
import { SubModeEnum, StandardSubLevelEnum } from '../sub/constants';
import type { PointsPackageItem } from '../sub/type';

/**
 * 计算标准套餐应付金额（元）。
 * 年付按 10 个月计价（subModeMap.year.payMonth = 10），月付按 1 个月。
 * @returns 套餐未配置时返回 null
 */
export const getStandardPlanReadPrice = ({
  subPlans,
  level,
  subMode
}: {
  subPlans?: SubPlanType;
  level: `${StandardSubLevelEnum}`;
  subMode: `${SubModeEnum}`;
}): number | null => {
  const plan = subPlans?.standard?.[level];
  if (!plan) return null;

  const payMonth = subMode === SubModeEnum.year ? 10 : 1;
  return plan.price * payMonth;
};

/**
 * 计算标准套餐到账应发放的积分（含年付赠送）。
 * @returns 套餐未配置时返回 null
 */
export const getStandardPlanGrantPoints = ({
  subPlans,
  level,
  subMode
}: {
  subPlans?: SubPlanType;
  level: `${StandardSubLevelEnum}`;
  subMode: `${SubModeEnum}`;
}): number | null => {
  const plan = subPlans?.standard?.[level];
  if (!plan) return null;

  const annualBonus = subMode === SubModeEnum.year ? plan.annualBonusPoints ?? 0 : 0;
  return plan.totalPoints + annualBonus;
};

/**
 * 按「积分数量 + 月数」匹配系统配置的积分套餐包。
 * 前端购买页只允许从配置包中选择，因此匹配不到视为非法请求。
 */
export const getExtraPointsPackage = ({
  subPlans,
  points,
  month
}: {
  subPlans?: SubPlanType;
  points: number;
  month: number;
}): PointsPackageItem | null => {
  const pkg = subPlans?.extraPoints?.packages?.find(
    (item: PointsPackageItem) => item.points === points && item.month === month
  );
  return pkg ?? null;
};

/**
 * 计算积分套餐包到账应发放的积分（含活动赠送）。
 */
export const getExtraPointsGrantPoints = (pkg: PointsPackageItem): number => {
  return pkg.points + (pkg.activityBonusPoints ?? 0);
};
