/**
 * 鲁港通 - 系统内容控制器
 * 提供系统内容的CRUD操作
 */
import { MongoSystemContent } from './schema';
import type {
  SystemContentSchema,
  SystemContentUpdateParams,
  SystemContentResponse
} from '@fastgpt/global/support/systemContent/type';
import { SystemContentKeyEnum, systemContentKeyMap } from '@fastgpt/global/support/systemContent/constant';

/**
 * 获取系统内容
 * @param key 内容键名
 * @returns 系统内容
 */
export async function getSystemContent(
  key: SystemContentKeyEnum
): Promise<SystemContentResponse | null> {
  try {
    let content = await MongoSystemContent.findOne({ key }).lean();

    // 如果内容不存在，创建默认内容
    if (!content) {
      const defaultData = systemContentKeyMap[key];
      if (!defaultData) {
        return null;
      }

      content = await MongoSystemContent.create({
        key,
        title: defaultData.defaultTitle,
        content: defaultData.defaultContent,
        contentType: 'markdown',
        createTime: new Date(),
        updateTime: new Date()
      });
    }

    return {
      key: content.key,
      title: content.title,
      content: content.content,
      contentType: content.contentType,
      updateTime: content.updateTime
    };
  } catch (error) {
    console.error('鲁港通：获取系统内容失败', { key, error });
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

    const updateData: any = {
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

    return {
      key: updatedContent.key,
      title: updatedContent.title,
      content: updatedContent.content,
      contentType: updatedContent.contentType,
      updateTime: updatedContent.updateTime
    };
  } catch (error) {
    console.error('鲁港通：更新系统内容失败', { params, error });
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

    // 确保所有内容都存在，不存在则创建默认内容
    const allKeys = Object.values(SystemContentKeyEnum);
    const existingKeys = contents.map((c) => c.key);
    const missingKeys = allKeys.filter((k) => !existingKeys.includes(k));

    // 创建缺失的默认内容
    for (const key of missingKeys) {
      const defaultData = systemContentKeyMap[key];
      if (defaultData) {
        const newContent = await MongoSystemContent.create({
          key,
          title: defaultData.defaultTitle,
          content: defaultData.defaultContent,
          contentType: 'markdown',
          createTime: new Date(),
          updateTime: new Date()
        });
        contents.push(newContent);
      }
    }

    return contents.map((c) => ({
      key: c.key,
      title: c.title,
      content: c.content,
      contentType: c.contentType,
      updateTime: c.updateTime
    }));
  } catch (error) {
    console.error('鲁港通：获取系统内容列表失败', { error });
    throw error;
  }
}
