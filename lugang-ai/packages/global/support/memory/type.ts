// 鲁港通 - 智能体记忆：全局类型定义
export type UserMemorySourceEnum = 'manual' | 'auto';

export type UserMemoryItemType = {
  id: string;
  content: string;
  enabled: boolean;
  source: UserMemorySourceEnum;
  createdAt: string;
  updatedAt: string;
};

export type UserMemoryCandidateStatusEnum = 'pending' | 'adopted' | 'ignored';

export type UserMemoryCandidateType = {
  id: string;
  content: string;
  createdAt: string;
};

export type UserMemoryListResponseType = {
  list: UserMemoryItemType[];
  /** 记忆功能总开关（关闭后不再注入对话） */
  enabled: boolean;
  /** 自动提取开关（关闭后不再从对话中提取候选记忆） */
  autoExtractEnabled: boolean;
  /** 待用户确认的候选记忆 */
  pending: UserMemoryCandidateType[];
  maxCount: number;
  maxContentLength: number;
};

export type UserMemoryCandidateAdoptPropsType = {
  id: string;
  /** 确认前允许用户微调候选内容 */
  content?: string;
};

export type UserMemoryCandidateIgnorePropsType = {
  id: string;
};

export type UserMemorySavePropsType = {
  id?: string;
  content: string;
};

/** 记忆表（user_memories） */
export type UserMemorySchemaType = {
  _id: string;
  teamId: string;
  tmbId: string;
  content: string;
  enabled: boolean;
  source: UserMemorySourceEnum;
  createTime: Date;
  updateTime: Date;
};

/** 记忆设置表（user_memory_settings） */
export type UserMemorySettingSchemaType = {
  _id: string;
  teamId: string;
  tmbId: string;
  enabled: boolean;
  autoExtractEnabled: boolean;
  createTime: Date;
  updateTime: Date;
};

/** 候选记忆表（user_memory_candidates） */
export type UserMemoryCandidateSchemaType = {
  _id: string;
  teamId: string;
  tmbId: string;
  content: string;
  status: UserMemoryCandidateStatusEnum;
  chatId?: string;
  /** 过期时间：仅 pending 状态有意义，过期后不再展示与去重 */
  expireAt: Date;
  createTime: Date;
  updateTime: Date;
};

/** 提取尝试日志表（user_memory_extraction_logs），仅用于每日频控计数 */
export type UserMemoryExtractionLogSchemaType = {
  _id: string;
  teamId: string;
  tmbId: string;
  chatId?: string;
  /** 本次落库的候选条数 */
  createdCount: number;
  createTime: Date;
};
