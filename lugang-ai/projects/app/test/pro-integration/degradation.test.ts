// 鲁港通 - 商业版功能降级测试
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('商业版功能降级测试', () => {
  let originalProUrl: string | undefined;

  beforeEach(() => {
    // 保存原始 PRO_URL
    originalProUrl = process.env.PRO_URL;
  });

  afterEach(() => {
    // 恢复原始 PRO_URL
    if (originalProUrl !== undefined) {
      process.env.PRO_URL = originalProUrl;
    } else {
      delete process.env.PRO_URL;
    }
  });

  describe('未配置商业版时', () => {
    beforeEach(() => {
      // 清除 PRO_URL
      delete process.env.PRO_URL;
      // 清除模块缓存，强制重新加载
      delete require.cache[require.resolve('@fastgpt/service/common/system/constants')];
    });

    it('FastGPTProUrl 应该为空字符串', () => {
      const { FastGPTProUrl } = require('@fastgpt/service/common/system/constants');
      expect(FastGPTProUrl).toBe('');
    });

    it('plusRequest 应该返回错误而不是抛出异常', async () => {
      const { GET } = require('@fastgpt/service/common/api/plusRequest');
      
      try {
        await GET('/test/api');
        // 不应该到达这里
        expect(true).toBe(false);
      } catch (error: any) {
        // 应该捕获到 UserError
        expect(error.message).toContain('denied');
      }
    });

    it('sendOneInform 应该直接返回 undefined', () => {
      const { sendOneInform } = require('@/service/support/user/inform/api');
      const result = sendOneInform({ userId: 'test', content: 'test' });
      expect(result).toBeUndefined();
    });

    it('pushResult2Remote 应该直接返回', async () => {
      const { pushResult2Remote } = require('@fastgpt/service/support/outLink/tools');
      const result = await pushResult2Remote({
        shareId: 'test',
        outLinkUid: 'test',
        appName: 'test',
        flowResponses: []
      });
      expect(result).toBeUndefined();
    });

    it('getFastGPTConfigFromDB 应该返回空配置', async () => {
      const { getFastGPTConfigFromDB } = require('@fastgpt/service/common/system/config/controller');
      const result = await getFastGPTConfigFromDB();
      expect(result.fastgptConfig).toEqual({});
      expect(result.licenseData).toBeUndefined();
    });
  });

  describe('配置商业版时', () => {
    beforeEach(() => {
      // 设置 PRO_URL
      process.env.PRO_URL = 'https://pro.example.com';
      // 清除模块缓存，强制重新加载
      delete require.cache[require.resolve('@fastgpt/service/common/system/constants')];
    });

    it('FastGPTProUrl 应该包含 /api 后缀', () => {
      const { FastGPTProUrl } = require('@fastgpt/service/common/system/constants');
      expect(FastGPTProUrl).toBe('https://pro.example.com/api');
    });

    it('isProVersion 应该根据 global.feConfigs 返回', () => {
      const { isProVersion } = require('@fastgpt/service/common/system/constants');
      
      // 未设置时返回 false
      expect(isProVersion()).toBe(false);
      
      // 设置后返回 true
      (global as any).feConfigs = { isPlus: true };
      expect(isProVersion()).toBe(true);
      
      // 清理
      delete (global as any).feConfigs;
    });
  });

  describe('文件 URL 验证器', () => {
    it('应该将 PRO_URL 主机名添加到白名单', () => {
      process.env.PRO_URL = 'https://pro.example.com';
      delete require.cache[require.resolve('@fastgpt/service/common/security/fileUrlValidator')];
      
      const { validateFileUrlDomain } = require('@fastgpt/service/common/security/fileUrlValidator');
      
      // 设置空白名单以测试系统白名单
      (global as any).systemEnv = { fileUrlWhitelist: [] };
      
      // pro.example.com 应该在白名单中
      const result = validateFileUrlDomain('https://pro.example.com/file.pdf');
      expect(result).toBe(true);
      
      // 清理
      delete (global as any).systemEnv;
    });

    it('应该优雅处理无效的 PRO_URL', () => {
      process.env.PRO_URL = 'invalid-url';
      delete require.cache[require.resolve('@fastgpt/service/common/security/fileUrlValidator')];
      
      // 不应该抛出异常
      expect(() => {
        require('@fastgpt/service/common/security/fileUrlValidator');
      }).not.toThrow();
    });
  });

  describe('InitialErrorEnum', () => {
    it('应该包含 PRO_ERROR', () => {
      const { InitialErrorEnum } = require('@fastgpt/service/common/system/constants');
      expect(InitialErrorEnum.PRO_ERROR).toBe('pro_error');
    });

    it('应该包含所有错误类型', () => {
      const { InitialErrorEnum } = require('@fastgpt/service/common/system/constants');
      expect(InitialErrorEnum).toHaveProperty('S3_ERROR');
      expect(InitialErrorEnum).toHaveProperty('MONGO_ERROR');
      expect(InitialErrorEnum).toHaveProperty('REDIS_ERROR');
      expect(InitialErrorEnum).toHaveProperty('VECTORDB_ERROR');
      expect(InitialErrorEnum).toHaveProperty('PLUGIN_ERROR');
      expect(InitialErrorEnum).toHaveProperty('PRO_ERROR');
      expect(InitialErrorEnum).toHaveProperty('SANDBOX_ERROR');
      expect(InitialErrorEnum).toHaveProperty('MCP_SERVER_ERROR');
    });
  });
});
