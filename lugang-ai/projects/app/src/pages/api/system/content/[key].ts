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
    
    // 根据语言选择对应的内容版本
    if (locale === 'en') {
      // 英文：添加 _en 后缀
      const enKey = `${key}_en` as SystemContentKeyEnum;
      if (Object.values(SystemContentKeyEnum).includes(enKey)) {
        contentKey = enKey;
      }
    } else if (locale === 'zh-CN') {
      // 简体中文：添加 _zh-CN 后缀
      const cnKey = `${key}_zh-CN` as SystemContentKeyEnum;
      if (Object.values(SystemContentKeyEnum).includes(cnKey)) {
        contentKey = cnKey;
      }
      // 如果简体版本不存在，回退到繁体版本
    }
    // 繁体中文（zh-Hant）：使用原始 key

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
