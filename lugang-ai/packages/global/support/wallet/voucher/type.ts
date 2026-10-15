// 鲁港通 - 代金券账户类型（Credits 改革批 3）：抵扣订单应付现金，单次订单最多一张、可部分使用、不设有效期
import type { VoucherSourceEnum } from './constants';

/** 代金券使用记录（支付成功时定案写入） */
export type VoucherUsedBillType = {
  /** 使用该券的商户订单号 */
  billId: string;
  /** 抵扣金额（内部单位：元 × PRICE_SCALE） */
  deducted: number;
  at: Date;
};

export type UserVoucherSchemaType = {
  _id: string;
  teamId: string;
  tmbId: string;
  /** 初始面额（内部单位：元 × PRICE_SCALE，避免换算误差） */
  amount: number;
  /** 剩余可抵扣（内部单位） */
  remainingAmount: number;
  /** 来源：管理员发放 / 注册赠礼 */
  source: `${VoucherSourceEnum}`;
  /** 发放人（管理员 tmbId；注册赠礼为 system） */
  issuedBy: string;
  /** 管理员备注（可选） */
  note: string;
  /** 被未完成订单占用的商户订单号（空 = 未占用；占用期间不可用于新订单） */
  lockedBillId: string;
  /** 使用记录 */
  usedBills: VoucherUsedBillType[];
  createTime: Date;
  updateTime: Date;
};

/** 代金券面板条目（前端展示口径：金额已换算为元） */
export type VoucherItemType = {
  _id: string;
  /** 面额（元） */
  amount: number;
  /** 剩余可抵扣（元） */
  remainingAmount: number;
  source: `${VoucherSourceEnum}`;
  note: string;
  /** 是否被一笔未完成订单占用（占用期间不可用于新订单） */
  isLocked: boolean;
  createTime: Date;
};

/** 管理员发放代金券请求（批量：对选中的每名成员各发一张） */
export type IssueVoucherProps = {
  /** 目标成员 tmbId 列表（单选即一项） */
  tmbIds: string[];
  /** 面额（元，最多两位小数） */
  amountYuan: number;
  /** 备注（可选，如发放原因） */
  note?: string;
};

/** 管理员发放代金券响应 */
export type IssueVoucherResponse = {
  /** 实际发放张数（= 选中成员数） */
  count: number;
};
