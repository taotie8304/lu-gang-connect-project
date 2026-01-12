/**
 * 鲁港通 - 管理员用户列表接口
 * 
 * GET /api/admin/users/list
 * 
 * 支持分页和搜索功能
 */

import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';

export type AdminUsersListQuery = {
  page?: string;
  pageSize?: string;
  search?: string;
};

export type AdminUsersListBody = {};

export interface AdminUserItem {
  _id: string;
  username: string;
  avatar?: string;
  status: string;
  createTime: Date;
  lastLoginTmbId?: string;
  teamName?: string;
  memberName?: string;
}

export type AdminUsersListResponse = {
  list: AdminUserItem[];
  total: number;
  page: number;
  pageSize: number;
};

async function handler(
  req: ApiRequestProps<AdminUsersListBody, AdminUsersListQuery>,
  _res: ApiResponseType<AdminUsersListResponse>
): Promise<AdminUsersListResponse> {
  // 验证管理员权限
  const { isRoot } = await authCert({ req, authToken: true, authRoot: true });
  
  if (!isRoot) {
    throw new Error('Permission denied: Admin access required');
  }

  const { page = '1', pageSize = '20', search = '' } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10)));
  const skip = (pageNum - 1) * pageSizeNum;

  // 构建搜索条件
  const searchCondition = search
    ? {
        $or: [
          { username: { $regex: search, $options: 'i' } },
        ]
      }
    : {};

  // 查询用户总数
  const total = await MongoUser.countDocuments(searchCondition);

  // 查询用户列表
  const users = await MongoUser.find(searchCondition)
    .select('_id username status createTime lastLoginTmbId')
    .sort({ createTime: -1 })
    .skip(skip)
    .limit(pageSizeNum)
    .lean();

  // 获取用户的团队信息
  const userIds = users.map(u => u._id);
  const teamMembers = await MongoTeamMember.find({
    userId: { $in: userIds }
  })
    .select('userId teamId name avatar')
    .lean();

  const teamIds = [...new Set(teamMembers.map(tm => tm.teamId))];
  const teams = await MongoTeam.find({
    _id: { $in: teamIds }
  })
    .select('_id name')
    .lean();

  const teamMap = new Map(teams.map(t => [t._id.toString(), t.name]));
  const memberMap = new Map(
    teamMembers.map(tm => [
      tm.userId.toString(),
      {
        teamName: teamMap.get(tm.teamId.toString()),
        memberName: tm.name,
        avatar: tm.avatar
      }
    ])
  );

  // 组装返回数据
  const list: AdminUserItem[] = users.map(user => {
    const memberInfo = memberMap.get(user._id.toString());
    return {
      _id: user._id.toString(),
      username: user.username,
      avatar: memberInfo?.avatar,
      status: user.status || 'active',
      createTime: user.createTime,
      lastLoginTmbId: user.lastLoginTmbId?.toString(),
      teamName: memberInfo?.teamName,
      memberName: memberInfo?.memberName
    };
  });

  return {
    list,
    total,
    page: pageNum,
    pageSize: pageSizeNum
  };
}

export default NextAPI(handler);
