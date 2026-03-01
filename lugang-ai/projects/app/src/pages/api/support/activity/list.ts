/**
 * 鲁港通 - 获取活动列表 API
 * GET /api/support/activity/list
 * 
 * 所有用户都可以访问，返回当前有效的活动
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextAPI } from '@/service/middleware/entry';
import { getActiveActivities } from '@fastgpt/service/support/activity/controller';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const activities = await getActiveActivities();
    return activities;
  } catch (error: any) {
    console.error('鲁港通：获取活动列表失败', { error: error.message });
    return Promise.reject('Failed to get activities');
  }
}

export default NextAPI(handler);
