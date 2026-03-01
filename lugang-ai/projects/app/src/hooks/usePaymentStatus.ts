/**
 * 鲁港通 - 支付状态轮询 Hook
 * 用于轮询检查支付结果并刷新账户信息
 * Requirements: 10.4, 10.5
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { PaymentStatus } from '@fastgpt/service/support/payment/types';

interface PaymentStatusData {
  order_id: string;
  status: PaymentStatus;
  amount: number;
  payment_method: string;
  created_at: string;
  paid_at?: string;
  expired_at?: string;
  is_success: boolean;
  is_failed: boolean;
  is_pending: boolean;
}

interface UsePaymentStatusOptions {
  orderId: string | null;           // 订单 ID
  onSuccess?: () => void;            // 支付成功回调
  onFailed?: () => void;             // 支付失败回调
  pollingInterval?: number;          // 轮询间隔（毫秒）
  maxPollingTime?: number;           // 最大轮询时间（毫秒）
  enabled?: boolean;                 // 是否启用轮询
}

interface UsePaymentStatusReturn {
  status: PaymentStatus | null;     // 当前支付状态
  isPolling: boolean;                // 是否正在轮询
  isSuccess: boolean;                // 是否支付成功
  isFailed: boolean;                 // 是否支付失败
  isPending: boolean;                // 是否待支付
  orderData: PaymentStatusData | null; // 订单数据
  startPolling: () => void;          // 开始轮询
  stopPolling: () => void;           // 停止轮询
}

/**
 * 支付状态轮询 Hook
 * Requirement 10.5: 轮询检查支付结果并刷新显示
 */
export const usePaymentStatus = (options: UsePaymentStatusOptions): UsePaymentStatusReturn => {
  const {
    orderId,
    onSuccess,
    onFailed,
    pollingInterval = 3000,      // 默认 3 秒轮询一次
    maxPollingTime = 300000,     // 默认最多轮询 5 分钟
    enabled = true
  } = options;

  const { toast } = useToast();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [orderData, setOrderData] = useState<PaymentStatusData | null>(null);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const hasNotifiedRef = useRef<boolean>(false);

  // 查询支付状态
  const checkPaymentStatus = useCallback(async () => {
    if (!orderId) {
      return;
    }

    try {
      const response = await fetch(`/api/payment/status?order_id=${orderId}`);
      const data = await response.json();

      if (data.code === 200 && data.data) {
        const orderStatus = data.data as PaymentStatusData;
        setStatus(orderStatus.status);
        setOrderData(orderStatus);

        // Requirement 10.5: 支付成功处理
        if (orderStatus.is_success && !hasNotifiedRef.current) {
          hasNotifiedRef.current = true;
          toast({
            status: 'success',
            title: '支付成功',
            description: `已成功充值 ¥${orderStatus.amount.toFixed(2)}`
          });
          stopPolling();
          onSuccess?.();
        }

        // Requirement 10.5: 支付失败处理
        if (orderStatus.is_failed && !hasNotifiedRef.current) {
          hasNotifiedRef.current = true;
          toast({
            status: 'error',
            title: '支付失败',
            description: '支付未完成，请重试'
          });
          stopPolling();
          onFailed?.();
        }

        // 如果不是待支付状态，停止轮询
        if (!orderStatus.is_pending) {
          stopPolling();
        }
      }
    } catch (error: any) {
      console.error('查询支付状态失败:', error);
    }
  }, [orderId, onSuccess, onFailed, toast]);

  // 开始轮询
  const startPolling = useCallback(() => {
    if (!orderId || !enabled) {
      return;
    }

    setIsPolling(true);
    startTimeRef.current = Date.now();
    hasNotifiedRef.current = false;

    // 立即查询一次
    checkPaymentStatus();

    // 设置定时轮询
    pollingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;

      // 超过最大轮询时间，停止轮询
      if (elapsed >= maxPollingTime) {
        toast({
          status: 'warning',
          title: '支付超时',
          description: '支付确认超时，请稍后在订单记录中查看'
        });
        stopPolling();
        return;
      }

      checkPaymentStatus();
    }, pollingInterval);
  }, [orderId, enabled, pollingInterval, maxPollingTime, checkPaymentStatus, toast]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // 自动开始轮询
  useEffect(() => {
    if (orderId && enabled) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [orderId, enabled, startPolling, stopPolling]);

  return {
    status,
    isPolling,
    isSuccess: orderData?.is_success ?? false,
    isFailed: orderData?.is_failed ?? false,
    isPending: orderData?.is_pending ?? false,
    orderData,
    startPolling,
    stopPolling
  };
};
