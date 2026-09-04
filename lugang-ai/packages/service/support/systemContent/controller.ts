/**
 * 鲁港通 - 系统内容控制器
 * 提供系统内容的 CRUD 操作。
 *
 * 适配 4.16.2：
 * - console.error 改用 OpenTelemetry logger（getLogger）；
 * - zh-CN 使用条款无 DB 覆盖时，基于繁体用 opencc（traditionalToSimplified）按需转换，避免维护重复法律大 blob。
 */
import { MongoSystemContent } from './schema';
import type {
  SystemContentUpdateParams,
  SystemContentResponse
} from '@fastgpt/global/support/systemContent/type';
import {
  SystemContentKeyEnum,
  systemContentKeyMap,
  systemContentZhCNBaseMap
} from '@fastgpt/global/support/systemContent/constant';
import { traditionalToSimplified } from '../../common/string/cjkNormalizer';
import { getLogger, LogCategories } from '../../common/logger';

const addLog = getLogger(LogCategories.SYSTEM);

// 鲁港通 - Mongo 文档 → 响应体
type SystemContentDoc = {
  key: string;
  title: string;
  content: string;
  contentType: string;
  updateTime: Date;
};
const toResponse = (doc: SystemContentDoc): SystemContentResponse => ({
  key: doc.key,
  title: doc.title,
  content: doc.content,
  contentType: doc.contentType,
  updateTime: doc.updateTime
});

// 鲁港通 - 基于繁体基准派生 zh-CN 内容（opencc 繁→简），不持久化，始终跟随繁体最新值
const deriveZhCN = (
  key: SystemContentKeyEnum,
  base: SystemContentResponse
): SystemContentResponse => ({
  key,
  title: traditionalToSimplified(base.title),
  content: traditionalToSimplified(base.content),
  contentType: base.contentType,
  updateTime: base.updateTime
});

/**
 * 获取系统内容
 * @param key 内容键名
 * @returns 系统内容
 */
export async function getSystemContent(
  key: SystemContentKeyEnum
): Promise<SystemContentResponse | null> {
  try {
    // 鲁港通 - 优先读取 DB 覆盖（管理员显式配置的内容，含 zh-CN 独立覆盖）
    const existing = await MongoSystemContent.findOne({ key }).lean();
    if (existing) {
      return toResponse(existing);
    }

    // 鲁港通 - zh-CN 派生变体：无 DB 覆盖时基于繁体基准 opencc 按需转换（不持久化，始终跟随繁体最新值）
    const baseKey = systemContentZhCNBaseMap[key];
    if (baseKey) {
      const base = await getSystemContent(baseKey);
      return base ? deriveZhCN(key, base) : null;
    }

    // 鲁港通 - 首次访问：从常量默认创建持久化文档
    const defaultData = systemContentKeyMap[key as keyof typeof systemContentKeyMap];
    if (!defaultData) {
      return null;
    }
    const created = await MongoSystemContent.create({
      key,
      title: defaultData.defaultTitle,
      content: defaultData.defaultContent,
      contentType: 'markdown',
      createTime: new Date(),
      updateTime: new Date()
    });
    return toResponse(created);
  } catch (error) {
    addLog.error('鲁港通：获取系统内容失败', { key, error });
    throw error;
  }
}

/**
 * 更新系统内容（管理员）
 * @param params 更新参数
 * @param userId 更新用户ID
 * @returns 更新后的内容
 */
export async function updateSystemContent(
  params: SystemContentUpdateParams,
  userId: string
): Promise<SystemContentResponse> {
  try {
    const { key, title, content, contentType = 'markdown' } = params;

    // 鲁港通 - 消除 any，显式声明更新体类型
    const updateData: {
      content: string;
      contentType: 'markdown' | 'html' | 'text';
      updateTime: Date;
      updatedBy: string;
      title?: string;
    } = {
      content,
      contentType,
      updateTime: new Date(),
      updatedBy: userId
    };

    if (title) {
      updateData.title = title;
    }

    const updatedContent = await MongoSystemContent.findOneAndUpdate(
      { key },
      updateData,
      { new: true, upsert: true }
    ).lean();

    if (!updatedContent) {
      throw new Error('更新系统内容失败');
    }

    return toResponse(updatedContent);
  } catch (error) {
    addLog.error('鲁港通：更新系统内容失败', { params, error });
    throw error;
  }
}

/**
 * 获取所有系统内容列表（管理员）
 * @returns 系统内容列表
 */
export async function getAllSystemContents(): Promise<SystemContentResponse[]> {
  try {
    const contents = await MongoSystemContent.find({}).sort({ key: 1 }).lean();
    const existingKeys = new Set(contents.map((c) => c.key));
    const result: SystemContentResponse[] = contents.map((c) => toResponse(c));

    // 鲁港通 - 补齐缺失内容：派生变体按需 opencc 转换（不持久化），其余从常量默认创建
    for (const key of Object.values(SystemContentKeyEnum)) {
      if (existingKeys.has(key)) continue;

      const baseKey = systemContentZhCNBaseMap[key];
      if (baseKey) {
        const base = await getSystemContent(baseKey);
        if (base) result.push(deriveZhCN(key, base));
        continue;
      }

      const defaultData = systemContentKeyMap[key as keyof typeof systemContentKeyMap];
      if (defaultData) {
        const created = await MongoSystemContent.create({
          key,
          title: defaultData.defaultTitle,
          content: defaultData.defaultContent,
          contentType: 'markdown',
          createTime: new Date(),
          updateTime: new Date()
        });
        result.push(toResponse(created));
      }
    }

    return result.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  } catch (error) {
    addLog.error('鲁港通：获取系统内容列表失败', { error });
    throw error;
  }
}
