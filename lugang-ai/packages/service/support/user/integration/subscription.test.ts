/**
 * 鲁港通 - 订阅和余额查询服务单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  SubscriptionStatus,
  type SubscriptionInfo,
  type BalanceInfo,
  isBalanceLow,
  getBalanceWarning
} from './subscription';

describe('订阅和余额查询服务', () => {
  describe('isBalanceLow', () => {
    it('应该正确判断余额充足', () => {
      const balance: BalanceInfo = {
        current_balance: 100,
        usage_quota: 1000,
        remaining_quota: 900,
        quota_unit: '次'
      };

      expect(isBalanceLow(balance)).toBe(false);
    });

    it('应该正确判断余额不足（剩余 10%）', () => {
      const balance: BalanceInfo = {
        current_balance: 10,
        usage_quota: 1000,
        remaining_quota: 100,
        quota_unit: '次'
      };

      // 剩余 10% 刚好在阈值边界，应该不触发警告
      expect(isBalanceLow(balance, 0.1)).toBe(true); // 已使用 90%，触发 10% 阈值
    });

    it('应该正确判断余额不足（剩余 5%）', () => {
      const balance: BalanceInfo = {
        current_balance: 5,
        usage_quota: 1000,
        remaining_quota: 50,
        quota_unit: '次'
      };

      expect(isBalanceLow(balance)).toBe(true);
    });

    it('应该正确判断余额用尽', () => {
      const balance: BalanceInfo = {
        current_balance: 0,
        usage_quota: 1000,
        remaining_quota: 0,
        quota_unit: '次'
      };

      expect(isBalanceLow(balance)).toBe(true);
    });

    it('应该处理无限配额情况', () => {
      const balance: BalanceInfo = {
        current_balance: 999999,
        usage_quota: 0,
        remaining_quota: 0,
        quota_unit: '次'
      };

      expect(isBalanceLow(balance)).toBe(false);
    });

    it('应该支持自定义阈值', () => {
      const balance: BalanceInfo = {
        current_balance: 20,
        usage_quota: 1000,
        remaining_quota: 200,
        quota_unit: '次'
      };

      // 默认阈值 10%
      expect(isBalanceLow(balance, 0.1)).toBe(false);

      // 自定义阈值 25%
      expect(isBalanceLow(balance, 0.25)).toBe(true);
    });
  });

  describe('getBalanceWarning', () => {
    it('余额充足时不应该返回警告', () => {
      const balance: BalanceInfo = {
        current_balance: 100,
        usage_quota: 1000,
        remaining_quota: 900,
        quota_unit: '次'
      };

      expect(getBalanceWarning(balance)).toBeNull();
    });

    it('余额不足时应该返回警告信息', () => {
      const balance: BalanceInfo = {
        current_balance: 5,
        usage_quota: 1000,
        remaining_quota: 50,
        quota_unit: '次'
      };

      const warning = getBalanceWarning(balance);
      expect(warning).not.toBeNull();
      expect(warning).toContain('配额即将用尽');
      expect(warning).toContain('5%');
      expect(warning).toContain('50 次');
    });

    it('余额用尽时应该返回特殊警告', () => {
      const balance: BalanceInfo = {
        current_balance: 0,
        usage_quota: 1000,
        remaining_quota: 0,
        quota_unit: '次'
      };

      const warning = getBalanceWarning(balance);
      expect(warning).not.toBeNull();
      expect(warning).toContain('配额已用尽');
      expect(warning).toContain('请充值');
    });

    it('应该正确显示不同的配额单位', () => {
      const balance: BalanceInfo = {
        current_balance: 5,
        usage_quota: 100000,
        remaining_quota: 5000,
        quota_unit: 'tokens'
      };

      const warning = getBalanceWarning(balance);
      expect(warning).not.toBeNull();
      expect(warning).toContain('5000 tokens');
    });
  });

  describe('订阅状态', () => {
    it('应该定义所有订阅状态', () => {
      expect(SubscriptionStatus.Active).toBe('active');
      expect(SubscriptionStatus.Expired).toBe('expired');
      expect(SubscriptionStatus.Cancelled).toBe('cancelled');
      expect(SubscriptionStatus.Trial).toBe('trial');
    });
  });

  describe('数据结构验证', () => {
    it('SubscriptionInfo 应该包含所有必需字段', () => {
      const subscription: SubscriptionInfo = {
        plan_name: '专业版',
        plan_status: SubscriptionStatus.Active,
        expiration_date: '2026-12-31T23:59:59Z',
        features: ['无限对话', '高级模型', '优先支持']
      };

      expect(subscription.plan_name).toBe('专业版');
      expect(subscription.plan_status).toBe(SubscriptionStatus.Active);
      expect(subscription.expiration_date).toBe('2026-12-31T23:59:59Z');
      expect(subscription.features).toHaveLength(3);
    });

    it('BalanceInfo 应该包含所有必需字段', () => {
      const balance: BalanceInfo = {
        current_balance: 100.50,
        usage_quota: 10000,
        remaining_quota: 8500,
        quota_unit: 'tokens'
      };

      expect(balance.current_balance).toBe(100.50);
      expect(balance.usage_quota).toBe(10000);
      expect(balance.remaining_quota).toBe(8500);
      expect(balance.quota_unit).toBe('tokens');
    });
  });

  describe('边界情况', () => {
    it('应该处理负数余额', () => {
      const balance: BalanceInfo = {
        current_balance: -10,
        usage_quota: 1000,
        remaining_quota: 0,
        quota_unit: '次'
      };

      expect(isBalanceLow(balance)).toBe(true);
      expect(getBalanceWarning(balance)).toContain('配额已用尽');
    });

    it('应该处理超额使用情况', () => {
      const balance: BalanceInfo = {
        current_balance: 0,
        usage_quota: 1000,
        remaining_quota: -100, // 超额使用
        quota_unit: '次'
      };

      expect(isBalanceLow(balance)).toBe(true);
    });

    it('应该处理极小的配额', () => {
      const balance: BalanceInfo = {
        current_balance: 0.01,
        usage_quota: 10,
        remaining_quota: 1,
        quota_unit: '次'
      };

      // 剩余 10%，已使用 90%，触发警告
      expect(isBalanceLow(balance)).toBe(true);
    });

    it('应该处理极大的配额', () => {
      const balance: BalanceInfo = {
        current_balance: 999999,
        usage_quota: 1000000000,
        remaining_quota: 999000000,
        quota_unit: 'tokens'
      };

      expect(isBalanceLow(balance)).toBe(false);
    });
  });
});
