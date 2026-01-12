/**
 * 鲁港通 - One API 集成服务
 * 用于与 One API 系统进行用户同步、额度查询等操作
 */

import { addLog } from '@fastgpt/service/common/system/log';

// One API 配置
const ONE_API_BASE_URL = process.env.ONE_API_URL || 'http://localhost:8080';
const ONE_API_TOKEN = process.env.ONE_API_TOKEN || '';

// One API 用户类型
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

// One API 响应类型
interface OneApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * One API 请求封装
 */
async function oneApiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<OneApiResponse<T>> {
  const url = `${ONE_API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ONE_API_TOKEN}`,
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      addLog.warn('One API request failed', { url, status: response.status, data });
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
    addLog.error('One API request error', { url, error: error.message });
    return {
      success: false,
      message: error.message || 'Network error',
    };
  }
}

/**
 * 创建 One API 用户
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
  const result = await oneApiRequest<OneApiUser>('/api/user', {
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
    addLog.info('One API user created', { username, displayName });
  }

  return result;
}

/**
 * 查询用户额度
 * @param userId One API 用户 ID
 */
export async function getOneApiUserQuota(userId: number): Promise<OneApiResponse<{ quota: number; used_quota: number }>> {
  const result = await oneApiRequest<OneApiUser>(`/api/user/${userId}`);
  
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
  // One API 没有直接通过用户名查询的接口，需要通过搜索
  const result = await oneApiRequest<{ data: OneApiUser[] }>(`/api/user/search?keyword=${encodeURIComponent(username)}`);
  
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
 * @param userId One API 用户 ID
 * @param quota 新的额度值
 */
export async function updateOneApiUserQuota(userId: number, quota: number): Promise<OneApiResponse> {
  const result = await oneApiRequest(`/api/user`, {
    method: 'PUT',
    body: JSON.stringify({
      id: userId,
      quota,
    }),
  });

  if (result.success) {
    addLog.info('One API user quota updated', { userId, quota });
  }

  return result;
}

/**
 * 禁用/启用用户
 * @param userId One API 用户 ID
 * @param status 状态：1=启用，2=禁用
 */
export async function updateOneApiUserStatus(userId: number, status: 1 | 2): Promise<OneApiResponse> {
  const result = await oneApiRequest(`/api/user`, {
    method: 'PUT',
    body: JSON.stringify({
      id: userId,
      status,
    }),
  });

  if (result.success) {
    addLog.info('One API user status updated', { userId, status });
  }

  return result;
}

/**
 * 删除用户
 * @param userId One API 用户 ID
 */
export async function deleteOneApiUser(userId: number): Promise<OneApiResponse> {
  const result = await oneApiRequest(`/api/user/${userId}`, {
    method: 'DELETE',
  });

  if (result.success) {
    addLog.info('One API user deleted', { userId });
  }

  return result;
}

/**
 * 检查 One API 服务是否可用
 */
export async function checkOneApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${ONE_API_BASE_URL}/api/status`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 同步用户到 One API（如果用户不存在则创建）
 * 用于用户首次登录时自动创建 One API 账户
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
    addLog.info('One API user already exists', { username });
    return existingUser;
  }
  
  // 用户不存在，创建新用户
  // 生成随机密码（用户通过 FastGPT 登录，不需要知道 One API 密码）
  const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
  
  const result = await createOneApiUser(username, randomPassword, displayName, initialQuota);
  
  if (result.success) {
    addLog.info('One API user synced successfully', { username, displayName });
  } else {
    addLog.warn('Failed to sync user to One API', { username, error: result.message });
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
