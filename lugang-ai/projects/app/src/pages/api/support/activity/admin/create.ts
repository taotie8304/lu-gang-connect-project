/**
 * 鲁港通 - 创建活动 API（管理员）
 * POST /api/support/activity/admin/create
 * 
 * 仅管理员可以访问
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { createActivity } from '@fastgpt/service/support/activity/controller';
import type { ActivityCreateParams } from '@fastgpt/global/support/activity/type';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const { title, description, image, link, startDate, endDate, isActive } =
    req.body as ActivityCreateParams;

  if (!title || !description || !startDate || !endDate) {
    return Promise.reject('Missing required parameters');
  }

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
    const activity = await createActivity(
      { title, description, image, link, startDate, endDate, isActive },
      user._id.toString()
    );

    return activity;
  } catch (error: any) {
    console.error('鲁港通：创建活动失败', { error: error.message });
    return Promise.reject(error.message || 'Failed to create activity');
  }
}

export default NextAPI(handler);
