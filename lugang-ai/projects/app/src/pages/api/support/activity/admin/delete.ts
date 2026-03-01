/**
 * 鲁港通 - 删除活动 API（管理员）
 * DELETE /api/support/activity/admin/delete
 * 
 * 仅管理员可以访问
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { deleteActivity } from '@fastgpt/service/support/activity/controller';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const { activityId } = req.body as { activityId: string };

  if (!activityId) {
    return Promise.reject('Missing activity ID');
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
    const success = await deleteActivity(activityId);
    
    if (!success) {
      return Promise.reject('Activity not found');
    }

    return { success: true };
  } catch (error: any) {
    console.error('鲁港通：删除活动失败', { activityId, error: error.message });
    return Promise.reject('Failed to delete activity');
  }
}

export default NextAPI(handler);
