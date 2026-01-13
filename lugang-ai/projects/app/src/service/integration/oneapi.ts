/**
 * 鲁港通 - 鲁港通后端集成服务
 * 用于与鲁港通后端（鲁港通跨境AI智能服务后端）进行用户同步、额度查询等操作
 */

import { addLog } from '@fastgpt/service/common/system/log';

// 鲁港通后端配置
const LUGANG_BACKEND_URL = process.env.ONE_API_URL || 'http://localhost:8080';
const LUGANG_BACKEND_TOKEN = process.env.ONE_API_TOKEN || '';

// 鲁港通后端用户类型
export interface OneApiUser {
  id: number;
  username: string;
  password?: string;
  display_name: string;
  email: string;
  role: number;
  status: number;
  quota: number;
  used_quota: number;
  request_count: number;
  group: string;
  aff_code: string;
  inviter_id: number;
}

// 鲁港通后端响应类型
interface OneApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * 鲁港通后端请求封装
 */
async function lugangBackendRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<OneApiResponse<T>> {
  const url = `${LUGANG_BACKEND_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LUGANG_BACKEND_TOKEN}`,
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      addLog.warn('鲁港通后端请求失败', { url, status: response.status, data });
      return {
        success: false,
        message: data.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      message: 'success',
      data,
    };
  } catch (error: any) {
    addLog.error('鲁港通后端请求错误', { url, error: error.message });
    return {
      success: false,
      message: error.message || 'Network error',
    };
  }
}

/**
 * 创建鲁港通后端用户
 * @param username 用户名（通常使用邮箱）
 * @param password 密码
 * @param displayName 显示名称
 * @param initialQuota 初始额度（默认 10000）
 */
export async function createOneApiUser(
  username: string,
  password: string,
  displayName: string,
  initialQuota: number = 10000
): Promise<OneApiResponse<OneApiUser>> {
  const result = await lugangBackendRequest<OneApiUser>('/api/user', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      display_name: displayName,
      email: username,
      quota: initialQuota,
      group: 'default',
    }),
  });

  if (result.success) {
    addLog.info('鲁港通后端用户创建成功', { username, displayName });
  }

  return result;
}

/**
 * 查询用户额度
 * @param userId 鲁港通后端用户 ID
 */
export async function getOneApiUserQuota(userId: number): Promise<OneApiResponse<{ quota: number; used_quota: number }>> {
  const result = await lugangBackendRequest<OneApiUser>(`/api/user/${userId}`);
  
  if (result.success && result.data) {
    return {
      success: true,
      message: 'success',
      data: {
        quota: result.data.quota,
        used_quota: result.data.used_quota,
      },
    };
  }

  return {
    success: false,
    message: result.message,
  };
}

/**
 * 通过用户名查询用户
 * @param username 用户名
 */
export async function getOneApiUserByUsername(username: string): Promise<OneApiResponse<OneApiUser>> {
  // 鲁港通后端没有直接通过用户名查询的接口，需要通过搜索
  const result = await lugangBackendRequest<{ data: OneApiUser[] }>(`/api/user/search?keyword=${encodeURIComponent(username)}`);
  
  if (result.success && result.data?.data) {
    const user = result.data.data.find(u => u.username === username || u.email === username);
    if (user) {
      return {
        success: true,
        message: 'success',
        data: user,
      };
    }
  }

  return {
    success: false,
    message: 'User not found',
  };
}

/**
 * 更新用户额度
 * @param userId 鲁港通后端用户 ID
 * @param quota 新的额度值
 */
export async function updateOneApiUserQuota(userId: number, quota: number): Promise<OneApiResponse> {
  const result = await lugangBackendRequest(`/api/user`, {
    method: 'PUT',
    body: JSON.stringify({
      id: userId,
      quota,
    }),
  });

  if (result.success) {
    addLog.info('鲁港通后端用户额度更新成功', { userId, quota });
  }

  return result;
}

/**
 * 禁用/启用用户
 * @param userId 鲁港通后端用户 ID
 * @param status 状态：1=启用，2=禁用
 */
export async function updateOneApiUserStatus(userId: number, status: 1 | 2): Promise<OneApiResponse> {
  const result = await lugangBackendRequest(`/api/user`, {
    method: 'PUT',
    body: JSON.stringify({
      id: userId,
      status,
    }),
  });

  if (result.success) {
    addLog.info('鲁港通后端用户状态更新成功', { userId, status });
  }

  return result;
}

/**
 * 删除用户
 * @param userId 鲁港通后端用户 ID
 */
export async function deleteOneApiUser(userId: number): Promise<OneApiResponse> {
  const result = await lugangBackendRequest(`/api/user/${userId}`, {
    method: 'DELETE',
  });

  if (result.success) {
    addLog.info('鲁港通后端用户删除成功', { userId });
  }

  return result;
}

/**
 * 检查鲁港通后端服务是否可用
 */
export async function checkOneApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${LUGANG_BACKEND_URL}/api/status`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 同步用户到鲁港通后端（如果用户不存在则创建）
 * 用于用户首次登录时自动创建鲁港通后端账户
 * @param username 用户名（通常是邮箱）
 * @param displayName 显示名称
 * @param initialQuota 初始额度（默认 10000）
 */
export async function syncUserToOneApi(
  username: string,
  displayName: string,
  initialQuota: number = 10000
): Promise<OneApiResponse<OneApiUser>> {
  // 先检查用户是否已存在
  const existingUser = await getOneApiUserByUsername(username);
  
  if (existingUser.success && existingUser.data) {
    addLog.info('鲁港通后端用户已存在', { username });
    return existingUser;
  }
  
  // 用户不存在，创建新用户
  // 生成随机密码（用户通过鲁港通前端登录，不需要知道鲁港通后端密码）
  const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
  
  const result = await createOneApiUser(username, randomPassword, displayName, initialQuota);
  
  if (result.success) {
    addLog.info('鲁港通后端用户同步成功', { username, displayName });
  } else {
    addLog.warn('鲁港通后端用户同步失败', { username, error: result.message });
  }
  
  return result;
}

export default {
  createOneApiUser,
  getOneApiUserQuota,
  getOneApiUserByUsername,
  updateOneApiUserQuota,
  updateOneApiUserStatus,
  deleteOneApiUser,
  checkOneApiHealth,
  syncUserToOneApi,
};
