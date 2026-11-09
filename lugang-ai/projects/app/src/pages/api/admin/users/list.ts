/**
 * 鲁港通 - 管理员用户列表接口
 *
 * GET /api/admin/users/list
 *
 * 支持分页和搜索功能。
 * 适配 4.16.2：ApiRequestProps/ApiResponseType 来自 @fastgpt/next/type。
 */

import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { MongoUserPoints } from '@fastgpt/service/support/wallet/points/schema';

export type AdminUsersListQuery = {
  page?: string;
  pageSize?: string;
  search?: string;
};

export type AdminUsersListBody = Record<string, never>;

export interface AdminUserItem {
  _id: string;
  username: string;
  avatar?: string;
  status: string;
  createTime: Date;
  lastLoginTmbId?: string;
  teamName?: string;
  memberName?: string;
  /** 当前 Credits 余额；root 账号不展示（null） */
  creditsSurplus?: number | null;
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
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const skip = (pageNum - 1) * pageSizeNum;

  // 构建搜索条件（按用户名模糊匹配）
  const searchCondition = search ? { username: { $regex: search, $options: 'i' } } : {};

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
  const userIds = users.map((u) => u._id);
  const teamMembers = await MongoTeamMember.find({
    userId: { $in: userIds }
  })
    .select('userId teamId name avatar')
    .lean();

  const teamIds = [...new Set(teamMembers.map((tm) => tm.teamId))];
  const teams = await MongoTeam.find({
    _id: { $in: teamIds }
  })
    .select('_id name')
    .lean();

  // 鲁港通 - 用户列表展示当前 Credits 余额（按团队成员账户读取，未初始化按 0 展示）
  const pointsList = await MongoUserPoints.find({
    tmbId: { $in: teamMembers.map((tm) => tm._id) }
  })
    .select('tmbId surplusPoints')
    .lean();
  const pointsMap = new Map(pointsList.map((p) => [p.tmbId.toString(), p.surplusPoints]));

  const teamMap = new Map(teams.map((t) => [t._id.toString(), t.name]));
  const memberById = new Map(teamMembers.map((tm) => [tm._id.toString(), tm]));
  const memberMap = new Map(
    teamMembers.map((tm) => [
      tm.userId.toString(),
      {
        tmbId: tm._id.toString(),
        teamName: teamMap.get(tm.teamId.toString()),
        memberName: tm.name,
        avatar: tm.avatar
      }
    ])
  );

  // 组装返回数据
  const list: AdminUserItem[] = users.map((user) => {
    const member =
      (user.lastLoginTmbId ? memberById.get(user.lastLoginTmbId.toString()) : undefined) ??
      undefined;
    const memberInfo = memberMap.get(user._id.toString());
    return {
      _id: user._id.toString(),
      username: user.username,
      avatar: memberInfo?.avatar,
      status: user.status || 'active',
      // 鲁港通 - UserModelSchema.createTime 声明为 number（运行时实为 Date），显式转 Date 对齐响应类型
      createTime: new Date(user.createTime),
      lastLoginTmbId: user.lastLoginTmbId?.toString(),
      teamName: memberInfo?.teamName,
      memberName: memberInfo?.memberName,
      creditsSurplus:
        user.username === 'root'
          ? null
          : pointsMap.get(member?._id.toString() ?? memberInfo?.tmbId ?? '') ?? 0
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
