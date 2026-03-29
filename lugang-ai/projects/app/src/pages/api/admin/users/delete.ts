/**
 * 鲁港通 - 管理员删除用户接口
 * 完整清理用户相关的所有数据，确保数据库干净
 *
 * DELETE /api/admin/users/delete
 */

import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { MongoChat } from '@fastgpt/service/core/chat/chatSchema';
import { addLog } from '@fastgpt/service/common/system/log';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';

export type DeleteUserBody = {
  userId: string;
};

export type DeleteUserResponse = {
  deletedCounts: {
    user: number;
    teamMembers: number;
    teams: number;
    permissions: number;
    chats: number;
  };
};

async function handler(
  req: ApiRequestProps<DeleteUserBody>,
  _res: ApiResponseType<DeleteUserResponse>
): Promise<DeleteUserResponse> {
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

  // 使用事务确保数据一致性
  const deletedCounts = await mongoSessionRun(async (session) => {
    const counts = {
      user: 0,
      teamMembers: 0,
      teams: 0,
      permissions: 0,
      chats: 0
    };

    // 1. 查找用户的所有团队成员记录
    const teamMembers = await MongoTeamMember.find({ userId }, null, { session }).lean();
    const tmbIds = teamMembers.map((tmb) => tmb._id);
    const teamIds = teamMembers.map((tmb) => tmb.teamId);

    addLog.info('鲁港通删除用户 - 找到团队成员记录', {
      userId,
      username: user.username,
      tmbCount: tmbIds.length
    });

    // 2. 删除用户的所有权限记录（通过 tmbId）
    if (tmbIds.length > 0) {
      const permResult = await MongoResourcePermission.deleteMany(
        { tmbId: { $in: tmbIds } },
        { session }
      );
      counts.permissions = permResult.deletedCount || 0;
      addLog.info('鲁港通删除用户 - 删除权限记录', {
        userId,
        deletedPermissions: counts.permissions
      });
    }

    // 3. 删除用户的所有聊天记录（通过 tmbId）
    if (tmbIds.length > 0) {
      const chatResult = await MongoChat.deleteMany(
        { tmbId: { $in: tmbIds } },
        { session }
      );
      counts.chats = chatResult.deletedCount || 0;
      addLog.info('鲁港通删除用户 - 删除聊天记录', {
        userId,
        deletedChats: counts.chats
      });
    }

    // 4. 删除用户的团队成员记录
    const tmbResult = await MongoTeamMember.deleteMany({ userId }, { session });
    counts.teamMembers = tmbResult.deletedCount || 0;
    addLog.info('鲁港通删除用户 - 删除团队成员记录', {
      userId,
      deletedTeamMembers: counts.teamMembers
    });

    // 5. 检查并删除空团队（只有该用户一个成员的团队）
    for (const teamId of teamIds) {
      const remainingMembers = await MongoTeamMember.countDocuments(
        { teamId },
        { session }
      );
      if (remainingMembers === 0) {
        await MongoTeam.deleteOne({ _id: teamId }, { session });
        counts.teams++;
        addLog.info('鲁港通删除用户 - 删除空团队', {
          userId,
          teamId: teamId.toString()
        });
      }
    }

    // 6. 删除用户记录
    const userResult = await MongoUser.deleteOne({ _id: userId }, { session });
    counts.user = userResult.deletedCount || 0;
    addLog.info('鲁港通删除用户 - 删除用户记录', {
      userId,
      username: user.username
    });

    return counts;
  });

  addLog.info('鲁港通删除用户 - 完成', {
    userId,
    username: user.username,
    deletedCounts
  });

  return { deletedCounts };
}

export default NextAPI(handler);
