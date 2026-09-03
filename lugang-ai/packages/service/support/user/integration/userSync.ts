/**
 * 鲁港通 - 用户同步服务
 * 用于与鲁港通后端进行用户同步
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import axios, { type AxiosError } from 'axios';
import { getLogger, LogCategories } from '../../../common/logger';

// 鲁港通 - 适配 4.16.2 OpenTelemetry logger：保留 addLog 名称（方法签名 (msg, data) 与原一致）
const addLog = getLogger(LogCategories.MODULE.USER.ACCOUNT);

/**
 * 用户同步数据接口
 */
export interface UserSyncData {
  username: string;
  password?: string; // 注册时需要，更新时可选
  display_name?: string;
  email?: string;
  phone?: string;
}

/**
 * 鲁港通后端用户响应接口
 */
export interface LugangBackendUser {
  id: number;
  username: string;
  display_name: string;
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 鲁港通后端 API 响应接口
 */
interface LugangBackendResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * 获取鲁港通后端配置
 */
const getBackendConfig = (): { url: string; token: string } | null => {
  const url = process.env.ONE_API_URL;
  const token = process.env.ONE_API_TOKEN;

  if (!url || !token) {
    addLog.warn('鲁港通后端配置不完整，跳过用户同步', {
      hasUrl: !!url,
      hasToken: !!token
    });
    return null;
  }

  return { url, token };
};

/**
 * 创建 axios 请求配置
 */
const createRequestConfig = (token: string) => ({
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

/**
 * 处理同步错误
 */
const handleSyncError = (operation: string, username: string, error: any): void => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<LugangBackendResponse>;
    
    // 如果是用户已存在的错误，记录为 info 级别
    if (
      axiosError.response?.data?.message?.includes('already exists') ||
      axiosError.response?.data?.message?.includes('已存在')
    ) {
      addLog.info(`鲁港通后端用户已存在: ${operation}`, { username });
      return;
    }

    addLog.error(`鲁港通后端${operation}失败`, {
      username,
      status: axiosError.response?.status,
      message: axiosError.response?.data?.message || axiosError.message
    });
  } else {
    addLog.error(`鲁港通后端${operation}失败`, {
      username,
      error: error.message || String(error)
    });
  }
};

/**
 * 在鲁港通后端创建用户
 * Requirement 5.1: 新用户注册时在后端创建对应用户
 * Requirement 5.2: 同步 username, email, phone, display_name
 * Requirement 5.4: 同步失败不阻塞用户操作
 * 
 * @param userData 用户数据
 * @returns Promise<boolean> 是否成功
 */
export const createUserInBackend = async (userData: UserSyncData): Promise<boolean> => {
  const config = getBackendConfig();
  if (!config) {
    return false;
  }

  try {
    // 鲁港通后端 username 字段最大12位，不接受完整邮箱
    // 邮箱注册：取 @ 前面部分，超过10位则截断，加2位数字后缀保证唯一性
    // 手机号注册：直接用手机号（11位，超过12位限制，取后10位）
    let backendUsername: string;
    if (userData.username.includes('@')) {
      const prefix = userData.username.split('@')[0].slice(0, 10);
      const suffix = userData.username.charCodeAt(userData.username.length - 1) % 100;
      backendUsername = `${prefix}${suffix}`.slice(0, 12);
    } else {
      // 手机号取后10位
      backendUsername = userData.username.slice(-10);
    }

    const response = await axios.post<LugangBackendResponse<LugangBackendUser>>(
      `${config.url}/api/user/register`,
      {
        username: backendUsername,
        password: userData.password,
        display_name: userData.display_name || backendUsername,
        email: userData.email || (userData.username.includes('@') ? userData.username : undefined),
        phone: userData.phone
      },
      createRequestConfig(config.token)
    );

    if (response.data?.success) {
      addLog.info('鲁港通后端用户创建成功', {
        username: userData.username,
        userId: response.data.data?.id
      });
      return true;
    } else {
      addLog.warn('鲁港通后端用户创建返回异常', {
        username: userData.username,
        response: response.data
      });
      return false;
    }
  } catch (error: any) {
    handleSyncError('用户创建', userData.username, error);
    return false;
  }
};

/**
 * 在鲁港通后端更新用户信息
 * Requirement 5.3: 用户信息更新时同步到后端
 * Requirement 5.4: 同步失败不阻塞用户操作
 * 
 * @param username 用户名
 * @param updateData 更新数据
 * @returns Promise<boolean> 是否成功
 */
export const updateUserInBackend = async (
  username: string,
  updateData: Partial<UserSyncData>
): Promise<boolean> => {
  const config = getBackendConfig();
  if (!config) {
    return false;
  }

  try {
    // 首先获取用户 ID
    const user = await getUserFromBackend(username);
    if (!user) {
      addLog.warn('鲁港通后端用户不存在，无法更新', { username });
      return false;
    }

    // 更新用户信息
    const response = await axios.put<LugangBackendResponse>(
      `${config.url}/api/user/${user.id}`,
      {
        display_name: updateData.display_name,
        email: updateData.email,
        phone: updateData.phone
      },
      createRequestConfig(config.token)
    );

    if (response.data?.success) {
      addLog.info('鲁港通后端用户更新成功', {
        username,
        userId: user.id
      });
      return true;
    } else {
      addLog.warn('鲁港通后端用户更新返回异常', {
        username,
        response: response.data
      });
      return false;
    }
  } catch (error: any) {
    handleSyncError('用户更新', username, error);
    return false;
  }
};

/**
 * 从鲁港通后端获取用户信息
 * 
 * @param username 用户名
 * @returns Promise<LugangBackendUser | null> 用户信息或 null
 */
export const getUserFromBackend = async (
  username: string
): Promise<LugangBackendUser | null> => {
  const config = getBackendConfig();
  if (!config) {
    return null;
  }

  try {
    const response = await axios.get<LugangBackendResponse<LugangBackendUser>>(
      `${config.url}/api/user/search`,
      {
        params: { username },
        ...createRequestConfig(config.token)
      }
    );

    if (response.data?.success && response.data.data) {
      return response.data.data;
    }

    return null;
  } catch (error: any) {
    handleSyncError('用户查询', username, error);
    return null;
  }
};

/**
 * 更新鲁港通后端用户密码
 * 
 * @param userId 用户 ID
 * @param password 新密码（前端哈希后的值）
 * @returns Promise<boolean> 是否成功
 */
export const updateUserPasswordInBackend = async (
  userId: number,
  password: string
): Promise<boolean> => {
  const config = getBackendConfig();
  if (!config) {
    return false;
  }

  try {
    const response = await axios.put<LugangBackendResponse>(
      `${config.url}/api/user/${userId}/password`,
      { password },
      createRequestConfig(config.token)
    );

    if (response.data?.success) {
      addLog.info('鲁港通后端用户密码更新成功', { userId });
      return true;
    } else {
      addLog.warn('鲁港通后端用户密码更新返回异常', {
        userId,
        response: response.data
      });
      return false;
    }
  } catch (error: any) {
    handleSyncError('密码更新', `userId:${userId}`, error);
    return false;
  }
};

/**
 * 检查鲁港通后端用户是否存在
 * 
 * @param username 用户名
 * @returns Promise<boolean> 是否存在
 */
export const checkUserExistsInBackend = async (username: string): Promise<boolean> => {
  const user = await getUserFromBackend(username);
  return user !== null;
};

/**
 * 同步用户到鲁港通后端（创建或更新）
 * 如果用户不存在则创建，存在则更新
 * 
 * @param userData 用户数据
 * @returns Promise<boolean> 是否成功
 */
export const syncUserToBackend = async (userData: UserSyncData): Promise<boolean> => {
  const exists = await checkUserExistsInBackend(userData.username);

  if (exists) {
    // 用户已存在，更新信息
    return await updateUserInBackend(userData.username, userData);
  } else {
    // 用户不存在，创建新用户
    return await createUserInBackend(userData);
  }
};
