// 鲁港通 - 个人积分账户类型：每名团队成员一条账户，取代团队共享积分池作为扣费依据
import type { StandardSubLevelEnum, SubModeEnum } from '../sub/constants';

export type UserPointsSchemaType = {
  _id: string;
  teamId: string;
  tmbId: string;

  /** 累计获得积分（注册赠送 + 购买入账） */
  totalPoints: number;
  /** 当前可用积分余额（对话消耗实时扣减，可为负，余额 <= 0 时拦截下一次使用） */
  surplusPoints: number;

  /** 当前套餐档位（展示用，不参与扣费判定） */
  currentSubLevel: `${StandardSubLevelEnum}`;
  /** 最近一次购买周期 */
  currentMode?: `${SubModeEnum}`;
  /** 套餐到期时间（展示用，积分不随到期清零） */
  expiredTime?: Date;

  createTime: Date;
  updateTime: Date;
};

/** 个人积分账户面板详情（账户中心「我的积分」卡片数据源） */
export type UserPointsDetailType = {
  /** 当前可用积分余额（可为负，余额 <= 0 时无法发起对话） */
  surplusPoints: number;
  /** 累计获得积分（注册赠送 + 购买入账） */
  totalPoints: number;
  /** 当前套餐档位 */
  currentSubLevel: `${StandardSubLevelEnum}`;
  /** 最近一次购买周期 */
  currentMode?: `${SubModeEnum}`;
  /** 套餐到期时间（JSON 传输为 ISO 字符串，前端按本地时区展示） */
  expiredTime?: Date;
};
