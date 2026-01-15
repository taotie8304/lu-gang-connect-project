/**
 * 鲁港通 - 修改密码 API
 * 通过旧密码验证后更新新密码
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { hashStr } from '@fastgpt/global/common/string/tools';

import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { i18nT } from '@fastgpt/web/i18n/utils';
import { NextAPI } from '@/service/middleware/entry';
import { addAuditLog } from '@fastgpt/service/support/user/audit/util';
import { AuditEventEnum } from '@fastgpt/global/support/user/audit/constants';
import { delUserAllSession } from '@fastgpt/service/support/user/session';

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  const { oldPsw, newPsw } = req.body as { oldPsw: string; newPsw: string };

  if (!oldPsw || !newPsw) {
    return Promise.reject('Params is missing');
  }

  const { tmbId, teamId, sessionId } = await authCert({ req, authToken: true });
  const tmb = await MongoTeamMember.findById(tmbId);
  if (!tmb) {
    return Promise.reject('can not find it');
  }
  const userId = tmb.userId;

  // 鲁港通：验证旧密码
  // 前端发送的 oldPsw 已经是哈希过一次的值
  // 数据库存储的是二次哈希值，所以需要对 oldPsw 再哈希一次进行比较
  const oldPswHash = hashStr(oldPsw);
  const user = await MongoUser.findOne({
    _id: userId
  }).select('+password');

  if (!user || user.password !== oldPswHash) {
    return Promise.reject(i18nT('common:user.Old password is error'));
  }

  if (oldPsw === newPsw) {
    return Promise.reject(i18nT('common:user.Password has no change'));
  }

  // 鲁港通：更新密码
  // 前端发送的 newPsw 已经是哈希过一次的值
  // 需要再哈希一次存入数据库（与登录验证逻辑一致）
  const newPswHash = hashStr(newPsw);
  await MongoUser.updateOne(
    { _id: userId },
    { 
      $set: { 
        password: newPswHash,
        passwordUpdateTime: new Date()
      }
    }
  );

  await delUserAllSession(userId, [sessionId]);

  (async () => {
    addAuditLog({
      tmbId,
      teamId,
      event: AuditEventEnum.CHANGE_PASSWORD,
      params: {}
    });
  })();
  
  return { success: true };
}

export default NextAPI(handler);
