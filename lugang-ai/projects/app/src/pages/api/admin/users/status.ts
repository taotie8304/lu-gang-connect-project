/**
 * 鲁港通 - 管理员用户状态管理接口
 *
 * POST /api/admin/users/status
 *
 * 禁用/启用用户
 *（N3 已摘除 One API 联动：状态同步已移除）
 * 适配 4.16.2：ApiRequestProps 来自 @fastgpt/next/type
 */

import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { UserStatusEnum } from '@fastgpt/global/support/user/constant';

export type AdminUserStatusQuery = {};

export type AdminUserStatusBody = {
  userId: string;
  status: 'active' | 'forbidden';
};

export type AdminUserStatusResponse = {
  success: boolean;
  message: string;
};

async function handler(
  req: ApiRequestProps<AdminUserStatusBody, AdminUserStatusQuery>,
  _res: ApiResponseType<AdminUserStatusResponse>
): Promise<AdminUserStatusResponse> {
  // 验证管理员权限
  const { isRoot } = await authCert({ req, authToken: true, authRoot: true });

  if (!isRoot) {
    throw new Error('Permission denied: Admin access required');
  }

  const { userId, status } = req.body;

  if (!userId || !status) {
    throw new Error('Missing required parameters: userId and status');
  }

  if (!['active', 'forbidden'].includes(status)) {
    throw new Error('Invalid status value');
  }

  // 查找用户
  const user = await MongoUser.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // 不允许禁用 root 用户
  if (user.username === 'root') {
    throw new Error('Cannot modify root user status');
  }

  // 更新 FastGPT 用户状态
  const fastgptStatus = status === 'active' ? UserStatusEnum.active : UserStatusEnum.forbidden;
  await MongoUser.updateOne(
    { _id: userId },
    { status: fastgptStatus }
  );

  return {
    success: true,
    message: `User ${status === 'active' ? 'enabled' : 'disabled'} successfully`
  };
}

export default NextAPI(handler);
