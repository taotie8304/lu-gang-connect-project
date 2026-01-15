/**
 * 鲁港通 - 简化登录 API
 * 移除验证码机制，直接用用户名密码登录
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { getUserDetail } from '@fastgpt/service/support/user/controller';
import { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import { NextAPI } from '@/service/middleware/entry';
import { useIPFrequencyLimit } from '@fastgpt/service/common/middle/reqFrequencyLimit';
import { pushTrack } from '@fastgpt/service/common/middle/tracks/utils';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { addAuditLog } from '@fastgpt/service/support/user/audit/util';
import { AuditEventEnum } from '@fastgpt/global/support/user/audit/constants';
import { createUserSession } from '@fastgpt/service/support/user/session';
import requestIp from 'request-ip';
import { setCookie } from '@fastgpt/service/support/permission/auth/common';
import { syncUserToOneApi } from '@/service/integration/oneapi';
import type { LangEnum } from '@fastgpt/global/common/i18n/type';

interface LoginSimpleProps {
  username: string;
  password: string;
  language?: LangEnum;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { username, password, language = 'zh-CN' } = req.body as LoginSimpleProps;

  if (!username || !password) {
    return Promise.reject(CommonErrEnum.invalidParams);
  }

  // 检测用户是否存在
  const authCert = await MongoUser.findOne({ username }, 'status');
  if (!authCert) {
    return Promise.reject(UserErrEnum.account_psw_error);
  }

  if (authCert.status === UserStatusEnum.forbidden) {
    return Promise.reject('Invalid account!');
  }

  // 直接验证用户名和密码
  const user = await MongoUser.findOne({ username, password });
  if (!user) {
    return Promise.reject(UserErrEnum.account_psw_error);
  }

  const userDetail = await getUserDetail({
    tmbId: user?.lastLoginTmbId,
    userId: user._id
  });

  MongoUser.findByIdAndUpdate(user._id, {
    lastLoginTmbId: userDetail.team.tmbId,
    language
  });

  // 鲁港通：同步用户到鲁港通后端
  try {
    await syncUserToOneApi(user.username, userDetail.team.memberName || user.username);
  } catch (error) {
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

// 鲁港通 - 简化登录，降低频率限制
const lockTime = Number(process.env.PASSWORD_LOGIN_LOCK_SECONDS || 60);
export default NextAPI(
  useIPFrequencyLimit({ id: 'login-simple', seconds: lockTime, limit: 20, force: true }),
  handler
);
