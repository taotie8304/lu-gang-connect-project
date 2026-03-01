/**
 * 鲁港通 - 修改密码 API
 * 通过旧密码验证后更新新密码
 * 
 * 密码哈希流程：
 * 1. 用户输入明文密码
 * 2. 前端 hashStr() 哈希一次后发送
 * 3. 后端 hashStr() 再哈希一次后存入数据库
 * 4. 登录时同样流程验证
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
import { connectionMongo } from '@fastgpt/service/common/mongo';
import { getOneApiUserByUsername, updateOneApiUserPassword } from '@/service/integration/oneapi';
import { addLog } from '@fastgpt/service/common/system/log';

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
  
  // 直接从数据库读取密码，绕过 Schema 的 get 函数
  const userDoc = await connectionMongo.connection.db
    .collection('users')
    .findOne({ _id: userId });

  if (!userDoc || userDoc.password !== oldPswHash) {
    return Promise.reject(i18nT('common:user.Old password is error'));
  }

  if (oldPsw === newPsw) {
    return Promise.reject(i18nT('common:user.Password has no change'));
  }

  // 鲁港通：更新密码
  // 前端发送的 newPsw 已经是哈希过一次的值
  // 需要再哈希一次存入数据库（与登录验证逻辑一致）
  const newPswHash = hashStr(newPsw);
  
  // 直接更新数据库，绕过 Schema 的 set 函数
  await connectionMongo.connection.db
    .collection('users')
    .updateOne(
      { _id: userId },
      { 
        $set: { 
          password: newPswHash,
          passwordUpdateTime: new Date()
        }
      }
    );

  await delUserAllSession(userId, [sessionId]);

  // 鲁港通：同步密码到后端
  // 异步执行，不阻塞主流程
  (async () => {
    try {
      // 获取用户信息
      const user = await MongoUser.findById(userId);
      if (!user) {
        addLog.warn('鲁港通后端密码同步失败：用户不存在', { userId });
        return;
      }

      // 查询鲁港通后端用户
      const backendUser = await getOneApiUserByUsername(user.username);
      
      if (backendUser.success && backendUser.data) {
        // 更新鲁港通后端密码
        // 注意：鲁港通后端期望接收的是前端哈希后的密码（与注册时一致）
        // 前端发送的 newPsw 已经是哈希过一次的值，直接传递给后端
        const result = await updateOneApiUserPassword(backendUser.data.id, newPsw);
        
        if (result.success) {
          addLog.info('鲁港通后端密码同步成功', { username: user.username });
        } else {
          addLog.warn('鲁港通后端密码同步失败', { 
            username: user.username, 
            error: result.message 
          });
        }
      } else {
        addLog.warn('鲁港通后端用户不存在，跳过密码同步', { username: user.username });
      }
    } catch (error: any) {
      addLog.error('鲁港通后端密码同步异常', { 
        userId, 
        error: error.message 
      });
    }
  })();

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
