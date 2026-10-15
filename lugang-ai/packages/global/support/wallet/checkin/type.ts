// 鲁港通 - 每日打卡类型（Credits 改革批 2）：按北京时间自然日一人一次，连签第 7 天额外奖励
export type UserCheckinSchemaType = {
  _id: string;
  teamId: string;
  tmbId: string;

  /** 当前连续打卡天数（断签后重新从 1 起算） */
  streak: number;
  /** 累计打卡次数（展示用） */
  totalCheckins: number;
  /** 最后打卡日（北京时间自然日，YYYY-MM-DD） */
  lastCheckinDate: string;
  /** 最近一次打卡奖励（Credits，展示/排查用） */
  lastReward: number;

  createTime: Date;
  updateTime: Date;
};

/** 打卡状态查询响应（账户中心打卡卡片数据源） */
export type UserCheckinStatusResponse = {
  /** 今日是否已打卡 */
  checkedToday: boolean;
  /** 当前连续打卡天数（断签展示为 0） */
  streak: number;
  /** 下一次打卡可得 Credits 预告（连签第 7 天及其倍数为 15） */
  nextRewardPreview: number;
};

/** 打卡结算响应 */
export type UserCheckinSettleResponse = {
  /** 结算后的连续打卡天数 */
  streak: number;
  /** 本次到账 Credits */
  reward: number;
};
