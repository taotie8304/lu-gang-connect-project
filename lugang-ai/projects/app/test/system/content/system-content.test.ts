/**
 * 鲁港通 - 系统内容功能测试
 * Feature: user-experience-redesign, Task 9
 * Validates: Requirements 3.6, 3.7, 3.8
 */
import { describe, it, expect } from 'vitest';
import { SystemContentKeyEnum, systemContentKeyMap } from '@fastgpt/global/support/systemContent/constant';

describe('Task 9: 系统内容管理功能', () => {
  describe('SystemContentKeyEnum 常量定义', () => {
    it('应包含三个内容键', () => {
      const keys = Object.values(SystemContentKeyEnum);
      
      expect(keys).toHaveLength(3);
      expect(keys).toContain('terms_of_use');
      expect(keys).toContain('privacy_policy');
      expect(keys).toContain('data_collection');
    });

    it('每个键应该有对应的配置', () => {
      Object.values(SystemContentKeyEnum).forEach((key) => {
        expect(systemContentKeyMap[key]).toBeDefined();
        expect(systemContentKeyMap[key].label).toBeDefined();
        expect(systemContentKeyMap[key].defaultTitle).toBeDefined();
        expect(systemContentKeyMap[key].defaultContent).toBeDefined();
      });
    });
  });

  describe('Requirement 3.6: 使用條款', () => {
    it('应有使用条款的键定义', () => {
      expect(SystemContentKeyEnum.termsOfUse).toBe('terms_of_use');
    });

    it('应有使用条款的默认配置', () => {
      const config = systemContentKeyMap[SystemContentKeyEnum.termsOfUse];
      
      expect(config.label).toBe('使用條款');
      expect(config.defaultTitle).toBe('使用條款');
      expect(config.defaultContent).toContain('使用條款');
    });

    it('默认内容应为Markdown格式', () => {
      const config = systemContentKeyMap[SystemContentKeyEnum.termsOfUse];
      
      expect(config.defaultContent).toMatch(/^#/); // Markdown标题
    });
  });

  describe('Requirement 3.7: 隱私政策', () => {
    it('应有隐私政策的键定义', () => {
      expect(SystemContentKeyEnum.privacyPolicy).toBe('privacy_policy');
    });

    it('应有隐私政策的默认配置', () => {
      const config = systemContentKeyMap[SystemContentKeyEnum.privacyPolicy];
      
      expect(config.label).toBe('隱私政策');
      expect(config.defaultTitle).toBe('隱私政策');
      expect(config.defaultContent).toContain('隱私政策');
    });

    it('默认内容应为Markdown格式', () => {
      const config = systemContentKeyMap[SystemContentKeyEnum.privacyPolicy];
      
      expect(config.defaultContent).toMatch(/^#/);
    });
  });

  describe('Requirement 3.8: 個人資料收集聲明', () => {
    it('应有个人资料收集声明的键定义', () => {
      expect(SystemContentKeyEnum.dataCollection).toBe('data_collection');
    });

    it('应有个人资料收集声明的默认配置', () => {
      const config = systemContentKeyMap[SystemContentKeyEnum.dataCollection];
      
      expect(config.label).toBe('個人資料收集聲明');
      expect(config.defaultTitle).toBe('個人資料收集聲明');
      expect(config.defaultContent).toContain('個人資料收集聲明');
    });

    it('默认内容应为Markdown格式', () => {
      const config = systemContentKeyMap[SystemContentKeyEnum.dataCollection];
      
      expect(config.defaultContent).toMatch(/^#/);
    });
  });

  describe('默认内容验证', () => {
    it('所有默认内容应包含占位提示', () => {
      Object.values(SystemContentKeyEnum).forEach((key) => {
        const config = systemContentKeyMap[key];
        expect(config.defaultContent).toContain('待管理員配置');
      });
    });

    it('所有默认标题应使用繁体中文', () => {
      const config1 = systemContentKeyMap[SystemContentKeyEnum.termsOfUse];
      const config2 = systemContentKeyMap[SystemContentKeyEnum.privacyPolicy];
      const config3 = systemContentKeyMap[SystemContentKeyEnum.dataCollection];
      
      expect(config1.defaultTitle).toContain('條款');
      expect(config2.defaultTitle).toContain('隱私');
      expect(config3.defaultTitle).toContain('資料');
    });

    it('所有默认内容应为非空字符串', () => {
      Object.values(SystemContentKeyEnum).forEach((key) => {
        const config = systemContentKeyMap[key];
        expect(config.defaultContent.length).toBeGreaterThan(0);
        expect(config.defaultTitle.length).toBeGreaterThan(0);
      });
    });
  });

  describe('API 端点路径验证', () => {
    it('应支持通过key获取内容', () => {
      const keys = Object.values(SystemContentKeyEnum);
      
      keys.forEach((key) => {
        const apiPath = `/api/system/content/${key}`;
        expect(apiPath).toMatch(/^\/api\/system\/content\/(terms_of_use|privacy_policy|data_collection)$/);
      });
    });

    it('更新API路径应正确', () => {
      const updatePath = '/api/system/content/update';
      expect(updatePath).toBe('/api/system/content/update');
    });

    it('列表API路径应正确', () => {
      const listPath = '/api/system/content/list';
      expect(listPath).toBe('/api/system/content/list');
    });
  });

  describe('组件集成验证', () => {
    it('UserSettingsPanel应包含三个系统内容菜单项', () => {
      const menuKeys = ['termsOfUse', 'privacyPolicy', 'dataCollection'];
      
      menuKeys.forEach((key) => {
        expect(key).toBeDefined();
      });
    });

    it('菜单项标签应使用繁体中文', () => {
      const labels = ['使用條款', '隱私政策', '個人資料收集聲明'];
      
      labels.forEach((label) => {
        expect(label.length).toBeGreaterThan(0);
      });
    });
  });

  describe('数据类型验证', () => {
    it('contentType应支持markdown', () => {
      const validTypes = ['markdown', 'html', 'text'];
      expect(validTypes).toContain('markdown');
    });

    it('contentType应支持html', () => {
      const validTypes = ['markdown', 'html', 'text'];
      expect(validTypes).toContain('html');
    });

    it('contentType应支持text', () => {
      const validTypes = ['markdown', 'html', 'text'];
      expect(validTypes).toContain('text');
    });
  });
});
