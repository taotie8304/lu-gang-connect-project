/**
 * 鲁港通 - 管理员用户详情接口
 * GET: 获取指定用户的完整信息（含额度）
 * PUT: 更新指定用户信息（含密码重置）
 * Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.7
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { connectionMongo } from '@fastgpt/service/common/mongo';
import { updateUserInBackend } from '@fastgpt/service/support/user/integration/userSync';
import { getOneApiUserByUsername } from '@/service/integration/oneapi';
import { addLog } from '@fastgpt/service/common/system/log';
import { validateEmail, validatePhone } from '@/pages/api/user/profile';
import { hashStr } from '@fastgpt/global/common/string/tools';

/** 密码长度校验：至少 8 位 */
export function validatePassword(password: string): boolean {
  return password.length >= 8;
}

export type AdminUserDetail = {
  _id: string;
  username: string;
  name: string;
  nickname?: string;
  phone?: string;
  email?: string;
  address?: string;
  status: string;
  createTime: Date;
  isRoot: boolean;
  quota?: { quota: number; usedQuota: number; remainingQuota: number } | null;
};

export type AdminUpdateUserBody = {
  userId: string;
  name?: string;
  nickname?: string;
  phone?: string;
  email?: string;
  address?: string;
  newPassword?: string;
};

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { isRoot } = await authCert({ req, authToken: true, authRoot: true });
  if (!isRoot) {
    return jsonRes(res, { code: 403, error: '需要管理员权限' });
  }

  const { userId } = req.query as { userId: string };
  if (!userId) {
    return jsonRes(res, { code: 400, error: '缺少 userId 参数' });
  }

  const user = await MongoUser.findById(userId);
  if (!user) {
    return jsonRes(res, { code: 404, error: '用户不存在' });
  }

  const tmb = await MongoTeamMember.findOne({ userId: user._id });

  // Requirement 4.3: 获取鲁港通后端额度（失败返回 null）
  let quota: AdminUserDetail['quota'] = null;
  try {
    const oneApiUser = await getOneApiUserByUsername(user.username);
    if (oneApiUser.success && oneApiUser.data) {
      quota = {
        quota: oneApiUser.data.quota,
        usedQuota: oneApiUser.data.used_quota,
        remainingQuota: Math.max(0, oneApiUser.data.quota - oneApiUser.data.used_quota)
      };
    }
  } catch {
    // Requirement 4.4: 失败返回 null
  }

  const detail: AdminUserDetail = {
    _id: user._id.toString(),
    username: user.username,
    name: tmb?.name || '',
    nickname: user.nickname || '',
    phone: user.phone || '',
    email: user.email || '',
    address: user.address || '',
    status: user.status || 'active',
    createTime: user.createTime,
    isRoot: user.username === 'root',
    quota
  };

  return jsonRes(res, { data: detail });
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  const { isRoot } = await authCert({ req, authToken: true, authRoot: true });
  if (!isRoot) {
    return jsonRes(res, { code: 403, error: '需要管理员权限' });
  }

  const { userId, name, nickname, phone, email, address, newPassword } =
    req.body as AdminUpdateUserBody;

  if (!userId) {
    return jsonRes(res, { code: 400, error: '缺少 userId 参数' });
  }

  const user = await MongoUser.findById(userId);
  if (!user) {
    return jsonRes(res, { code: 404, error: '用户不存在' });
  }

  // Requirement 5.7: 禁止修改 root 用户
  if (user.username === 'root') {
    return jsonRes(res, { code: 403, error: '不允许修改 root 用户信息' });
  }

  // 校验邮箱格式
  if (email !== undefined && !validateEmail(email)) {
    return jsonRes(res, { code: 400, error: '邮箱格式不合法' });
  }

  // 校验手机号格式
  if (phone !== undefined && !validatePhone(phone)) {
    return jsonRes(res, { code: 400, error: '手机号格式不合法（需7-15位数字）' });
  }

  // Requirement 5.5: 密码长度校验
  if (newPassword !== undefined && newPassword !== '' && !validatePassword(newPassword)) {
    return jsonRes(res, { code: 400, error: '密码长度至少 8 位' });
  }

  // Requirement 5.1: 保存到鲁港通前端数据库
  await mongoSessionRun(async (session) => {
    const userUpdate: Record<string, any> = {};
    if (nickname !== undefined) userUpdate.nickname = nickname;
    if (phone !== undefined) userUpdate.phone = phone;
    if (email !== undefined) userUpdate.email = email;
    if (address !== undefined) userUpdate.address = address;

    if (Object.keys(userUpdate).length > 0) {
      await MongoUser.updateOne({ _id: userId }, { $set: userUpdate }).session(session);
    }

    // 更新 MongoTeamMember 的 name
    if (name !== undefined) {
      const tmb = await MongoTeamMember.findOne({ userId: user._id }).session(session);
      if (tmb) {
        await MongoTeamMember.updateOne({ _id: tmb._id }, { $set: { name } }).session(session);
      }
    }
  });

  // Requirement 5.3: 密码更新
  // 管理员输入的是明文密码，需要模拟前端+后端双重哈希流程：
  // hashStr(hashStr(明文)) 与登录验证逻辑一致
  // 绕过 Mongoose schema setter，直接写入数据库（与 updatePasswordByOld 保持一致）
  if (newPassword !== undefined && newPassword !== '') {
    const hashedPassword = hashStr(hashStr(newPassword));
    await connectionMongo.connection.db
      .collection('users')
      .updateOne(
        { _id: user._id },
        {
          $set: {
            password: hashedPassword,
            passwordUpdateTime: new Date()
          }
        }
      );
  }

  // Requirement 5.2: 同步到鲁港通后端（失败仅记录日志）
  updateUserInBackend(user.username, {
    username: user.username,
    display_name: name || nickname,
    email,
    phone
  }).catch((err) => {
    addLog.error('鲁港通后端用户信息同步失败（管理员操作）', {
      username: user.username,
      error: err
    });
  });

  return jsonRes(res, { data: { success: true } });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      return await handleGet(req, res);
    }
    if (req.method === 'PUT') {
      return await handlePut(req, res);
    }
    return jsonRes(res, { code: 405, error: 'Method not allowed' });
  } catch (error: any) {
    addLog.error('鲁港通管理员用户详情接口错误', error);
    return jsonRes(res, {
      code: 500,
      error: error.message || '操作失败'
    });
  }
}
