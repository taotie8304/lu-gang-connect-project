/**
 * 鲁港通 - 管理员用户详情接口
 * GET: 获取指定用户的完整信息（含额度）
 * PUT: 更新指定用户信息（含密码重置）
 * Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.7
 *
 * 适配 4.16.2：
 * - 由裸 NextApiRequest handler + jsonRes 改造为 NextAPI + req.method 切换（与 admin/config/register.ts 一致）；
 * - ApiRequestProps 来自 @fastgpt/next/type；addLog 改用 OpenTelemetry logger；
 * - 邮箱/手机号/地址校验复用 @fastgpt/global/support/user/validation 的 validateUserProfile
 *   （4.16.2 无 @/pages/api/user/profile，且手机号统一为中国大陆 11 位，与注册校验保持一致）。
 */

import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';
import { connectionMongo } from '@fastgpt/service/common/mongo';
import { updateUserInBackend } from '@fastgpt/service/support/user/integration/userSync';
import { getOneApiUserByUsername } from '@/service/integration/oneapi';
import { validateUserProfile } from '@fastgpt/global/support/user/validation';
import { hashStr } from '@fastgpt/global/common/string/tools';
// 鲁港通 - 4.16.2 使用 OpenTelemetry logger 取代旧 addLog
import { getLogger, LogCategories } from '@fastgpt/service/common/logger';

const addLog = getLogger(LogCategories.MODULE.USER.ACCOUNT);

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

export type AdminUserDetailQuery = {
  userId?: string;
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

/** GET：获取用户完整信息（含鲁港通后端额度，失败返回 null） */
async function handleGet(
  req: ApiRequestProps<AdminUpdateUserBody, AdminUserDetailQuery>
): Promise<AdminUserDetail> {
  const userId = req.query.userId;
  if (!userId) {
    throw new Error('缺少 userId 参数');
  }

  const user = await MongoUser.findById(userId);
  if (!user) {
    throw new Error('用户不存在');
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

  return {
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
}

/** PUT：更新用户信息（含密码重置），同步到鲁港通后端 */
async function handlePut(
  req: ApiRequestProps<AdminUpdateUserBody, AdminUserDetailQuery>
): Promise<{ success: boolean }> {
  const { userId, name, nickname, phone, email, address, newPassword } = req.body;

  if (!userId) {
    throw new Error('缺少 userId 参数');
  }

  const user = await MongoUser.findById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  // Requirement 5.7: 禁止修改 root 用户
  if (user.username === 'root') {
    throw new Error('不允许修改 root 用户信息');
  }

  // 校验邮箱/手机号/地址格式（空值表示不修改或清空，跳过校验）
  const profileCheck = validateUserProfile({ email, phone, address });
  if (!profileCheck.valid) {
    throw new Error(profileCheck.error || '用户资料格式不合法');
  }

  // Requirement 5.5: 密码长度校验
  if (newPassword !== undefined && newPassword !== '' && !validatePassword(newPassword)) {
    throw new Error('密码长度至少 8 位');
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
    // 鲁港通 - 与官方 gridfs/image controller 一致，用非空断言访问原始集合（未连接时抛错而非静默跳过）
    await connectionMongo.connection.db!
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

  return { success: true };
}

async function handler(
  req: ApiRequestProps<AdminUpdateUserBody, AdminUserDetailQuery>,
  _res: ApiResponseType<AdminUserDetail | { success: boolean }>
): Promise<AdminUserDetail | { success: boolean }> {
  // 验证管理员权限（GET/PUT 均要求 root）
  const { isRoot } = await authCert({ req, authToken: true, authRoot: true });
  if (!isRoot) {
    throw new Error('需要管理员权限');
  }

  if (req.method === 'GET') {
    return handleGet(req);
  }
  if (req.method === 'PUT') {
    return handlePut(req);
  }
  throw new Error('Method not allowed');
}

export default NextAPI(handler);
