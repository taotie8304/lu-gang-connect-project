/**
 * 鲁港通 - 验证码 API 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock MongoDB 连接
vi.mock('@fastgpt/service/common/mongo', () => {
  const mockModel = {
    deleteMany: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({ _id: 'test-id' }),
    findOne: vi.fn().mockResolvedValue(null),
    deleteOne: vi.fn().mockResolvedValue({})
  };
  
  const mockSchema = vi.fn().mockImplementation(() => ({}));
  
  return {
    connectionMongo: {
      Schema: mockSchema
    },
    getMongoModel: vi.fn().mockReturnValue(mockModel)
  };
});

// Mock 日志
vi.mock('@fastgpt/service/common/system/log', () => ({
  addLog: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock jsonRes
vi.mock('@fastgpt/service/common/response', () => ({
  jsonRes: vi.fn((res, data) => {
    res.statusCode = data.code || 200;
    res.json(data);
    return res;
  })
}));

describe('验证码生成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该能够导入验证码模块', async () => {
    // 动态导入以确保 mock 生效
    const captchaModule = await import('@/pages/api/support/user/account/captcha/getImgCaptcha');
    expect(captchaModule).toBeDefined();
    expect(captchaModule.default).toBeDefined();
    expect(captchaModule.verifyCaptcha).toBeDefined();
  });

  it('验证码生成函数应该存在', async () => {
    const captchaModule = await import('@/pages/api/support/user/account/captcha/getImgCaptcha');
    expect(typeof captchaModule.default).toBe('function');
  });

  it('verifyCaptcha 函数应该存在', async () => {
    const captchaModule = await import('@/pages/api/support/user/account/captcha/getImgCaptcha');
    expect(typeof captchaModule.verifyCaptcha).toBe('function');
  });
});

describe('发送验证码测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该能够导入发送验证码模块', async () => {
    const sendCodeModule = await import('@/pages/api/support/user/inform/sendAuthCode');
    expect(sendCodeModule).toBeDefined();
    expect(sendCodeModule.default).toBeDefined();
    expect(sendCodeModule.verifyAuthCode).toBeDefined();
  });
});

describe('注册 API 测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该能够导入注册模块', async () => {
    const registerModule = await import('@/pages/api/support/user/account/register');
    expect(registerModule).toBeDefined();
    expect(registerModule.default).toBeDefined();
  });
});
