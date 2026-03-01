/**
 * 鲁港通 - 充值套餐服务
 * 用于从鲁港通后端获取充值套餐信息
 * 
 * Requirements: 10.1
 */

import axios, { type AxiosError } from 'axios';
import { addLog } from '@fastgpt/service/common/system/log';

/**
 * 充值套餐接口
 * Requirement 10.1: 显示可用充值套餐列表
 */
export interface RechargePackage {
  id: string;                 // 套餐 ID
  name: string;               // 套餐名称（如：基础套餐、标准套餐、高级套餐）
  amount: number;             // 充值金额（单位：元）
  bonus: number;              // 赠送金额（单位：元）
  total_amount: number;       // 实际到账金额（amount + bonus）
  quota: number;              // 配额数量（单位：次数或 tokens）
  quota_unit: string;         // 配额单位（如：次、tokens）
  description?: string;       // 套餐描述
  features?: string[];        // 套餐特性列表
  is_popular?: boolean;       // 是否为热门套餐
  discount_percentage?: number; // 折扣百分比（如：10 表示 9 折）
  original_price?: number;    // 原价（用于显示折扣）
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
    addLog.warn('鲁港通后端配置不完整，无法查询充值套餐', {
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
const handleApiError = (operation: string, error: any): void => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<LugangBackendResponse>;
    addLog.error(`鲁港通后端${operation}失败`, {
      status: axiosError.response?.status,
      message: axiosError.response?.data?.message || axiosError.message
    });
  } else {
    addLog.error(`鲁港通后端${operation}失败`, {
      error: error.message || String(error)
    });
  }
};

/**
 * 获取可用充值套餐列表
 * Requirement 10.1: 显示可用充值套餐列表
 * 
 * @returns Promise<RechargePackage[]> 充值套餐列表
 */
export const getRechargePackages = async (): Promise<RechargePackage[]> => {
  const config = getBackendConfig();
  if (!config) {
    return [];
  }

  try {
    const response = await axios.get<LugangBackendResponse<RechargePackage[]>>(
      `${config.url}/api/recharge/packages`,
      createRequestConfig(config.token)
    );

    if (response.data?.success && response.data.data) {
      addLog.info('鲁港通后端充值套餐查询成功', {
        count: response.data.data.length
      });
      return response.data.data;
    }

    addLog.warn('鲁港通后端充值套餐查询返回空');
    return [];
  } catch (error: any) {
    handleApiError('充值套餐查询', error);
    return [];
  }
};

/**
 * 获取单个充值套餐详情
 * 
 * @param packageId 套餐 ID
 * @returns Promise<RechargePackage | null> 充值套餐详情或 null
 */
export const getRechargePackageById = async (
  packageId: string
): Promise<RechargePackage | null> => {
  const config = getBackendConfig();
  if (!config) {
    return null;
  }

  try {
    const response = await axios.get<LugangBackendResponse<RechargePackage>>(
      `${config.url}/api/recharge/packages/${packageId}`,
      createRequestConfig(config.token)
    );

    if (response.data?.success && response.data.data) {
      addLog.info('鲁港通后端充值套餐详情查询成功', { packageId });
      return response.data.data;
    }

    addLog.warn('鲁港通后端充值套餐详情查询返回空', { packageId });
    return null;
  } catch (error: any) {
    handleApiError('充值套餐详情查询', error);
    return null;
  }
};

/**
 * 计算套餐折扣信息
 * 
 * @param pkg 充值套餐
 * @returns 折扣信息对象
 */
export const calculatePackageDiscount = (pkg: RechargePackage): {
  hasDiscount: boolean;
  discountText: string | null;
  savingsAmount: number;
} => {
  const hasDiscount = !!pkg.discount_percentage && pkg.discount_percentage > 0;
  
  if (!hasDiscount || !pkg.original_price) {
    return {
      hasDiscount: false,
      discountText: null,
      savingsAmount: 0
    };
  }

  const savingsAmount = pkg.original_price - pkg.amount;
  const discountText = `${(10 - pkg.discount_percentage / 10).toFixed(1)}折`;

  return {
    hasDiscount: true,
    discountText,
    savingsAmount
  };
};

/**
 * 格式化金额显示
 * 
 * @param amount 金额
 * @returns 格式化后的金额字符串
 */
export const formatAmount = (amount: number): string => {
  return `¥${amount.toFixed(2)}`;
};

/**
 * 格式化配额显示
 * 
 * @param quota 配额数量
 * @param unit 配额单位
 * @returns 格式化后的配额字符串
 */
export const formatQuota = (quota: number, unit: string): string => {
  if (quota >= 10000) {
    return `${(quota / 10000).toFixed(1)}万${unit}`;
  }
  return `${quota}${unit}`;
};
