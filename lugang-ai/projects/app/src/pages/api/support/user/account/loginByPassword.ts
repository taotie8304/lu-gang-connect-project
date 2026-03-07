import type { NextApiRequest, NextApiResponse } from 'next';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { getUserDetail } from '@fastgpt/service/support/user/controller';
import type { PostLoginProps } from '@fastgpt/global/support/user/api.d';
import { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import { NextAPI } from '@/service/middleware/entry';
import { useIPFrequencyLimit } from '@fastgpt/service/common/middle/reqFrequencyLimit';
import { pushTrack } from '@fastgpt/service/common/middle/tracks/utils';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { addAuditLog } from '@fastgpt/service/support/user/audit/util';
import { AuditEventEnum } from '@fastgpt/global/support/user/audit/constants';
import { UserAuthTypeEnum } from '@fastgpt/global/support/user/auth/constants';
import { authCode } from '@fastgpt/service/support/user/auth/controller';
import { createUserSession } from '@fastgpt/service/support/user/session';
import requestIp from 'request-ip';
import { setCookie } from '@fastgpt/service/support/permission/auth/common';
import { syncUserToOneApi } from '@/service/integration/oneapi';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberRoleEnum } from '@fastgpt/global/support/user/team/constant';
import { addLog } from '@fastgpt/service/common/system/log';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { username, password, code, language = 'zh-CN' } = req.body as PostLoginProps;

  if (!username || !password || !code) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  // Auth prelogin code
  await authCode({
    key: username,
    code,
    type: UserAuthTypeEnum.login
  });

  // 检测用户是否存在
  const authCert = await MongoUser.findOne(
    {
      username
    },
    'status'
  );
  if (!authCert) {
    return Promise.reject(UserErrEnum.account_psw_error);
  }

  if (authCert.status === UserStatusEnum.forbidden) {
    return Promise.reject('Invalid account!');
  }

  const user = await MongoUser.findOne({
    username,
    password
  });

  if (!user) {
    return Promise.reject(UserErrEnum.account_psw_error);
  }

  // 鲁港通：确保普通用户使用管理员团队的 tmbId
  // 如果用户有多个 team_members 记录（旧独立团队 + 管理员团队），优先选择管理员团队的
  const correctTmbId = await (async () => {
    if (username === 'root') {
      return user.lastLoginTmbId; // root 用户使用默认逻辑
    }

    // 查找 root 管理员的团队 ID
    const rootUser = await MongoUser.findOne({ username: 'root' }).lean();
    if (rootUser) {
      const rootTmb = await MongoTeamMember.findOne({
        userId: rootUser._id,
        role: TeamMemberRoleEnum.owner
      }).lean();

      if (rootTmb) {
        // 查找该用户在管理员团队中的成员记录
        const userTmbInAdminTeam = await MongoTeamMember.findOne({
          userId: user._id,
          teamId: rootTmb.teamId
        }).lean();

        if (userTmbInAdminTeam) {
          addLog.info('鲁港通用户登录使用管理员团队', {
            username,
            tmbId: userTmbInAdminTeam._id.toString(),
            teamId: rootTmb.teamId.toString()
          });
          return userTmbInAdminTeam._id.toString();
        }
      }
    }

    // 回退到默认逻辑
    return user.lastLoginTmbId;
  })();

  const userDetail = await getUserDetail({
    tmbId: correctTmbId,
    userId: user._id
  });

  MongoUser.findByIdAndUpdate(user._id, {
    lastLoginTmbId: userDetail.team.tmbId,
    language
  });

  // 鲁港通：同步用户到鲁港通后端（首次登录时自动创建）
  try {
    await syncUserToOneApi(user.username, userDetail.team.memberName || user.username);
  } catch (error) {
    // 同步失败不影响登录流程，仅记录日志
    console.error('鲁港通后端用户同步失败:', error);
  }

  const token = await createUserSession({
    userId: user._id,
    teamId: userDetail.team.teamId,
    tmbId: userDetail.team.tmbId,
    isRoot: username === 'root',
    ip: requestIp.getClientIp(req)
  });

  setCookie(res, token);

  pushTrack.login({
    type: 'password',
    uid: user._id,
    teamId: userDetail.team.teamId,
    tmbId: userDetail.team.tmbId
  });
  addAuditLog({
    tmbId: userDetail.team.tmbId,
    teamId: userDetail.team.teamId,
    event: AuditEventEnum.LOGIN
  });

  return {
    user: userDetail,
    token
  };
}

const lockTime = Number(process.env.PASSWORD_LOGIN_LOCK_SECONDS || 120);
export default NextAPI(
  useIPFrequencyLimit({ id: 'login-by-password', seconds: lockTime, limit: 10, force: true }),
  handler
);
