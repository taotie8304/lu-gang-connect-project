/**
 * 鲁港通 - 更新活动 API（管理员）
 * PUT /api/support/activity/admin/update
 * 
 * 仅管理员可以访问
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { updateActivity } from '@fastgpt/service/support/activity/controller';
import type { ActivityUpdateParams } from '@fastgpt/global/support/activity/type';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoUser } from '@fastgpt/service/support/user/schema';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const { activityId, ...updateParams } = req.body as ActivityUpdateParams & {
    activityId: string;
  };

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
    const activity = await updateActivity(activityId, updateParams, user._id.toString());
    return activity;
  } catch (error: any) {
    console.error('鲁港通：更新活动失败', { activityId, error: error.message });
    return Promise.reject(error.message || 'Failed to update activity');
  }
}

export default NextAPI(handler);
