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
    const content = await getSystemContent(key as SystemContentKeyEnum);

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
