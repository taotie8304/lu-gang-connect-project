// 鲁港通 - 后台用户管理共享解析：root 鉴权、目标用户/成员定位、操作者名称
import type { ApiRequestProps } from '@fastgpt/next/type';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';

/** 校验 root 权限（后台用户管理全部接口共用） */
export const authAdminRoot = async (req: ApiRequestProps) => {
  const auth = await authCert({ req, authToken: true, authRoot: true });
  if (!auth.isRoot) {
    throw new Error('需要管理员权限');
  }
  return auth;
};

/** 按 userId 定位目标用户与其团队成员记录（优先最近登录的成员身份） */
export const resolveAdminTargetUser = async (userId: unknown) => {
  if (!userId || typeof userId !== 'string') {
    throw new Error('缺少 userId 参数');
  }

  const user = await MongoUser.findById(userId).lean();
  if (!user) {
    throw new Error('用户不存在');
  }

  const member =
    (user.lastLoginTmbId
      ? await MongoTeamMember.findById(user.lastLoginTmbId).lean()
      : null) ?? (await MongoTeamMember.findOne({ userId: user._id }).lean());
  if (!member) {
    throw new Error('该用户尚未加入任何团队，无法操作');
  }

  return { user, member };
};

/** 操作者展示名（rootkey 调用无成员身份时回落为 root） */
export const getAdminOperatorName = async (tmbId: string) => {
  if (!tmbId) return 'root';
  const member = await MongoTeamMember.findById(tmbId).lean();
  return member?.name || 'root';
};
