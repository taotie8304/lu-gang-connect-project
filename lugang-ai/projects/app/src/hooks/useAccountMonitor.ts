/**
 * 鲁港通 - 账户监控 Hook
 * 定期刷新账户信息并在余额不足时显示警告
 * Requirements: 9.4, 9.5
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useUserStore } from '@/web/support/user/useUserStore';
import type { UserAccountInfo } from '@fastgpt/service/support/user/integration/subscription';

interface UseAccountMonitorOptions {
  enabled?: boolean;           // 是否启用监控（默认 true）
  refreshInterval?: number;    // 刷新间隔（毫秒，默认 5 分钟）
  showToast?: boolean;         // 是否显示 Toast 通知（默认 true）
  lowBalanceThreshold?: number; // 低余额阈值（默认 10%）
}

interface UseAccountMonitorReturn {
  accountInfo: UserAccountInfo | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasLowBalance: boolean;
  balanceWarning: string | null;
}

/**
 * 账户监控 Hook
 * Requirement 9.4: 低余额时显示警告
 * Requirement 9.5: 定期刷新账户信息
 */
export const useAccountMonitor = (
  options: UseAccountMonitorOptions = {}
): UseAccountMonitorReturn => {
  const {
    enabled = true,
    refreshInterval = 5 * 60 * 1000, // 5 分钟
    showToast = true,
    lowBalanceThreshold = 0.1 // 10%
  } = options;

  const { userInfo } = useUserStore();
  const { toast } = useToast();

  const [accountInfo, setAccountInfo] = useState<UserAccountInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLowBalance, setHasLowBalance] = useState(false);
  const [balanceWarning, setBalanceWarning] = useState<string | null>(null);

  // 使用 ref 跟踪是否已显示过警告，避免重复提示
  const hasShownWarningRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 检查余额是否不足
   */
  const checkBalanceLow = useCallback(
    (info: UserAccountInfo): boolean => {
      if (info.balance.usage_quota === 0) {
        return false; // 无限配额
      }

      const usagePercentage =
        (info.balance.usage_quota - info.balance.remaining_quota) / info.balance.usage_quota;
      return usagePercentage >= 1 - lowBalanceThreshold;
    },
    [lowBalanceThreshold]
  );

  /**
   * 获取余额警告信息
   */
  const getWarningMessage = useCallback((info: UserAccountInfo): string | null => {
    // 先检查是否完全用尽
    if (info.balance.remaining_quota <= 0) {
      return '您的配额已用尽，请充值后继续使用。';
    }

    // 再检查是否即将用尽
    if (checkBalanceLow(info)) {
      const percentage = Math.round(
        (info.balance.remaining_quota / info.balance.usage_quota) * 100
      );
      return `您的配额即将用尽，剩余 ${percentage}%（${info.balance.remaining_quota} ${info.balance.quota_unit}），请及时充值。`;
    }

    return null;
  }, [checkBalanceLow]);

  /**
   * 刷新账户信息
   */
  const refresh = useCallback(async () => {
    if (!userInfo?.username || !enabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/user/account-info?username=${userInfo.username}`);

      if (!response.ok) {
        throw new Error('获取账户信息失败');
      }

      const data = await response.json();

      if (data.code === 200 && data.data) {
        const info = data.data as UserAccountInfo;
        setAccountInfo(info);

        // 检查余额状态
        const isLow = checkBalanceLow(info);
        const warning = getWarningMessage(info);

        setHasLowBalance(isLow);
        setBalanceWarning(warning);

        // 如果余额不足且启用了 Toast 通知，显示警告
        if (isLow && warning && showToast && !hasShownWarningRef.current) {
          toast({
            status: 'warning',
            title: '余额不足提醒',
            description: warning,
            duration: 10000, // 显示 10 秒
            isClosable: true
          });
          hasShownWarningRef.current = true;
        }

        // 如果余额恢复正常，重置警告标记
        if (!isLow) {
          hasShownWarningRef.current = false;
        }
      } else {
        throw new Error(data.message || '获取账户信息失败');
      }
    } catch (err: any) {
      const errorMessage = err.message || '获取账户信息失败';
      setError(errorMessage);
      console.error('鲁港通账户信息刷新失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userInfo?.username, enabled, checkBalanceLow, getWarningMessage, showToast, toast]);

  /**
   * 启动定期刷新
   */
  useEffect(() => {
    if (!enabled || !userInfo?.username) {
      return;
    }

    // 立即执行一次
    refresh();

    // 设置定时器
    timerRef.current = setInterval(() => {
      refresh();
    }, refreshInterval);

    // 清理函数
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, userInfo?.username, refreshInterval, refresh]);

  return {
    accountInfo,
    isLoading,
    error,
    refresh,
    hasLowBalance,
    balanceWarning
  };
};
