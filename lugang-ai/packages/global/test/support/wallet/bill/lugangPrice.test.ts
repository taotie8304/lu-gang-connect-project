// 鲁港通 - 计价工具单测（N4 在线支付）
import { describe, expect, it } from 'vitest';
import {
  getStandardPlanReadPrice,
  getStandardPlanGrantPoints,
  getExtraPointsPackage,
  getExtraPointsGrantPoints
} from '@fastgpt/global/support/wallet/bill/lugangPrice';
import {
  StandardSubLevelEnum,
  SubModeEnum
} from '@fastgpt/global/support/wallet/sub/constants';
import type { SubPlanType } from '@fastgpt/global/support/wallet/sub/type';

const subPlans: SubPlanType = {
  standard: {
    [StandardSubLevelEnum.free]: {
      price: 0,
      totalPoints: 100,
      maxTeamMember: 5,
      maxAppAmount: 10,
      maxDatasetAmount: 10,
      maxDatasetSize: 1,
      chatHistoryStoreDuration: 30
    },
    [StandardSubLevelEnum.basic]: {
      price: 99,
      totalPoints: 50000,
      annualBonusPoints: 5000,
      maxTeamMember: 10,
      maxAppAmount: 20,
      maxDatasetAmount: 20,
      maxDatasetSize: 10,
      chatHistoryStoreDuration: 90
    }
  },
  extraPoints: {
    packages: [
      { points: 5000, month: 1, price: 10, activityBonusPoints: 500 },
      { points: 50000, month: 12, price: 90 }
    ]
  }
};

describe('getStandardPlanReadPrice', () => {
  it('月付按 1 个月计价', () => {
    expect(
      getStandardPlanReadPrice({
        subPlans,
        level: StandardSubLevelEnum.basic,
        subMode: SubModeEnum.month
      })
    ).toBe(99);
  });

  it('年付按 10 个月计价', () => {
    expect(
      getStandardPlanReadPrice({
        subPlans,
        level: StandardSubLevelEnum.basic,
        subMode: SubModeEnum.year
      })
    ).toBe(990);
  });

  it('套餐未配置返回 null', () => {
    expect(
      getStandardPlanReadPrice({
        subPlans,
        level: StandardSubLevelEnum.custom,
        subMode: SubModeEnum.month
      })
    ).toBeNull();
  });
});

describe('getStandardPlanGrantPoints', () => {
  it('月付发放基础积分', () => {
    expect(
      getStandardPlanGrantPoints({
        subPlans,
        level: StandardSubLevelEnum.basic,
        subMode: SubModeEnum.month
      })
    ).toBe(50000);
  });

  it('年付含年度赠送积分', () => {
    expect(
      getStandardPlanGrantPoints({
        subPlans,
        level: StandardSubLevelEnum.basic,
        subMode: SubModeEnum.year
      })
    ).toBe(55000);
  });
});

describe('getExtraPointsPackage', () => {
  it('按积分与月数匹配配置包', () => {
    const pkg = getExtraPointsPackage({ subPlans, points: 5000, month: 1 });
    expect(pkg?.price).toBe(10);
  });

  it('匹配不到返回 null', () => {
    expect(getExtraPointsPackage({ subPlans, points: 123, month: 1 })).toBeNull();
  });
});

describe('getExtraPointsGrantPoints', () => {
  it('含活动赠送积分', () => {
    expect(getExtraPointsGrantPoints({ points: 5000, month: 1, price: 10, activityBonusPoints: 500 })).toBe(5500);
  });

  it('无活动赠送时发放基础积分', () => {
    expect(getExtraPointsGrantPoints({ points: 50000, month: 12, price: 90 })).toBe(50000);
  });
});
