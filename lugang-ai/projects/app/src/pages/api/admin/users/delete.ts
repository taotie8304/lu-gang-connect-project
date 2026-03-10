/**
 * 鲁港通 - 管理员删除用户接口
 *
 * DELETE /api/admin/users/delete
 */

import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';

export type DeleteUserBody = {
  userId: string;
};

async function handler(
  req: ApiRequestProps<DeleteUserBody>,
  _res: ApiResponseType<{}>
): Promise<{}> {
  const { isRoot } = await authCert({ req, authToken: true, authRoot: true });

  if (!isRoot) {
    throw new Error('Permission denied: Admin access required');
  }

  const { userId } = req.body;
  if (!userId) {
    throw new Error('userId is required');
  }

  // 禁止删除 root 用户
  const user = await MongoUser.findById(userId).select('username').lean();
  if (!user) {
    throw new Error('User not found');
  }
  if (user.username === 'root') {
    throw new Error('Cannot delete root user');
  }

  // 删除用户的团队成员记录
  const teamMembers = await MongoTeamMember.find({ userId }).select('teamId').lean();
  for (const member of teamMembers) {
    // 如果该团队只有这一个成员，删除团队
    const memberCount = await MongoTeamMember.countDocuments({ teamId: member.teamId });
    if (memberCount <= 1) {
      await MongoTeam.deleteOne({ _id: member.teamId });
    }
  }
  await MongoTeamMember.deleteMany({ userId });

  // 删除用户
  await MongoUser.deleteOne({ _id: userId });

  return {};
}

export default NextAPI(handler);
