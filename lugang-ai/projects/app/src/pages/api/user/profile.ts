/**
 * 鲁港通 - 用户个人资料 API
 * GET: 获取当前用户的个人资料
 * PUT: 更新当前用户的个人资料
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { updateUserInBackend } from '@fastgpt/service/support/user/integration/userSync';
import { addLog } from '@fastgpt/service/common/system/log';

/** 邮箱格式校验：含 @ 且有域名 */
export function validateEmail(email: string): boolean {
  if (!email) return true; // 可选字段，空值合法
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return local.length > 0 && domain.length > 0 && domain.includes('.');
}

/** 手机号格式校验：7-15位纯数字 */
export function validatePhone(phone: string): boolean {
  if (!phone) return true; // 可选字段，空值合法
  return /^\d{7,15}$/.test(phone);
}

export type UserProfile = {
  name: string;
  nickname?: string;
  phone?: string;
  email?: string;
  address?: string;
};

export type UpdateProfileBody = {
  name?: string;
  nickname?: string;
  phone?: string;
  email?: string;
  address?: string;
};

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { tmbId } = await authCert({ req, authToken: true });

  const tmb = await MongoTeamMember.findById(tmbId);
  if (!tmb) {
    return jsonRes(res, { code: 404, error: '用户信息不存在' });
  }

  const user = await MongoUser.findById(tmb.userId);
  if (!user) {
    return jsonRes(res, { code: 404, error: '用户不存在' });
  }

  const profile: UserProfile = {
    name: tmb.name || '',
    nickname: user.nickname || tmb.name || '',
    phone: user.phone || '',
    email: user.email || '',
    address: user.address || ''
  };

  return jsonRes(res, { data: profile });
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  const { tmbId } = await authCert({ req, authToken: true });
  const { name, nickname, phone, email, address } = req.body as UpdateProfileBody;

  // 校验邮箱格式 (Requirement 2.4)
  if (email !== undefined && !validateEmail(email)) {
    return jsonRes(res, { code: 400, error: '邮箱格式不合法' });
  }

  // 校验手机号格式 (Requirement 2.5)
  if (phone !== undefined && !validatePhone(phone)) {
    return jsonRes(res, { code: 400, error: '手机号格式不合法（需7-15位数字）' });
  }

  const tmb = await MongoTeamMember.findById(tmbId);
  if (!tmb) {
    return jsonRes(res, { code: 404, error: '用户信息不存在' });
  }

  const userId = tmb.userId;
  let username: string | undefined;

  // Requirement 2.2: 保存到鲁港通前端数据库
  await mongoSessionRun(async (session) => {
    // 更新 MongoUser 字段
    const userUpdate: Record<string, any> = {};
    if (nickname !== undefined) userUpdate.nickname = nickname;
    if (phone !== undefined) userUpdate.phone = phone;
    if (email !== undefined) userUpdate.email = email;
    if (address !== undefined) userUpdate.address = address;

    if (Object.keys(userUpdate).length > 0) {
      await MongoUser.updateOne({ _id: userId }, { $set: userUpdate }).session(session);
    }

    // 更新 MongoTeamMember 的 name 字段
    if (name !== undefined) {
      await MongoTeamMember.updateOne({ _id: tmbId }, { $set: { name } }).session(session);
    }

    const user = await MongoUser.findById(userId).session(session);
    username = user?.username;
  });

  // Requirement 2.3: 同步到鲁港通后端（失败仅记录日志）
  if (username) {
    updateUserInBackend(username, {
      username,
      display_name: name || nickname,
      email,
      phone
    }).catch((err) => {
      addLog.error('鲁港通后端用户信息同步失败', { username, error: err });
    });
  }

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
    addLog.error('鲁港通用户资料接口错误', error);
    return jsonRes(res, {
      code: 500,
      error: error.message || '操作失败'
    });
  }
}
