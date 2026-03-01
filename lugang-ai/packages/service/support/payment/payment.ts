/**
 * 鲁港通 - 支付服务
 * 用于处理支付流程和回调
 * 
 * Requirements: 10.2, 10.3, 10.4
 */

import axios, { type AxiosError } from 'axios';
import { addLog } from '@fastgpt/service/common/system/log';
import type {
  PaymentMethod,
  PaymentOrder,
  PaymentRequest,
  PaymentResponse,
  PaymentCallback,
  PaymentVerification,
  PaymentStatus
} from './types';
import { PaymentStatus as Status } from './types';

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
    addLog.warn('鲁港通后端配置不完整，无法处理支付', {
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
  timeout: 30000 // 支付接口超时时间设置为 30 秒
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
 * 创建支付订单
 * Requirement 10.2: 发起支付流程
 * 
 * @param username 用户名
 * @param request 支付请求参数
 * @returns Promise<PaymentResponse | null> 支付响应或 null
 */
export const createPaymentOrder = async (
  username: string,
  request: PaymentRequest
): Promise<PaymentResponse | null> => {
  const config = getBackendConfig();
  if (!config) {
    return null;
  }

  try {
    const response = await axios.post<LugangBackendResponse<PaymentResponse>>(
      `${config.url}/api/payment/create`,
      {
        username,
        ...request
      },
      createRequestConfig(config.token)
    );

    if (response.data?.success && response.data.data) {
      addLog.info('鲁港通支付订单创建成功', {
        username,
        package_id: request.package_id,
        payment_method: request.payment_method,
        order_id: response.data.data.order_id
      });
      return response.data.data;
    }

    addLog.warn('鲁港通支付订单创建返回空', { username });
    return null;
  } catch (error: any) {
    handleApiError('支付订单创建', error);
    return null;
  }
};

/**
 * 查询支付订单状态
 * 
 * @param orderId 订单 ID
 * @returns Promise<PaymentOrder | null> 订单信息或 null
 */
export const getPaymentOrder = async (
  orderId: string
): Promise<PaymentOrder | null> => {
  const config = getBackendConfig();
  if (!config) {
    return null;
  }

  try {
    const response = await axios.get<LugangBackendResponse<PaymentOrder>>(
      `${config.url}/api/payment/order/${orderId}`,
      createRequestConfig(config.token)
    );

    if (response.data?.success && response.data.data) {
      addLog.info('鲁港通支付订单查询成功', { orderId });
      return response.data.data;
    }

    addLog.warn('鲁港通支付订单查询返回空', { orderId });
    return null;
  } catch (error: any) {
    handleApiError('支付订单查询', error);
    return null;
  }
};

/**
 * 验证支付回调
 * Requirement 10.4: 验证支付回调数据
 * 
 * @param callback 支付回调数据
 * @returns Promise<PaymentVerification> 验证结果
 */
export const verifyPaymentCallback = async (
  callback: PaymentCallback
): Promise<PaymentVerification> => {
  const config = getBackendConfig();
  if (!config) {
    return {
      is_valid: false,
      order: null,
      error: '后端配置不完整'
    };
  }

  try {
    const response = await axios.post<LugangBackendResponse<PaymentVerification>>(
      `${config.url}/api/payment/verify`,
      callback,
      createRequestConfig(config.token)
    );

    if (response.data?.success && response.data.data) {
      addLog.info('鲁港通支付回调验证成功', {
        order_id: callback.order_id,
        is_valid: response.data.data.is_valid
      });
      return response.data.data;
    }

    addLog.warn('鲁港通支付回调验证返回空', { order_id: callback.order_id });
    return {
      is_valid: false,
      order: null,
      error: '验证失败'
    };
  } catch (error: any) {
    handleApiError('支付回调验证', error);
    return {
      is_valid: false,
      order: null,
      error: error.message || '验证失败'
    };
  }
};

/**
 * 取消支付订单
 * 
 * @param orderId 订单 ID
 * @returns Promise<boolean> 是否成功
 */
export const cancelPaymentOrder = async (orderId: string): Promise<boolean> => {
  const config = getBackendConfig();
  if (!config) {
    return false;
  }

  try {
    const response = await axios.post<LugangBackendResponse>(
      `${config.url}/api/payment/cancel`,
      { order_id: orderId },
      createRequestConfig(config.token)
    );

    if (response.data?.success) {
      addLog.info('鲁港通支付订单取消成功', { orderId });
      return true;
    }

    addLog.warn('鲁港通支付订单取消失败', { orderId });
    return false;
  } catch (error: any) {
    handleApiError('支付订单取消', error);
    return false;
  }
};

/**
 * 获取支付方式显示名称
 * 
 * @param method 支付方式
 * @returns 显示名称
 */
export const getPaymentMethodName = (method: PaymentMethod): string => {
  const names: Record<PaymentMethod, string> = {
    wechat: '微信支付',
    alipay: '支付宝',
    unionpay: '银联支付'
  };
  return names[method] || method;
};

/**
 * 获取支付状态显示名称
 * 
 * @param status 支付状态
 * @returns 显示名称
 */
export const getPaymentStatusName = (status: PaymentStatus): string => {
  const names: Record<PaymentStatus, string> = {
    pending: '待支付',
    processing: '处理中',
    success: '支付成功',
    failed: '支付失败',
    cancelled: '已取消',
    refunded: '已退款'
  };
  return names[status] || status;
};

/**
 * 检查订单是否已过期
 * 
 * @param order 支付订单
 * @returns 是否已过期
 */
export const isOrderExpired = (order: PaymentOrder): boolean => {
  if (!order.expired_at) {
    return false;
  }

  const expiredTime = new Date(order.expired_at).getTime();
  const now = Date.now();

  return now > expiredTime;
};

/**
 * 格式化订单金额
 * 
 * @param amount 金额
 * @returns 格式化后的金额字符串
 */
export const formatOrderAmount = (amount: number): string => {
  return `¥${amount.toFixed(2)}`;
};
