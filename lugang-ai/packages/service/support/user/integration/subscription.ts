/**
 * 鲁港通 - 订阅和余额查询服务
 * 用于从鲁港通后端获取用户订阅和余额信息
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import axios, { type AxiosError } from 'axios';
import { addLog } from '@fastgpt/service/common/system/log';

/**
 * 订阅计划状态
 */
export enum SubscriptionStatus {
  Active = 'active',
  Expired = 'expired',
  Cancelled = 'cancelled',
  Trial = 'trial'
}

/**
 * 订阅信息接口
 * Requirement 9.2: 显示计划名称、状态、到期日期
 */
export interface SubscriptionInfo {
  plan_name: string;          // 计划名称（如：基础版、专业版、企业版）
  plan_status: SubscriptionStatus; // 计划状态
  expiration_date: string;    // 到期日期（ISO 8601 格式）
  features?: string[];        // 计划包含的功能列表
}

/**
 * 余额信息接口
 * Requirement 9.3: 显示余额、配额、剩余配额
 */
export interface BalanceInfo {
  current_balance: number;    // 当前余额（单位：元）
  usage_quota: number;        // 使用配额（单位：次数或 tokens）
  remaining_quota: number;    // 剩余配额
  quota_unit: string;         // 配额单位（如：次、tokens）
}

/**
 * 用户账户信息接口（包含订阅和余额）
 */
export interface UserAccountInfo {
  subscription: SubscriptionInfo;
  balance: BalanceInfo;
  user_id: number;
  username: string;
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
    addLog.warn('鲁港通后端配置不完整，无法查询订阅信息', {
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
 * 处理 API 错误
 */
const handleApiError = (operation: string, username: string, error: any): void => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<LugangBackendResponse>;
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
 * 获取用户订阅信息
 * Requirement 9.1: 从鲁港通后端获取订阅信息
 * Requirement 9.2: 返回计划名称、状态、到期日期
 * 
 * @param username 用户名
 * @returns Promise<SubscriptionInfo | null> 订阅信息或 null
 */
export const getUserSubscription = async (
  username: string
): Promise<SubscriptionInfo | null> => {
  const config = getBackendConfig();
  if (!config) {
    return null;
  }

  try {
    const response = await axios.get<LugangBackendResponse<SubscriptionInfo>>(
      `${config.url}/api/user/subscription`,
      {
        params: { username },
        ...createRequestConfig(config.token)
      }
    );

    if (response.data?.success && response.data.data) {
      addLog.info('鲁港通后端订阅信息查询成功', { username });
      return response.data.data;
    }

    addLog.warn('鲁港通后端订阅信息查询返回空', { username });
    return null;
  } catch (error: any) {
    handleApiError('订阅信息查询', username, error);
    return null;
  }
};

/**
 * 获取用户余额信息
 * Requirement 9.1: 从鲁港通后端获取余额信息
 * Requirement 9.3: 返回余额、配额、剩余配额
 * 
 * @param username 用户名
 * @returns Promise<BalanceInfo | null> 余额信息或 null
 */
export const getUserBalance = async (
  username: string
): Promise<BalanceInfo | null> => {
  const config = getBackendConfig();
  if (!config) {
    return null;
  }

  try {
    const response = await axios.get<LugangBackendResponse<BalanceInfo>>(
      `${config.url}/api/user/balance`,
      {
        params: { username },
        ...createRequestConfig(config.token)
      }
    );

    if (response.data?.success && response.data.data) {
      addLog.info('鲁港通后端余额信息查询成功', { username });
      return response.data.data;
    }

    addLog.warn('鲁港通后端余额信息查询返回空', { username });
    return null;
  } catch (error: any) {
    handleApiError('余额信息查询', username, error);
    return null;
  }
};

/**
 * 获取用户完整账户信息（订阅 + 余额）
 * Requirement 9.1: 从鲁港通后端获取订阅和余额信息
 * 
 * @param username 用户名
 * @returns Promise<UserAccountInfo | null> 账户信息或 null
 */
export const getUserAccountInfo = async (
  username: string
): Promise<UserAccountInfo | null> => {
  const config = getBackendConfig();
  if (!config) {
    return null;
  }

  try {
    // 并行请求订阅和余额信息
    const [subscription, balance] = await Promise.all([
      getUserSubscription(username),
      getUserBalance(username)
    ]);

    if (!subscription || !balance) {
      addLog.warn('鲁港通后端账户信息不完整', {
        username,
        hasSubscription: !!subscription,
        hasBalance: !!balance
      });
      return null;
    }

    return {
      subscription,
      balance,
      user_id: 0, // 需要从其他接口获取
      username
    };
  } catch (error: any) {
    handleApiError('账户信息查询', username, error);
    return null;
  }
};

/**
 * 检查余额是否不足
 * Requirement 9.4: 低余额时显示警告
 * 
 * @param balance 余额信息
 * @param threshold 阈值（默认 10%）
 * @returns boolean 是否余额不足
 */
export const isBalanceLow = (balance: BalanceInfo, threshold: number = 0.1): boolean => {
  if (balance.usage_quota === 0) {
    return false; // 无限配额
  }

  const usagePercentage = (balance.usage_quota - balance.remaining_quota) / balance.usage_quota;
  return usagePercentage >= (1 - threshold);
};

/**
 * 获取余额警告信息
 * Requirement 9.4: 低余额时显示警告通知
 * 
 * @param balance 余额信息
 * @returns string | null 警告信息或 null
 */
export const getBalanceWarning = (balance: BalanceInfo): string | null => {
  // 先检查是否完全用尽
  if (balance.remaining_quota <= 0) {
    return `您的配额已用尽，请充值后继续使用。`;
  }

  // 再检查是否即将用尽
  if (isBalanceLow(balance, 0.1)) {
    const percentage = Math.round((balance.remaining_quota / balance.usage_quota) * 100);
    return `您的配额即将用尽，剩余 ${percentage}%（${balance.remaining_quota} ${balance.quota_unit}），请及时充值。`;
  }

  return null;
};

/**
 * 刷新用户账户信息（用于定期更新）
 * Requirement 9.5: 定期刷新订阅/余额信息
 * 
 * @param username 用户名
 * @param onUpdate 更新回调函数
 * @param interval 刷新间隔（毫秒，默认 5 分钟）
 * @returns 清理函数
 */
export const startAccountInfoRefresh = (
  username: string,
  onUpdate: (info: UserAccountInfo | null) => void,
  interval: number = 5 * 60 * 1000
): (() => void) => {
  // 立即执行一次
  getUserAccountInfo(username).then(onUpdate);

  // 定期刷新
  const timer = setInterval(() => {
    getUserAccountInfo(username).then(onUpdate);
  }, interval);

  // 返回清理函数
  return () => {
    clearInterval(timer);
  };
};
