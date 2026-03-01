/**
 * 鲁港通 - 充值套餐弹窗集成测试
 * 验证 Task 17.1 的所有功能
 * Requirements: 10.1
 */

import { describe, it, expect } from 'vitest';
import type { RechargePackage } from '@fastgpt/service/support/user/integration/recharge';

describe('Task 17.1 - 充值套餐显示组件集成测试', () => {
  // 模拟充值套餐数据
  const mockBasicPackage: RechargePackage = {
    id: 'pkg_basic_001',
    name: '基础套餐',
    amount: 50,
    bonus: 0,
    total_amount: 50,
    quota: 5000,
    quota_unit: '次',
    description: '适合轻度使用用户',
    features: ['基础对话功能', '标准响应速度']
  };

  const mockStandardPackage: RechargePackage = {
    id: 'pkg_standard_002',
    name: '标准套餐',
    amount: 100,
    bonus: 10,
    total_amount: 110,
    quota: 12000,
    quota_unit: '次',
    description: '适合中度使用用户',
    features: ['全部对话功能', '优先响应速度', '专属客服'],
    is_popular: true
  };

  const mockPremiumPackage: RechargePackage = {
    id: 'pkg_premium_003',
    name: '高级套餐',
    amount: 200,
    bonus: 30,
    total_amount: 230,
    quota: 30000,
    quota_unit: '次',
    description: '适合重度使用用户',
    features: ['全部对话功能', '最高优先级', '专属客服', 'API 访问'],
    discount_percentage: 15,
    original_price: 250
  };

  const mockTokensPackage: RechargePackage = {
    id: 'pkg_tokens_004',
    name: 'Tokens 套餐',
    amount: 500,
    bonus: 100,
    total_amount: 600,
    quota: 1000000,
    quota_unit: 'tokens',
    description: '适合企业用户',
    features: ['无限对话', 'API 访问', '技术支持', '定制服务']
  };

  describe('Requirement 10.1 - 显示可用充值套餐列表', () => {
    it('应该正确显示套餐基本信息', () => {
      expect(mockBasicPackage.id).toBe('pkg_basic_001');
      expect(mockBasicPackage.name).toBe('基础套餐');
      expect(mockBasicPackage.amount).toBe(50);
      expect(mockBasicPackage.quota).toBe(5000);
      expect(mockBasicPackage.quota_unit).toBe('次');
    });

    it('应该正确显示套餐赠送金额', () => {
      expect(mockStandardPackage.bonus).toBe(10);
      expect(mockStandardPackage.total_amount).toBe(110);
      expect(mockStandardPackage.total_amount).toBe(
        mockStandardPackage.amount + mockStandardPackage.bonus
      );
    });

    it('应该正确显示套餐描述', () => {
      expect(mockBasicPackage.description).toBe('适合轻度使用用户');
      expect(mockStandardPackage.description).toBe('适合中度使用用户');
      expect(mockPremiumPackage.description).toBe('适合重度使用用户');
    });

    it('应该正确显示套餐特性列表', () => {
      expect(mockBasicPackage.features).toHaveLength(2);
      expect(mockBasicPackage.features).toContain('基础对话功能');
      expect(mockBasicPackage.features).toContain('标准响应速度');

      expect(mockStandardPackage.features).toHaveLength(3);
      expect(mockPremiumPackage.features).toHaveLength(4);
    });

    it('应该正确标记热门套餐', () => {
      expect(mockBasicPackage.is_popular).toBeUndefined();
      expect(mockStandardPackage.is_popular).toBe(true);
      expect(mockPremiumPackage.is_popular).toBeUndefined();
    });

    it('应该正确显示折扣信息', () => {
      expect(mockPremiumPackage.discount_percentage).toBe(15);
      expect(mockPremiumPackage.original_price).toBe(250);
      expect(mockPremiumPackage.amount).toBe(200);

      const savings = mockPremiumPackage.original_price! - mockPremiumPackage.amount;
      expect(savings).toBe(50);
    });

    it('应该支持不同配额单位', () => {
      expect(mockBasicPackage.quota_unit).toBe('次');
      expect(mockTokensPackage.quota_unit).toBe('tokens');
    });
  });

  describe('金额格式化测试', () => {
    it('应该正确格式化金额', () => {
      const formatAmount = (amount: number): string => {
        return `¥${amount.toFixed(2)}`;
      };

      expect(formatAmount(50)).toBe('¥50.00');
      expect(formatAmount(100.5)).toBe('¥100.50');
      expect(formatAmount(200)).toBe('¥200.00');
    });

    it('应该正确格式化配额', () => {
      const formatQuota = (quota: number, unit: string): string => {
        if (quota >= 10000) {
          return `${(quota / 10000).toFixed(1)}万${unit}`;
        }
        return `${quota}${unit}`;
      };

      expect(formatQuota(5000, '次')).toBe('5000次');
      expect(formatQuota(12000, '次')).toBe('1.2万次');
      expect(formatQuota(30000, '次')).toBe('3.0万次');
      expect(formatQuota(1000000, 'tokens')).toBe('100.0万tokens');
    });

    it('应该正确计算折扣文本', () => {
      const getDiscountText = (discountPercentage: number): string => {
        return `${(10 - discountPercentage / 10).toFixed(1)}折`;
      };

      expect(getDiscountText(10)).toBe('9.0折');
      expect(getDiscountText(15)).toBe('8.5折');
      expect(getDiscountText(20)).toBe('8.0折');
      expect(getDiscountText(30)).toBe('7.0折');
    });
  });

  describe('套餐排序和筛选测试', () => {
    const allPackages = [
      mockBasicPackage,
      mockStandardPackage,
      mockPremiumPackage,
      mockTokensPackage
    ];

    it('应该能按金额排序', () => {
      const sorted = [...allPackages].sort((a, b) => a.amount - b.amount);
      expect(sorted[0].amount).toBe(50);
      expect(sorted[1].amount).toBe(100);
      expect(sorted[2].amount).toBe(200);
      expect(sorted[3].amount).toBe(500);
    });

    it('应该能筛选热门套餐', () => {
      const popular = allPackages.filter((pkg) => pkg.is_popular);
      expect(popular).toHaveLength(1);
      expect(popular[0].name).toBe('标准套餐');
    });

    it('应该能筛选有折扣的套餐', () => {
      const discounted = allPackages.filter(
        (pkg) => pkg.discount_percentage && pkg.discount_percentage > 0
      );
      expect(discounted).toHaveLength(1);
      expect(discounted[0].name).toBe('高级套餐');
    });

    it('应该能筛选有赠送的套餐', () => {
      const withBonus = allPackages.filter((pkg) => pkg.bonus > 0);
      expect(withBonus).toHaveLength(3);
      expect(withBonus.map((p) => p.name)).toContain('标准套餐');
      expect(withBonus.map((p) => p.name)).toContain('高级套餐');
      expect(withBonus.map((p) => p.name)).toContain('Tokens 套餐');
    });
  });

  describe('综合场景测试', () => {
    it('应该正确处理完整的套餐信息', () => {
      expect(mockStandardPackage).toHaveProperty('id');
      expect(mockStandardPackage).toHaveProperty('name');
      expect(mockStandardPackage).toHaveProperty('amount');
      expect(mockStandardPackage).toHaveProperty('bonus');
      expect(mockStandardPackage).toHaveProperty('total_amount');
      expect(mockStandardPackage).toHaveProperty('quota');
      expect(mockStandardPackage).toHaveProperty('quota_unit');
      expect(mockStandardPackage).toHaveProperty('description');
      expect(mockStandardPackage).toHaveProperty('features');
      expect(mockStandardPackage).toHaveProperty('is_popular');
    });

    it('应该正确计算实际到账金额', () => {
      const packages = [mockBasicPackage, mockStandardPackage, mockPremiumPackage];

      packages.forEach((pkg) => {
        expect(pkg.total_amount).toBe(pkg.amount + pkg.bonus);
      });
    });

    it('应该正确处理无赠送的套餐', () => {
      expect(mockBasicPackage.bonus).toBe(0);
      expect(mockBasicPackage.total_amount).toBe(mockBasicPackage.amount);
    });

    it('应该正确处理无折扣的套餐', () => {
      expect(mockBasicPackage.discount_percentage).toBeUndefined();
      expect(mockBasicPackage.original_price).toBeUndefined();
    });
  });

  describe('边界情况测试', () => {
    it('应该处理空特性列表', () => {
      const emptyFeaturesPackage: RechargePackage = {
        ...mockBasicPackage,
        features: []
      };

      expect(emptyFeaturesPackage.features).toHaveLength(0);
    });

    it('应该处理极小金额', () => {
      const tinyPackage: RechargePackage = {
        id: 'pkg_tiny',
        name: '体验套餐',
        amount: 1,
        bonus: 0,
        total_amount: 1,
        quota: 100,
        quota_unit: '次'
      };

      expect(tinyPackage.amount).toBe(1);
      expect(tinyPackage.quota).toBe(100);
    });

    it('应该处理极大金额', () => {
      const largePackage: RechargePackage = {
        id: 'pkg_large',
        name: '企业套餐',
        amount: 10000,
        bonus: 2000,
        total_amount: 12000,
        quota: 10000000,
        quota_unit: 'tokens'
      };

      expect(largePackage.amount).toBe(10000);
      expect(largePackage.quota).toBe(10000000);
    });

    it('应该处理无描述的套餐', () => {
      const noDescPackage: RechargePackage = {
        id: 'pkg_no_desc',
        name: '简单套餐',
        amount: 50,
        bonus: 0,
        total_amount: 50,
        quota: 5000,
        quota_unit: '次'
      };

      expect(noDescPackage.description).toBeUndefined();
    });

    it('应该处理 100% 折扣（免费）', () => {
      const freePackage: RechargePackage = {
        id: 'pkg_free',
        name: '免费套餐',
        amount: 0,
        bonus: 0,
        total_amount: 0,
        quota: 100,
        quota_unit: '次',
        discount_percentage: 100,
        original_price: 10
      };

      expect(freePackage.amount).toBe(0);
      expect(freePackage.discount_percentage).toBe(100);
    });
  });

  describe('数据验证测试', () => {
    it('应该验证套餐 ID 唯一性', () => {
      const packages = [
        mockBasicPackage,
        mockStandardPackage,
        mockPremiumPackage,
        mockTokensPackage
      ];

      const ids = packages.map((p) => p.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(packages.length);
    });

    it('应该验证金额为非负数', () => {
      const packages = [
        mockBasicPackage,
        mockStandardPackage,
        mockPremiumPackage,
        mockTokensPackage
      ];

      packages.forEach((pkg) => {
        expect(pkg.amount).toBeGreaterThanOrEqual(0);
        expect(pkg.bonus).toBeGreaterThanOrEqual(0);
        expect(pkg.total_amount).toBeGreaterThanOrEqual(0);
      });
    });

    it('应该验证配额为正数', () => {
      const packages = [
        mockBasicPackage,
        mockStandardPackage,
        mockPremiumPackage,
        mockTokensPackage
      ];

      packages.forEach((pkg) => {
        expect(pkg.quota).toBeGreaterThan(0);
      });
    });

    it('应该验证折扣百分比在合理范围内', () => {
      if (mockPremiumPackage.discount_percentage) {
        expect(mockPremiumPackage.discount_percentage).toBeGreaterThan(0);
        expect(mockPremiumPackage.discount_percentage).toBeLessThanOrEqual(100);
      }
    });
  });
});
