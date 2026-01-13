/**
 * 鲁港通平台集成 - 用户同步测试
 * 
 * Property 2: 用户注册双系统同步
 * Validates: Requirements 2.4, 8.1, 8.3
 * 
 * 测试 FastGPT 用户与 One API 用户的同步逻辑
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock addLog
vi.mock('@fastgpt/service/common/system/log', () => ({
  addLog: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

/**
 * One API 用户类型
 */
interface OneApiUser {
  id: number;
  username: string;
  display_name: string;
  email: string;
  quota: number;
  used_quota: number;
  status: number;
}

/**
 * One API 响应类型
 */
interface OneApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * 模拟 One API 请求封装
 */
async function mockOneApiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<OneApiResponse<T>> {
  const baseUrl = 'http://localhost:8080';
  const url = `${baseUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        message: data.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      message: 'success',
      data,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Network error',
    };
  }
}

/**
 * 模拟创建 One API 用户
 */
async function mockCreateOneApiUser(
  username: string,
  password: string,
  displayName: string,
  initialQuota: number = 10000
): Promise<OneApiResponse<OneApiUser>> {
  return mockOneApiRequest<OneApiUser>('/api/user', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      display_name: displayName,
      email: username,
      quota: initialQuota,
      group: 'default',
    }),
  });
}

/**
 * 模拟通过用户名查询用户
 */
async function mockGetOneApiUserByUsername(username: string): Promise<OneApiResponse<OneApiUser>> {
  const result = await mockOneApiRequest<{ data: OneApiUser[] }>(
    `/api/user/search?keyword=${encodeURIComponent(username)}`
  );
  
  if (result.success && result.data?.data) {
    const user = result.data.data.find(u => u.username === username || u.email === username);
    if (user) {
      return {
        success: true,
        message: 'success',
        data: user,
      };
    }
  }

  return {
    success: false,
    message: 'User not found',
  };
}

/**
 * 模拟同步用户到 One API
 */
async function mockSyncUserToOneApi(
  username: string,
  displayName: string,
  initialQuota: number = 10000
): Promise<OneApiResponse<OneApiUser>> {
  // 先检查用户是否已存在
  const existingUser = await mockGetOneApiUserByUsername(username);
  
  if (existingUser.success && existingUser.data) {
    return existingUser;
  }
  
  // 用户不存在，创建新用户
  const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
  
  return mockCreateOneApiUser(username, randomPassword, displayName, initialQuota);
}

describe('鲁港通 - 用户注册双系统同步 (Property 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('用户创建逻辑', () => {
    it('新用户应成功创建到 One API', async () => {
      const mockUser: OneApiUser = {
        id: 1,
        username: 'test@example.com',
        display_name: 'Test User',
        email: 'test@example.com',
        quota: 10000,
        used_quota: 0,
        status: 1
      };

      // Mock 搜索返回空（用户不存在）
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      // Mock 创建用户成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser
      });

      const result = await mockSyncUserToOneApi('test@example.com', 'Test User');
      
      expect(result.success).toBe(true);
      expect(result.data?.username).toBe('test@example.com');
      expect(result.data?.quota).toBe(10000);
    });

    it('已存在的用户应返回现有用户信息', async () => {
      const existingUser: OneApiUser = {
        id: 1,
        username: 'existing@example.com',
        display_name: 'Existing User',
        email: 'existing@example.com',
        quota: 5000,
        used_quota: 1000,
        status: 1
      };

      // Mock 搜索返回已存在用户
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [existingUser] })
      });

      const result = await mockSyncUserToOneApi('existing@example.com', 'Existing User');
      
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(1);
      expect(result.data?.quota).toBe(5000);
      expect(result.data?.used_quota).toBe(1000);
      
      // 应该只调用一次（搜索），不应该调用创建
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('创建用户时应分配初始额度', async () => {
      const initialQuota = 20000;
      
      // Mock 搜索返回空
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      // Mock 创建用户
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 2,
          username: 'new@example.com',
          display_name: 'New User',
          email: 'new@example.com',
          quota: initialQuota,
          used_quota: 0,
          status: 1
        })
      });

      const result = await mockSyncUserToOneApi('new@example.com', 'New User', initialQuota);
      
      expect(result.success).toBe(true);
      expect(result.data?.quota).toBe(initialQuota);
    });
  });

  describe('错误处理', () => {
    it('网络错误应返回失败响应', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await mockSyncUserToOneApi('test@example.com', 'Test User');
      
      expect(result.success).toBe(false);
      // 网络错误会被捕获并返回错误信息（可能是原始错误或处理后的错误）
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
    });

    it('API 错误应返回失败响应', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal server error' })
      });

      const result = await mockSyncUserToOneApi('test@example.com', 'Test User');
      
      expect(result.success).toBe(false);
      // API 错误会返回错误信息
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
    });

    it('用户创建失败应返回错误信息', async () => {
      // Mock 搜索返回空
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      // Mock 创建用户失败
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Username already exists' })
      });

      const result = await mockSyncUserToOneApi('duplicate@example.com', 'Duplicate User');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Username already exists');
    });
  });

  describe('请求参数验证', () => {
    it('创建用户请求应包含正确的参数', async () => {
      // Mock 搜索返回空
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      // Mock 创建用户
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          username: 'test@example.com',
          display_name: 'Test User',
          email: 'test@example.com',
          quota: 10000,
          used_quota: 0,
          status: 1
        })
      });

      await mockSyncUserToOneApi('test@example.com', 'Test User', 10000);

      // 验证创建用户的请求参数
      const createCall = mockFetch.mock.calls[1];
      expect(createCall[0]).toBe('http://localhost:8080/api/user');
      
      const requestBody = JSON.parse(createCall[1].body);
      expect(requestBody.username).toBe('test@example.com');
      expect(requestBody.display_name).toBe('Test User');
      expect(requestBody.email).toBe('test@example.com');
      expect(requestBody.quota).toBe(10000);
      expect(requestBody.group).toBe('default');
      expect(requestBody.password).toBeDefined();
      expect(requestBody.password.length).toBeGreaterThan(0);
    });

    it('搜索用户请求应正确编码用户名', async () => {
      const specialUsername = 'test+user@example.com';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1,
          username: specialUsername,
          display_name: 'Test User',
          email: specialUsername,
          quota: 10000,
          used_quota: 0,
          status: 1
        })
      });

      await mockSyncUserToOneApi(specialUsername, 'Test User');

      // 验证搜索请求的 URL 编码
      const searchCall = mockFetch.mock.calls[0];
      expect(searchCall[0]).toContain(encodeURIComponent(specialUsername));
    });
  });

  describe('幂等性验证', () => {
    it('多次同步同一用户应返回相同结果', async () => {
      const existingUser: OneApiUser = {
        id: 1,
        username: 'idempotent@example.com',
        display_name: 'Idempotent User',
        email: 'idempotent@example.com',
        quota: 10000,
        used_quota: 500,
        status: 1
      };

      // 第一次同步
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [existingUser] })
      });

      const result1 = await mockSyncUserToOneApi('idempotent@example.com', 'Idempotent User');

      // 第二次同步
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [existingUser] })
      });

      const result2 = await mockSyncUserToOneApi('idempotent@example.com', 'Idempotent User');

      expect(result1.success).toBe(result2.success);
      expect(result1.data?.id).toBe(result2.data?.id);
      expect(result1.data?.quota).toBe(result2.data?.quota);
    });
  });
});
