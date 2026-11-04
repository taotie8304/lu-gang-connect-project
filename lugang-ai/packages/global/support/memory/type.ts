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

export type UserMemoryListResponseType = {
  list: UserMemoryItemType[];
  /** 记忆功能总开关（关闭后不再注入对话） */
  enabled: boolean;
  maxCount: number;
  maxContentLength: number;
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
  createTime: Date;
  updateTime: Date;
};
