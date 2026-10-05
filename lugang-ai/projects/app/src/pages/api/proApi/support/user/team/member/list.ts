// 鲁港通 - N4 团队成员名单（本地顶替商业版 proApi 通道；用量明细页成员筛选与成员选择组件的数据源）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { parsePaginationRequest } from '@fastgpt/service/common/api/pagination';
import { replaceRegChars } from '@fastgpt/global/common/string/tools';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import type { TeamMemberItemType } from '@fastgpt/global/support/user/team/type';
import type { PaginationResponse } from '@fastgpt/global/openapi/api';

type LocalTeamMemberItemType = TeamMemberItemType<{
  withPermission: false;
  withOrgs: false;
  withGroupRole: false;
}>;

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<PaginationResponse<LocalTeamMemberItemType>> {
  const { teamId } = await authCert({ req, authToken: true });

  const { pageSize, offset } = parsePaginationRequest(req);
  const { status, searchKey } = req.body as {
    status?: 'active' | 'inactive';
    searchKey?: string;
  };

  const where = {
    teamId,
    ...(status === 'active' ? { status: TeamMemberStatusEnum.active } : {}),
    ...(searchKey ? { name: { $regex: replaceRegChars(searchKey), $options: 'i' } } : {})
  };

  const [members, total] = await Promise.all([
    MongoTeamMember.find(where).sort({ createTime: 1 }).skip(offset).limit(pageSize).lean(),
    MongoTeamMember.countDocuments(where)
  ]);

  return {
    total,
    list: members.map((member) => ({
      userId: String(member.userId),
      tmbId: String(member._id),
      teamId: String(member.teamId),
      memberName: member.name,
      avatar: member.avatar,
      role: member.role,
      status: member.status,
      createTime: member.createTime,
      updateTime: member.updateTime
    }))
  };
}

export default NextAPI(handler);
