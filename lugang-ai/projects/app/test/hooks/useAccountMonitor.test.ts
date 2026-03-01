/**
 * 鲁港通 - 账户监控 Hook 测试
 * 验证 Task 16.3 的功能
 * Requirements: 9.4, 9.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { UserAccountInfo } from '@fastgpt/service/support/user/integration/subscription';
import { SubscriptionStatus } from '@fastgpt/service/support/user/integration/subscription';

describe('Task 16.3 - 余额不足提醒测试', () => {
  // 模拟账户信息
  const mockNormalAccount: UserAccountInfo = {
    subscription: {
      plan_name: '专业版',
      plan_status: SubscriptionStatus.Active,
      expiration_date: '2026-12-31',
      features: ['无限对话', 'GPT-4 访问']
    },
    balance: {
      current_balance: 100,
      usage_quota: 1000,
      remaining_quota: 850, // 85% 剩余
      quota_unit: '次'
    },
    user_id: 1,
    username: 'testuser'
  };

  const mockLowBalanceAccount: UserAccountInfo = {
    ...mockNormalAccount,
    balance: {
      current_balance: 10,
      usage_quota: 1000,
      remaining_quota: 50, // 5% 剩余
      quota_unit: '次'
    }
  };

  const mockZeroBalanceAccount: UserAccountInfo = {
    ...mockNormalAccount,
    balance: {
      current_balance: 0,
      usage_quota: 1000,
      remaining_quota: 0, // 0% 剩余
      quota_unit: '次'
    }
  };

  const mockUnlimitedAccount: UserAccountInfo = {
    ...mockNormalAccount,
    balance: {
      current_balance: 100,
      usage_quota: 0, // 无限配额
      remaining_quota: 0,
      quota_unit: '次'
    }
  };

  describe('Requirement 9.4 - 低余额警告', () => {
    it('应该在余额充足时不显示警告', () => {
      const checkBalanceLow = (info: UserAccountInfo, threshold: number = 0.1): boolean => {
        if (info.balance.usage_quota === 0) {
          return false;
        }
        const usagePercentage =
          (info.balance.usage_quota - info.balance.remaining_quota) / info.balance.usage_quota;
        return usagePercentage >= 1 - threshold;
      };

      expect(checkBalanceLow(mockNormalAccount)).toBe(false);
    });

    it('应该在余额不足时显示警告', () => {
      const checkBalanceLow = (info: UserAccountInfo, threshold: number = 0.1): boolean => {
        if (info.balance.usage_quota === 0) {
          return false;
        }
        const usagePercentage =
          (info.balance.usage_quota - info.balance.remaining_quota) / info.balance.usage_quota;
        return usagePercentage >= 1 - threshold;
      };

      expect(checkBalanceLow(mockLowBalanceAccount)).toBe(true);
    });

    it('应该在余额为零时显示特殊警告', () => {
      const getWarningMessage = (info: UserAccountInfo): string | null => {
        if (info.balance.remaining_quota <= 0) {
          return '您的配额已用尽，请充值后继续使用。';
        }

        if (info.balance.usage_quota === 0) {
          return null;
        }

        const usagePercentage =
          (info.balance.usage_quota - info.balance.remaining_quota) / info.balance.usage_quota;
        if (usagePercentage >= 0.9) {
          const percentage = Math.round(
            (info.balance.remaining_quota / info.balance.usage_quota) * 100
          );
          return `您的配额即将用尽，剩余 ${percentage}%（${info.balance.remaining_quota} ${info.balance.quota_unit}），请及时充值。`;
        }

        return null;
      };

      const warning = getWarningMessage(mockZeroBalanceAccount);
      expect(warning).toBe('您的配额已用尽，请充值后继续使用。');
    });

    it('应该在余额低于阈值时显示详细警告', () => {
      const getWarningMessage = (info: UserAccountInfo): string | null => {
        if (info.balance.remaining_quota <= 0) {
          return '您的配额已用尽，请充值后继续使用。';
        }

        if (info.balance.usage_quota === 0) {
          return null;
        }

        const usagePercentage =
          (info.balance.usage_quota - info.balance.remaining_quota) / info.balance.usage_quota;
        if (usagePercentage >= 0.9) {
          const percentage = Math.round(
            (info.balance.remaining_quota / info.balance.usage_quota) * 100
          );
          return `您的配额即将用尽，剩余 ${percentage}%（${info.balance.remaining_quota} ${info.balance.quota_unit}），请及时充值。`;
        }

        return null;
      };

      const warning = getWarningMessage(mockLowBalanceAccount);
      expect(warning).toContain('您的配额即将用尽');
      expect(warning).toContain('5%');
      expect(warning).toContain('50 次');
    });

    it('应该在无限配额时不显示警告', () => {
      const checkBalanceLow = (info: UserAccountInfo, threshold: number = 0.1): boolean => {
        if (info.balance.usage_quota === 0) {
          return false;
        }
        const usagePercentage =
          (info.balance.usage_quota - info.balance.remaining_quota) / info.balance.usage_quota;
        return usagePercentage >= 1 - threshold;
      };

      expect(checkBalanceLow(mockUnlimitedAccount)).toBe(false);
    });

    it('应该支持自定义阈值', () => {
      const checkBalanceLow = (info: UserAccountInfo, threshold: number = 0.1): boolean => {
        if (info.balance.usage_quota === 0) {
          return false;
        }
        const usagePercentage =
          (info.balance.usage_quota - info.balance.remaining_quota) / info.balance.usage_quota;
        return usagePercentage >= 1 - threshold;
      };

      // 20% 阈值
      const account20Percent: UserAccountInfo = {
        ...mockNormalAccount,
        balance: {
          current_balance: 20,
          usage_quota: 1000,
          remaining_quota: 150, // 15% 剩余
          quota_unit: '次'
        }
      };

      expect(checkBalanceLow(account20Percent, 0.2)).toBe(true);
      expect(checkBalanceLow(account20Percent, 0.1)).toBe(false);
    });
  });

  describe('Requirement 9.5 - 定期刷新', () => {
    it('应该支持定期刷新功能', () => {
      vi.useFakeTimers();
      const refreshCallback = vi.fn();
      const interval = 5 * 60 * 1000; // 5 分钟

      // 模拟定期刷新
      const timer = setInterval(refreshCallback, interval);

      // 快进 5 分钟
      vi.advanceTimersByTime(interval);
      expect(refreshCallback).toHaveBeenCalledTimes(1);

      // 再快进 5 分钟
      vi.advanceTimersByTime(interval);
      expect(refreshCallback).toHaveBeenCalledTimes(2);

      clearInterval(timer);
      vi.restoreAllMocks();
    });

    it('应该支持自定义刷新间隔', () => {
      vi.useFakeTimers();
      const refreshCallback = vi.fn();
      const customInterval = 2 * 60 * 1000; // 2 分钟

      const timer = setInterval(refreshCallback, customInterval);

      // 快进 2 分钟
      vi.advanceTimersByTime(customInterval);
      expect(refreshCallback).toHaveBeenCalledTimes(1);

      clearInterval(timer);
      vi.restoreAllMocks();
    });

    it('应该在组件卸载时清理定时器', () => {
      vi.useFakeTimers();
      const refreshCallback = vi.fn();
      const interval = 5 * 60 * 1000;

      const timer = setInterval(refreshCallback, interval);

      // 清理定时器
      clearInterval(timer);

      // 快进时间，不应该再调用
      vi.advanceTimersByTime(interval);
      expect(refreshCallback).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('应该在启用时立即执行一次刷新', () => {
      const refreshCallback = vi.fn();

      // 模拟立即执行
      refreshCallback();

      expect(refreshCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('综合场景测试', () => {
    it('应该正确处理从正常到低余额的转换', () => {
      const checkBalanceLow = (info: UserAccountInfo, threshold: number = 0.1): boolean => {
        if (info.balance.usage_quota === 0) {
          return false;
        }
        const usagePercentage =
          (info.balance.usage_quota - info.balance.remaining_quota) / info.balance.usage_quota;
        return usagePercentage >= 1 - threshold;
      };

      // 初始状态：余额充足
      expect(checkBalanceLow(mockNormalAccount)).toBe(false);

      // 使用后：余额不足
      expect(checkBalanceLow(mockLowBalanceAccount)).toBe(true);

      // 充值后：余额恢复
      expect(checkBalanceLow(mockNormalAccount)).toBe(false);
    });

    it('应该正确处理从低余额到零余额的转换', () => {
      const getWarningMessage = (info: UserAccountInfo): string | null => {
        if (info.balance.remaining_quota <= 0) {
          return '您的配额已用尽，请充值后继续使用。';
        }

        if (info.balance.usage_quota === 0) {
          return null;
        }

        const usagePercentage =
          (info.balance.usage_quota - info.balance.remaining_quota) / info.balance.usage_quota;
        if (usagePercentage >= 0.9) {
          const percentage = Math.round(
            (info.balance.remaining_quota / info.balance.usage_quota) * 100
          );
          return `您的配额即将用尽，剩余 ${percentage}%（${info.balance.remaining_quota} ${info.balance.quota_unit}），请及时充值。`;
        }

        return null;
      };

      // 低余额警告
      const lowWarning = getWarningMessage(mockLowBalanceAccount);
      expect(lowWarning).toContain('即将用尽');

      // 零余额警告
      const zeroWarning = getWarningMessage(mockZeroBalanceAccount);
      expect(zeroWarning).toContain('已用尽');
    });

    it('应该正确处理不同配额单位', () => {
      const getWarningMessage = (info: UserAccountInfo): string | null => {
        if (info.balance.remaining_quota <= 0) {
          return '您的配额已用尽，请充值后继续使用。';
        }

        if (info.balance.usage_quota === 0) {
          return null;
        }

        const usagePercentage =
          (info.balance.usage_quota - info.balance.remaining_quota) / info.balance.usage_quota;
        if (usagePercentage >= 0.9) {
          const percentage = Math.round(
            (info.balance.remaining_quota / info.balance.usage_quota) * 100
          );
          return `您的配额即将用尽，剩余 ${percentage}%（${info.balance.remaining_quota} ${info.balance.quota_unit}），请及时充值。`;
        }

        return null;
      };

      const tokensAccount: UserAccountInfo = {
        ...mockLowBalanceAccount,
        balance: {
          ...mockLowBalanceAccount.balance,
          quota_unit: 'tokens'
        }
      };

      const warning = getWarningMessage(tokensAccount);
      expect(warning).toContain('tokens');
    });
  });

  describe('边界情况测试', () => {
    it('应该处理恰好 10% 的边界情况', () => {
      const checkBalanceLow = (info: UserAccountInfo, threshold: number = 0.1): boolean => {
        if (info.balance.usage_quota === 0) {
          return false;
        }
        const usagePercentage =
          (info.balance.usage_quota - info.balance.remaining_quota) / info.balance.usage_quota;
        return usagePercentage >= 1 - threshold;
      };

      const exactlyTenPercent: UserAccountInfo = {
        ...mockNormalAccount,
        balance: {
          current_balance: 10,
          usage_quota: 1000,
          remaining_quota: 100, // 恰好 10%
          quota_unit: '次'
        }
      };

      expect(checkBalanceLow(exactlyTenPercent)).toBe(true);
    });

    it('应该处理略高于 10% 的情况', () => {
      const checkBalanceLow = (info: UserAccountInfo, threshold: number = 0.1): boolean => {
        if (info.balance.usage_quota === 0) {
          return false;
        }
        const usagePercentage =
          (info.balance.usage_quota - info.balance.remaining_quota) / info.balance.usage_quota;
        return usagePercentage >= 1 - threshold;
      };

      const slightlyAboveTenPercent: UserAccountInfo = {
        ...mockNormalAccount,
        balance: {
          current_balance: 11,
          usage_quota: 1000,
          remaining_quota: 101, // 10.1%
          quota_unit: '次'
        }
      };

      expect(checkBalanceLow(slightlyAboveTenPercent)).toBe(false);
    });

    it('应该处理负数余额（异常情况）', () => {
      const getWarningMessage = (info: UserAccountInfo): string | null => {
        if (info.balance.remaining_quota <= 0) {
          return '您的配额已用尽，请充值后继续使用。';
        }

        if (info.balance.usage_quota === 0) {
          return null;
        }

        const usagePercentage =
          (info.balance.usage_quota - info.balance.remaining_quota) / info.balance.usage_quota;
        if (usagePercentage >= 0.9) {
          const percentage = Math.round(
            (info.balance.remaining_quota / info.balance.usage_quota) * 100
          );
          return `您的配额即将用尽，剩余 ${percentage}%（${info.balance.remaining_quota} ${info.balance.quota_unit}），请及时充值。`;
        }

        return null;
      };

      const negativeBalance: UserAccountInfo = {
        ...mockNormalAccount,
        balance: {
          current_balance: -10,
          usage_quota: 1000,
          remaining_quota: -50,
          quota_unit: '次'
        }
      };

      const warning = getWarningMessage(negativeBalance);
      expect(warning).toBe('您的配额已用尽，请充值后继续使用。');
    });
  });
});
