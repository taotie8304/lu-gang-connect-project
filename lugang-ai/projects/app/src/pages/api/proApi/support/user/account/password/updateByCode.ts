// 鲁港通 - 找回密码提交重置（本地顶替商业版 proApi 通道，前端零改动）
// 流程：限流 → 验证码校验 → 账号查找 → 重置密码 → 作废旧会话 → 自动登录
import { NextAPI } from '@/service/middleware/entry';
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import {
  UpdatePasswordByCodeBodySchema,
  type UpdatePasswordByCodeBodyType
} from '@fastgpt/global/openapi/support/user/account/password/api';
import type { LoginSuccessResponseType } from '@fastgpt/global/openapi/support/user/account/login/api';
import { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import { TeamMemberRoleEnum } from '@fastgpt/global/support/user/team/constant';
import { AuditEventEnum } from '@fastgpt/global/support/user/audit/constants';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import { assertCodeVerificationConsumeRateLimit } from '@fastgpt/service/common/rateLimit/interface/accountVerification';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { getUserDetail } from '@fastgpt/service/support/user/controller';
import { createUserSession, delUserAllSession } from '@fastgpt/service/support/user/session';
import { setCookie } from '@fastgpt/service/support/permission/auth/common';
import { getClientIpFromRequest } from '@fastgpt/service/common/security/clientIp';
import { addAuditLog } from '@fastgpt/service/support/user/audit/util';
import { verifyAuthCode, UserAuthTypeEnum } from '@/pages/api/support/user/inform/sendAuthCode';

async function handler(
  req: ApiRequestProps<UpdatePasswordByCodeBodyType>,
  res: ApiResponseType
): Promise<LoginSuccessResponseType> {
  const { username, code, password, language } = parseApiInput({
    req,
    bodySchema: UpdatePasswordByCodeBodySchema
  }).body;

  await assertCodeVerificationConsumeRateLimit({ account: username, scene: 'forgetPassword' });

  const codeValid = await verifyAuthCode(username, code, UserAuthTypeEnum.findPassword);
  if (!codeValid) {
    return Promise.reject('验证码错误或已过期，请重新获取');
  }

  const user = await MongoUser.findOne({ $or: [{ username }, { email: username }] });
  if (!user) {
    return Promise.reject('该账号不存在，请先注册');
  }
  if (user.status === UserStatusEnum.forbidden) {
    return Promise.reject('该账号已被禁用，请联系管理员');
  }

  // 鲁港通 - 前端已哈希一次，schema setter 再哈希一次（与登录校验链路一致）
  user.password = password;
  user.passwordUpdateTime = new Date();
  if (language) {
    user.language = language;
  }
  await user.save();

  // 作废该账号全部旧登录态，随后重新签发本端会话
  await delUserAllSession(String(user._id));

  const tmb = await (async () => {
    const rootUser = await MongoUser.findOne({ username: 'root' }).lean();
    if (rootUser) {
      const rootTmb = await MongoTeamMember.findOne({
        userId: rootUser._id,
        role: TeamMemberRoleEnum.owner
      }).lean();
      if (rootTmb) {
        const adminTeamTmb = await MongoTeamMember.findOne({
          userId: user._id,
          teamId: rootTmb.teamId
        }).lean();
        if (adminTeamTmb) return adminTeamTmb;
      }
    }
    return null;
  })();
  if (!tmb) {
    return Promise.reject('账号数据异常，请联系管理员');
  }

  const userDetail = await getUserDetail({
    tmbId: String(tmb._id),
    userId: String(user._id)
  });

  const token = await createUserSession({
    userId: String(user._id),
    teamId: userDetail.team.teamId,
    tmbId: userDetail.team.tmbId,
    isRoot: user.username === 'root',
    ip: getClientIpFromRequest(req)
  });
  setCookie(res, token);

  void addAuditLog({
    tmbId: userDetail.team.tmbId,
    teamId: userDetail.team.teamId,
    event: AuditEventEnum.CHANGE_PASSWORD,
    params: {}
  });

  return {
    user: userDetail,
    token
  };
}

export default NextAPI(handler);
