/**
 * 鲁港通 - 管理员用户状态管理接口
 * 
 * POST /api/admin/users/status
 * 
 * 禁用/启用用户，同步到鲁港通后端
 */

import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoUser } from '@fastgpt/service/support/user/schema';
import { UserStatusEnum } from '@fastgpt/global/support/user/constant';
import { updateOneApiUserStatus, getOneApiUserByUsername } from '@/service/integration/oneapi';
import { addLog } from '@fastgpt/service/common/system/log';

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

  // 同步到鲁港通后端
  try {
    const oneApiUser = await getOneApiUserByUsername(user.username);
    if (oneApiUser.success && oneApiUser.data) {
      const oneApiStatus = status === 'active' ? 1 : 2; // 鲁港通后端: 1=启用, 2=禁用
      await updateOneApiUserStatus(oneApiUser.data.id, oneApiStatus);
      addLog.info('鲁港通后端用户状态同步成功', { userId, username: user.username, status });
    }
  } catch (error) {
    // 鲁港通后端同步失败不影响主流程，仅记录日志
    addLog.warn('鲁港通后端用户状态同步失败', { userId, error });
  }

  return {
    success: true,
    message: `User ${status === 'active' ? 'enabled' : 'disabled'} successfully`
  };
}

export default NextAPI(handler);
