// 鲁港通 - 智能体记忆业务逻辑（资料卡增删改查 + 总开关 + 对话注入文本）
import {
  UserMemoryMaxContentLength,
  UserMemoryMaxCount
} from '@fastgpt/global/support/memory/constants';
import { buildUserMemoryPrompt } from '@fastgpt/global/support/memory/utils';
import type {
  UserMemoryItemType,
  UserMemoryListResponseType
} from '@fastgpt/global/support/memory/type';
import { MongoUserMemory, MongoUserMemorySetting } from './schema';

const formatItem = (memory: any): UserMemoryItemType => ({
  id: String(memory._id),
  content: memory.content,
  enabled: memory.enabled !== false,
  source: memory.source ?? 'manual',
  createdAt: new Date(memory.createTime).toISOString(),
  updatedAt: new Date(memory.updateTime).toISOString()
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
  const [list, setting] = await Promise.all([
    MongoUserMemory.find({ teamId, tmbId }).sort({ createTime: -1, _id: -1 }).lean(),
    MongoUserMemorySetting.findOne({ teamId, tmbId }).select('enabled').lean()
  ]);

  return {
    list: list.map(formatItem),
    enabled: setting?.enabled !== false,
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
  await MongoUserMemory.deleteMany({ teamId, tmbId });
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
