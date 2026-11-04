// 鲁港通 - 智能体记忆业务逻辑（资料卡增删改查 + 总开关 + 候选记忆 + 对话注入文本）
import {
  UserMemoryMaxContentLength,
  UserMemoryMaxCount
} from '@fastgpt/global/support/memory/constants';
import { buildUserMemoryPrompt } from '@fastgpt/global/support/memory/utils';
import type {
  UserMemoryCandidateType,
  UserMemoryItemType,
  UserMemoryListResponseType
} from '@fastgpt/global/support/memory/type';
import {
  MongoUserMemory,
  MongoUserMemoryCandidate,
  MongoUserMemorySetting
} from './schema';

const PENDING_CANDIDATE_LIST_LIMIT = 20;

const formatItem = (memory: any): UserMemoryItemType => ({
  id: String(memory._id),
  content: memory.content,
  enabled: memory.enabled !== false,
  source: memory.source ?? 'manual',
  createdAt: new Date(memory.createTime).toISOString(),
  updatedAt: new Date(memory.updateTime).toISOString()
});

const formatCandidate = (candidate: any): UserMemoryCandidateType => ({
  id: String(candidate._id),
  content: candidate.content,
  createdAt: new Date(candidate.createTime).toISOString()
});

/** 归一化用户输入：去首尾空白并校验长度 */
const normalizeContent = (content: string) => {
  const text = (content ?? '').trim();
  if (!text) return Promise.reject('记忆内容不能为空');
  if (text.length > UserMemoryMaxContentLength) {
    return Promise.reject(`记忆内容最多 ${UserMemoryMaxContentLength} 字，请精简后再保存`);
  }
  return text;
};

export const listUserMemories = async ({
  teamId,
  tmbId
}: {
  teamId: string;
  tmbId: string;
}): Promise<UserMemoryListResponseType> => {
  const now = new Date();
  const [list, setting, pending] = await Promise.all([
    MongoUserMemory.find({ teamId, tmbId }).sort({ createTime: -1, _id: -1 }).lean(),
    MongoUserMemorySetting.findOne({ teamId, tmbId })
      .select('enabled autoExtractEnabled')
      .lean(),
    MongoUserMemoryCandidate.find({ teamId, tmbId, status: 'pending', expireAt: { $gt: now } })
      .sort({ createTime: -1, _id: -1 })
      .limit(PENDING_CANDIDATE_LIST_LIMIT)
      .lean()
  ]);

  return {
    list: list.map(formatItem),
    enabled: setting?.enabled !== false,
    autoExtractEnabled: setting?.autoExtractEnabled !== false,
    pending: pending.map(formatCandidate),
    maxCount: UserMemoryMaxCount,
    maxContentLength: UserMemoryMaxContentLength
  };
};

export const saveUserMemory = async ({
  teamId,
  tmbId,
  id,
  content
}: {
  teamId: string;
  tmbId: string;
  id?: string;
  content: string;
}): Promise<UserMemoryItemType> => {
  const text = await normalizeContent(content);

  if (id) {
    const updated = await MongoUserMemory.findOneAndUpdate(
      { _id: id, teamId, tmbId },
      { $set: { content: text } },
      { new: true }
    ).lean();
    if (!updated) return Promise.reject('记忆不存在或已被删除');
    return formatItem(updated);
  }

  const count = await MongoUserMemory.countDocuments({ teamId, tmbId });
  if (count >= UserMemoryMaxCount) {
    return Promise.reject(`最多保存 ${UserMemoryMaxCount} 条记忆，请先删除部分后再添加`);
  }

  const created = await MongoUserMemory.create({
    teamId,
    tmbId,
    content: text,
    enabled: true,
    source: 'manual'
  });
  return formatItem(created.toObject());
};

export const updateUserMemoryEnabled = async ({
  teamId,
  tmbId,
  id,
  enabled
}: {
  teamId: string;
  tmbId: string;
  id: string;
  enabled: boolean;
}): Promise<UserMemoryItemType> => {
  const updated = await MongoUserMemory.findOneAndUpdate(
    { _id: id, teamId, tmbId },
    { $set: { enabled } },
    { new: true }
  ).lean();
  if (!updated) return Promise.reject('记忆不存在或已被删除');
  return formatItem(updated);
};

export const deleteUserMemory = async ({
  teamId,
  tmbId,
  id
}: {
  teamId: string;
  tmbId: string;
  id: string;
}) => {
  const deleted = await MongoUserMemory.findOneAndDelete({ _id: id, teamId, tmbId }).lean();
  if (!deleted) return Promise.reject('记忆不存在或已被删除');
};

export const clearUserMemories = async ({
  teamId,
  tmbId
}: {
  teamId: string;
  tmbId: string;
}) => {
  await Promise.all([
    MongoUserMemory.deleteMany({ teamId, tmbId }),
    MongoUserMemoryCandidate.deleteMany({ teamId, tmbId })
  ]);
};

/** 记忆总开关：关闭后对话不再注入任何记忆 */
export const setUserMemoryEnabled = async ({
  teamId,
  tmbId,
  enabled
}: {
  teamId: string;
  tmbId: string;
  enabled: boolean;
}) => {
  await MongoUserMemorySetting.findOneAndUpdate(
    { teamId, tmbId },
    { $set: { enabled } },
    { upsert: true, new: true }
  ).lean();
};

/** 对话注入：总开关开启时取最新启用的记忆生成 systemPrompt 附加块 */
export const getUserMemoryPrompt = async ({
  teamId,
  tmbId
}: {
  teamId: string;
  tmbId: string;
}): Promise<string> => {
  const setting = await MongoUserMemorySetting.findOne({ teamId, tmbId })
    .select('enabled')
    .lean();
  if (setting?.enabled === false) return '';

  const list = await MongoUserMemory.find({ teamId, tmbId, enabled: true })
    .sort({ createTime: -1, _id: -1 })
    .limit(UserMemoryMaxCount)
    .select('content enabled')
    .lean();

  return buildUserMemoryPrompt(list);
};

/** 自动提取开关：关闭后不再从对话中提取候选记忆 */
export const setUserMemoryAutoExtractEnabled = async ({
  teamId,
  tmbId,
  enabled
}: {
  teamId: string;
  tmbId: string;
  enabled: boolean;
}) => {
  await MongoUserMemorySetting.findOneAndUpdate(
    { teamId, tmbId },
    { $set: { autoExtractEnabled: enabled } },
    { upsert: true, new: true }
  ).lean();
};

/** 记忆相关开关状态：读取失败时按默认开启处理 */
export const getUserMemorySettingStatus = async ({
  teamId,
  tmbId
}: {
  teamId: string;
  tmbId: string;
}) => {
  const setting = await MongoUserMemorySetting.findOne({ teamId, tmbId })
    .select('enabled autoExtractEnabled')
    .lean();

  return {
    enabled: setting?.enabled !== false,
    autoExtractEnabled: setting?.autoExtractEnabled !== false
  };
};

/** 即将写入提示词的候选内容（待确认），用于提取去重 */
export const listPendingCandidateContents = async ({
  teamId,
  tmbId
}: {
  teamId: string;
  tmbId: string;
}) => {
  const list = await MongoUserMemoryCandidate.find({
    teamId,
    tmbId,
    status: 'pending',
    expireAt: { $gt: new Date() }
  })
    .select('content')
    .lean();
  return list.map((item) => item.content);
};

/** 待确认候选列表（我的记忆页使用） */
export const listPendingMemoryCandidates = async ({
  teamId,
  tmbId
}: {
  teamId: string;
  tmbId: string;
}) => {
  const list = await MongoUserMemoryCandidate.find({
    teamId,
    tmbId,
    status: 'pending',
    expireAt: { $gt: new Date() }
  })
    .sort({ createTime: -1, _id: -1 })
    .limit(PENDING_CANDIDATE_LIST_LIMIT)
    .lean();
  return list.map(formatCandidate);
};

/** 某次对话产生的待确认候选（对话轻提示使用） */
export const listPendingMemoryCandidatesByChat = async ({
  teamId,
  tmbId,
  chatId
}: {
  teamId: string;
  tmbId: string;
  chatId: string;
}) => {
  const list = await MongoUserMemoryCandidate.find({
    teamId,
    tmbId,
    chatId,
    status: 'pending',
    expireAt: { $gt: new Date() }
  })
    .sort({ createTime: -1, _id: -1 })
    .limit(PENDING_CANDIDATE_LIST_LIMIT)
    .lean();
  return list.map(formatCandidate);
};

/** 确认候选：支持用户微调内容后写入正式记忆 */
export const adoptMemoryCandidate = async ({
  teamId,
  tmbId,
  id,
  content
}: {
  teamId: string;
  tmbId: string;
  id: string;
  content?: string;
}): Promise<UserMemoryItemType> => {
  const candidate = await MongoUserMemoryCandidate.findOne({
    _id: id,
    teamId,
    tmbId,
    status: 'pending'
  }).lean();
  if (!candidate) return Promise.reject('候选记忆不存在或已处理');

  const text = await normalizeContent(content ?? candidate.content);

  const count = await MongoUserMemory.countDocuments({ teamId, tmbId });
  if (count >= UserMemoryMaxCount) {
    return Promise.reject(`最多保存 ${UserMemoryMaxCount} 条记忆，请先删除部分后再添加`);
  }

  const created = await MongoUserMemory.create({
    teamId,
    tmbId,
    content: text,
    enabled: true,
    source: 'auto'
  });
  await MongoUserMemoryCandidate.updateOne(
    { _id: id, teamId, tmbId },
    { $set: { status: 'adopted' } }
  );

  return formatItem(created.toObject());
};

/** 忽略候选：30 天内不再重复提出 */
export const ignoreMemoryCandidate = async ({
  teamId,
  tmbId,
  id
}: {
  teamId: string;
  tmbId: string;
  id: string;
}) => {
  const updated = await MongoUserMemoryCandidate.findOneAndUpdate(
    { _id: id, teamId, tmbId, status: 'pending' },
    { $set: { status: 'ignored' } }
  ).lean();
  if (!updated) return Promise.reject('候选记忆不存在或已处理');
};
