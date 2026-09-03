import { getUserDetail } from '@fastgpt/service/support/user/controller';
import { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import { NextAPI } from '@/service/middleware/entry';
import { pushTrack } from '@fastgpt/service/common/middle/tracks/utils';
import { addAuditLog } from '@fastgpt/service/support/user/audit/util';
import { AuditEventEnum } from '@fastgpt/global/support/user/audit/constants';
import { passwordVerificationService } from '@fastgpt/service/support/user/account/verification/password/service';
import { createUserSession } from '@fastgpt/service/support/user/session';
import { setCookie } from '@fastgpt/service/support/permission/auth/common';
import { UserError } from '@fastgpt/global/common/error/utils';
import {
  LoginByPasswordBodySchema,
  type LoginByPasswordBodyType,
  type LoginSuccessResponseType
} from '@fastgpt/global/openapi/support/user/account/login/api';
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { getClientIpFromRequest } from '@fastgpt/service/common/security/clientIp';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import {
  reportCRMVisitorIdentity,
  resolveCRMVisitorId
} from '@fastgpt/service/support/marketing/attribution';
import { assertUserCanLogin } from '@fastgpt/service/support/user/account/cancellation/guard';
// 鲁港通 - 登录自愈团队成员归属 + 同步鲁港通后端所需依赖
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import {
  TeamMemberRoleEnum,
  TeamMemberStatusEnum
} from '@fastgpt/global/support/user/team/constant';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { PerResourceTypeEnum, ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { TeamDefaultRoleVal } from '@fastgpt/global/support/permission/user/constant';
import { Types } from 'mongoose';
import { syncUserToOneApi } from '@/service/integration/oneapi';
import { getLogger, LogCategories } from '@fastgpt/service/common/logger';

// 鲁港通 - 适配 4.16.2 OpenTelemetry logger：保留 addLog 名称（方法签名 (msg, data) 与原一致）
const addLog = getLogger(LogCategories.MODULE.USER.ACCOUNT);

async function handler(
  req: ApiRequestProps<LoginByPasswordBodyType>,
  res: ApiResponseType
): Promise<LoginSuccessResponseType> {
  const { username, password, code, language, fastgpt_sem } = parseApiInput({
    req,
    bodySchema: LoginByPasswordBodySchema
  }).body;

  const { user, userDetail, visitorIdentity } =
    await passwordVerificationService.withVerifiedCredentials(
      {
        username,
        password,
        code,
        purpose: 'login'
      },
      async ({ user, session }) => {
        if (user.status === UserStatusEnum.forbidden) {
          return Promise.reject('Invalid account!');
        }

        if (user.username.startsWith('wecom-')) {
          return Promise.reject(new UserError('Wecom user can not login with password'));
        }

        await assertUserCanLogin(String(user._id));

        // 鲁港通 - 确保普通用户归属 root 管理员团队：若不在团队中则自动修复（加入团队 + 团队读权限 + 默认应用读/聊天日志权限）
        const correctTmbId = await (async () => {
          if (username === 'root') return user.lastLoginTmbId;

          const rootUser = await MongoUser.findOne({ username: 'root' }).session(session).lean();
          if (!rootUser) return user.lastLoginTmbId;

          const rootTmb = await MongoTeamMember.findOne({
            userId: rootUser._id,
            role: TeamMemberRoleEnum.owner
          })
            .session(session)
            .lean();
          if (!rootTmb) return user.lastLoginTmbId;

          let userTmbInAdminTeam = await MongoTeamMember.findOne({
            userId: user._id,
            teamId: rootTmb.teamId
          })
            .session(session)
            .lean();

          // 鲁港通 - 自动修复：用户不在管理员团队时自动加入并分配权限
          if (!userTmbInAdminTeam) {
            addLog.warn('鲁港通用户不在管理员团队，自动修复', { username });
            const [newTmb] = await MongoTeamMember.create(
              [
                {
                  teamId: rootTmb.teamId,
                  userId: user._id,
                  name: username.split('@')[0] || username,
                  // 鲁港通 - 4.16.2 TeamMemberRoleEnum 仅保留 owner；普通成员省略 role 字段（isOwner=false）
                  status: TeamMemberStatusEnum.active,
                  createTime: new Date()
                }
              ],
              { session }
            );
            userTmbInAdminTeam = newTmb.toObject();

            // 团队读取权限
            await MongoResourcePermission.updateOne(
              {
                resourceType: PerResourceTypeEnum.team,
                teamId: rootTmb.teamId,
                tmbId: newTmb._id,
                resourceId: null
              },
              { $setOnInsert: { permission: TeamDefaultRoleVal } },
              { upsert: true, session }
            );

            // 默认应用读取权限
            const defaultAppId = process.env.DEFAULT_APP_ID;
            if (defaultAppId) {
              await MongoResourcePermission.updateOne(
                {
                  resourceType: PerResourceTypeEnum.app,
                  teamId: rootTmb.teamId,
                  tmbId: newTmb._id,
                  resourceId: new Types.ObjectId(defaultAppId)
                },
                { $setOnInsert: { permission: ReadPermissionVal } },
                { upsert: true, session }
              );
            }

            addLog.info('鲁港通用户已自动加入管理员团队并分配权限', {
              username,
              tmbId: newTmb._id.toString(),
              teamId: rootTmb.teamId.toString()
            });
          }

          return userTmbInAdminTeam._id.toString();
        })();

        const userDetail = await getUserDetail({
          tmbId: correctTmbId,
          userId: user._id,
          isRoot: username === 'root',
          session
        });

        user.lastLoginTmbId = userDetail.team.tmbId;
        user.language = language;
        const visitorIdentity = resolveCRMVisitorId({
          storedFastgptSem: user.fastgpt_sem,
          incomingVisitorId: fastgpt_sem?.visitor_id
        });
        if (visitorIdentity.shouldPersist) {
          user.fastgpt_sem = visitorIdentity.fastgptSem;
        }
        await user.save({ session });

        // 鲁港通 - 同步用户到鲁港通后端（首次登录时自动创建；失败不阻塞登录）
        try {
          await syncUserToOneApi(user.username, userDetail.team.memberName || user.username);
        } catch (error) {
          addLog.error('鲁港通后端用户同步失败', error);
        }

        return { user, userDetail, visitorIdentity };
      }
    );

  const token = await createUserSession({
    userId: user._id,
    teamId: userDetail.team.teamId,
    tmbId: userDetail.team.tmbId,
    isRoot: username === 'root',
    ip: getClientIpFromRequest(req)
  });

  setCookie(res, token);

  void reportCRMVisitorIdentity({
    visitorId: visitorIdentity.visitorId,
    userId: String(user._id),
    username: user.username,
    contact: user.contact ?? undefined
  });

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

export default NextAPI(handler);
