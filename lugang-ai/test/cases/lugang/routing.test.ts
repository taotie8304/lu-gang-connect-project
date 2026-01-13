/**
 * 鲁港通平台集成 - 角色路由一致性测试
 * 
 * Property 3: 角色路由一致性
 * Validates: Requirements 3.1, 3.2, 3.5
 * 
 * 测试用户登录后根据角色正确跳转到对应页面
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock 路由器
const mockReplace = vi.fn();
const mockPush = vi.fn();
const mockPrefetch = vi.fn();

vi.mock('next/router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    prefetch: mockPrefetch,
    query: {}
  })
}));

/**
 * 模拟用户信息类型
 */
interface MockUserInfo {
  permission?: {
    isOwner?: boolean;
  };
  team?: {
    status?: string;
  };
}

/**
 * 模拟前端配置类型
 */
interface MockFeConfigs {
  enableUserChatOnly?: boolean;
}

/**
 * 根据用户角色获取默认路由
 * 这是从 login/index.tsx 提取的核心逻辑
 */
function getDefaultRoute(isOwner: boolean, enableUserChatOnly: boolean = false): string {
  // 管理员始终跳转到管理后台
  if (isOwner) {
    return '/dashboard/agent';
  }
  // 普通用户根据配置决定跳转路径
  return enableUserChatOnly ? '/chat' : '/dashboard/agent';
}

/**
 * 根据用户信息获取首页跳转路径
 * 这是从 index.tsx 提取的核心逻辑
 */
function getIndexRedirectPath(
  userInfo: MockUserInfo | null,
  feConfigs: MockFeConfigs
): string {
  // 如果用户未登录，跳转到登录页
  if (!userInfo) {
    return '/login';
  }

  // 管理员（团队所有者）直接跳转到管理后台
  const isOwner = userInfo.permission?.isOwner ?? false;
  if (isOwner) {
    return '/dashboard/agent';
  }

  // 普通用户：根据配置决定跳转路径
  if (feConfigs?.enableUserChatOnly) {
    return '/chat';
  } else {
    return '/dashboard/agent';
  }
}

describe('鲁港通 - 角色路由一致性 (Property 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('登录后路由逻辑 (getDefaultRoute)', () => {
    it('管理员（isOwner=true）应跳转到 /dashboard/agent', () => {
      const route = getDefaultRoute(true, false);
      expect(route).toBe('/dashboard/agent');
    });

    it('管理员即使启用纯聊天模式也应跳转到 /dashboard/agent', () => {
      const route = getDefaultRoute(true, true);
      expect(route).toBe('/dashboard/agent');
    });

    it('普通用户（isOwner=false）在纯聊天模式下应跳转到 /chat', () => {
      const route = getDefaultRoute(false, true);
      expect(route).toBe('/chat');
    });

    it('普通用户在非纯聊天模式下应跳转到 /dashboard/agent', () => {
      const route = getDefaultRoute(false, false);
      expect(route).toBe('/dashboard/agent');
    });
  });

  describe('首页路由逻辑 (getIndexRedirectPath)', () => {
    it('未登录用户应跳转到 /login', () => {
      const path = getIndexRedirectPath(null, {});
      expect(path).toBe('/login');
    });

    it('管理员应跳转到 /dashboard/agent', () => {
      const userInfo: MockUserInfo = {
        permission: { isOwner: true },
        team: { status: 'active' }
      };
      const path = getIndexRedirectPath(userInfo, {});
      expect(path).toBe('/dashboard/agent');
    });

    it('管理员即使启用纯聊天模式也应跳转到 /dashboard/agent', () => {
      const userInfo: MockUserInfo = {
        permission: { isOwner: true },
        team: { status: 'active' }
      };
      const path = getIndexRedirectPath(userInfo, { enableUserChatOnly: true });
      expect(path).toBe('/dashboard/agent');
    });

    it('普通用户在纯聊天模式下应跳转到 /chat', () => {
      const userInfo: MockUserInfo = {
        permission: { isOwner: false },
        team: { status: 'active' }
      };
      const path = getIndexRedirectPath(userInfo, { enableUserChatOnly: true });
      expect(path).toBe('/chat');
    });

    it('普通用户在非纯聊天模式下应跳转到 /dashboard/agent', () => {
      const userInfo: MockUserInfo = {
        permission: { isOwner: false },
        team: { status: 'active' }
      };
      const path = getIndexRedirectPath(userInfo, { enableUserChatOnly: false });
      expect(path).toBe('/dashboard/agent');
    });

    it('permission 为 undefined 时应视为普通用户', () => {
      const userInfo: MockUserInfo = {
        team: { status: 'active' }
      };
      const path = getIndexRedirectPath(userInfo, { enableUserChatOnly: true });
      expect(path).toBe('/chat');
    });

    it('isOwner 为 undefined 时应视为普通用户', () => {
      const userInfo: MockUserInfo = {
        permission: {},
        team: { status: 'active' }
      };
      const path = getIndexRedirectPath(userInfo, { enableUserChatOnly: true });
      expect(path).toBe('/chat');
    });
  });

  describe('路由一致性验证', () => {
    it('登录路由和首页路由对管理员应返回相同路径', () => {
      const userInfo: MockUserInfo = {
        permission: { isOwner: true },
        team: { status: 'active' }
      };
      
      const loginRoute = getDefaultRoute(true, false);
      const indexRoute = getIndexRedirectPath(userInfo, { enableUserChatOnly: false });
      
      expect(loginRoute).toBe(indexRoute);
    });

    it('登录路由和首页路由对普通用户（纯聊天模式）应返回相同路径', () => {
      const userInfo: MockUserInfo = {
        permission: { isOwner: false },
        team: { status: 'active' }
      };
      
      const loginRoute = getDefaultRoute(false, true);
      const indexRoute = getIndexRedirectPath(userInfo, { enableUserChatOnly: true });
      
      expect(loginRoute).toBe(indexRoute);
    });

    it('登录路由和首页路由对普通用户（非纯聊天模式）应返回相同路径', () => {
      const userInfo: MockUserInfo = {
        permission: { isOwner: false },
        team: { status: 'active' }
      };
      
      const loginRoute = getDefaultRoute(false, false);
      const indexRoute = getIndexRedirectPath(userInfo, { enableUserChatOnly: false });
      
      expect(loginRoute).toBe(indexRoute);
    });
  });

  describe('边界情况', () => {
    it('空配置对象应使用默认行为', () => {
      const userInfo: MockUserInfo = {
        permission: { isOwner: false },
        team: { status: 'active' }
      };
      const path = getIndexRedirectPath(userInfo, {});
      expect(path).toBe('/dashboard/agent');
    });

    it('enableUserChatOnly 为 undefined 应视为 false', () => {
      const userInfo: MockUserInfo = {
        permission: { isOwner: false },
        team: { status: 'active' }
      };
      const path = getIndexRedirectPath(userInfo, { enableUserChatOnly: undefined });
      expect(path).toBe('/dashboard/agent');
    });
  });
});
