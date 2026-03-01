/**
 * 鲁港通 - 获取所有活动列表 API（管理员）
 * GET /api/support/activity/admin/list
 * 
 * 仅管理员可以访问，返回所有活动（包括已结束的）
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { getAllActivities } from '@fastgpt/service/support/activity/controller';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  // 鲁港通：验证用户身份和管理员权限
  const { tmbId } = await authCert({ req, authToken: true });

  const tmb = await MongoTeamMember.findById(tmbId);
  if (!tmb) {
    return Promise.reject('User not found');
  }

  const user = await MongoUser.findById(tmb.userId);
  if (!user) {
    return Promise.reject('User not found');
  }

  // 鲁港通：检查是否为管理员（username === 'root'）
  if (user.username !== 'root') {
    return Promise.reject('Permission denied: Admin only');
  }

  try {
    const { includeInactive, startDate, endDate } = req.query;

    const activities = await getAllActivities({
      includeInactive: includeInactive === 'true',
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    return activities;
  } catch (error: any) {
    console.error('鲁港通：获取所有活动失败', { error: error.message });
    return Promise.reject('Failed to get all activities');
  }
}

export default NextAPI(handler);
