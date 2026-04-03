/**
 * 鲁港通 - 获取系统内容 API
 * GET /api/system/content/{key}
 * 
 * 所有用户都可以访问，用于显示使用条款、隐私政策等内容
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextAPI } from '@/service/middleware/entry';
import { getSystemContent } from '@fastgpt/service/support/systemContent/controller';
import { SystemContentKeyEnum } from '@fastgpt/global/support/systemContent/constant';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const { key } = req.query as { key: string };

  // 验证 key 是否有效
  if (!Object.values(SystemContentKeyEnum).includes(key as SystemContentKeyEnum)) {
    return Promise.reject('Invalid content key');
  }

  try {
    // 鲁港通：根据用户语言选择对应的内容 key
    const locale = req.cookies.NEXT_LOCALE || 'zh-Hant';
    let contentKey = key as SystemContentKeyEnum;
    
    // 如果是英文，添加 _en 后缀
    if (locale === 'en') {
      const enKey = `${key}_en` as SystemContentKeyEnum;
      // 检查英文版本是否存在于枚举中
      if (Object.values(SystemContentKeyEnum).includes(enKey)) {
        contentKey = enKey;
      }
    }
    // 中文（简体和繁体）使用相同的内容（繁体）
    // 因为数据库中存储的是繁体中文版本

    const content = await getSystemContent(contentKey);

    if (!content) {
      return Promise.reject('Content not found');
    }

    return content;
  } catch (error: any) {
    console.error('鲁港通：获取系统内容失败', { key, error: error.message });
    return Promise.reject('Failed to get system content');
  }
}

export default NextAPI(handler);
