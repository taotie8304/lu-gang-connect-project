import { LUGANG_POINTS_PER_DEEP_QA } from '@fastgpt/global/support/wallet/bill/lugangPrice';

export type ExtraPointsCardDisplay = {
  recommended: boolean;
  deepQaCount: number;
  unitPrice: string;
};

/**
 * 计算额外 Credits 卡片的展示口径。
 * 鲁港通 - 三档积分包时推荐中间一档（即 5,000 Credits 档）；深度问答次数按 40 Credits/次估算并向下取整，
 * 单价保留两位小数，异常数据（0 积分）按 0 处理，避免除零产生 NaN。
 */
export const buildExtraPointsCardDisplay = ({
  index,
  packageCount,
  points,
  price
}: {
  index: number;
  packageCount: number;
  points: number;
  price: number;
}): ExtraPointsCardDisplay => {
  return {
    recommended: packageCount === 3 && index === 1,
    deepQaCount: points > 0 ? Math.floor(points / LUGANG_POINTS_PER_DEEP_QA) : 0,
    unitPrice: points > 0 ? (price / points).toFixed(2) : '0.00'
  };
};
