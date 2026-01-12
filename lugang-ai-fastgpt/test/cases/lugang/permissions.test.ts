/**
 * 鲁港通平台集成 - 普通用户界面权限测试
 * 
 * Property 8: 普通用户界面权限
 * Validates: Requirements 7.1
 * 
 * 测试普通用户在纯聊天模式下不应看到管理功能入口
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * 模拟用户信息类型
 */
interface MockUserInfo {
  username?: string;
  permission?: {
    isOwner?: boolean;
  };
}

/**
 * 模拟前端配置类型
 */
interface MockFeConfigs {
  enableUserChatOnly?: boolean;
}

/**
 * 导航项类型
 */
interface NavItem {
  label: string;
  link: string;
  showForUser: boolean;
}

/**
 * 模拟导航栏列表生成逻辑
 * 这是从 navbar.tsx 提取的核心逻辑
 */
function getNavbarList(
  userInfo: MockUserInfo | null,
  feConfigs: MockFeConfigs
): NavItem[] {
  // 判断是否为管理员（团队所有者）
  const isOwner = userInfo?.permission?.isOwner ?? false;
  // 是否启用纯聊天模式
  const enableUserChatOnly = !!feConfigs?.enableUserChatOnly;
  // 普通用户在纯聊天模式下隐藏管理功能
  const showAdminFeatures = isOwner || !enableUserChatOnly;

  const baseList: NavItem[] = [
    {
      label: '对话',
      link: '/chat',
      showForUser: true // 普通用户可见
    },
    {
      label: '工作台',
      link: '/dashboard/agent',
      showForUser: false // 仅管理员可见
    },
    {
      label: '知识库',
      link: '/dataset/list',
      showForUser: false // 仅管理员可见
    },
    {
      label: '账号',
      link: '/account/info',
      showForUser: true // 普通用户可见
    }
  ];

  // 根据用户角色过滤导航项
  let filteredList = showAdminFeatures 
    ? baseList 
    : baseList.filter(item => item.showForUser);

  // root 用户添加配置入口
  if (userInfo?.username === 'root') {
    filteredList = [
      ...filteredList,
      {
        label: '配置',
        link: '/config/tool',
        showForUser: false
      }
    ];
  }

  return filteredList;
}

/**
 * 检查导航列表是否包含管理功能
 */
function hasAdminFeatures(navList: NavItem[]): boolean {
  const adminLinks = ['/dashboard/agent', '/dataset/list', '/config/tool'];
  return navList.some(item => adminLinks.includes(item.link));
}

/**
 * 检查导航列表是否包含聊天功能
 */
function hasChatFeature(navList: NavItem[]): boolean {
  return navList.some(item => item.link === '/chat');
}

/**
 * 检查导航列表是否包含账号功能
 */
function hasAccountFeature(navList: NavItem[]): boolean {
  return navList.some(item => item.link === '/account/info');
}

describe('鲁港通 - 普通用户界面权限 (Property 8)', () => {
  describe('管理员用户导航', () => {
    it('管理员应看到所有导航项', () => {
      const userInfo: MockUserInfo = {
        username: 'admin',
        permission: { isOwner: true }
      };
      const navList = getNavbarList(userInfo, { enableUserChatOnly: false });
      
      expect(hasChatFeature(navList)).toBe(true);
      expect(hasAdminFeatures(navList)).toBe(true);
      expect(hasAccountFeature(navList)).toBe(true);
    });

    it('管理员即使启用纯聊天模式也应看到所有导航项', () => {
      const userInfo: MockUserInfo = {
        username: 'admin',
        permission: { isOwner: true }
      };
      const navList = getNavbarList(userInfo, { enableUserChatOnly: true });
      
      expect(hasChatFeature(navList)).toBe(true);
      expect(hasAdminFeatures(navList)).toBe(true);
      expect(hasAccountFeature(navList)).toBe(true);
    });

    it('root 用户应看到配置入口', () => {
      const userInfo: MockUserInfo = {
        username: 'root',
        permission: { isOwner: true }
      };
      const navList = getNavbarList(userInfo, { enableUserChatOnly: false });
      
      const hasConfig = navList.some(item => item.link === '/config/tool');
      expect(hasConfig).toBe(true);
    });
  });

  describe('普通用户导航（纯聊天模式）', () => {
    it('普通用户在纯聊天模式下不应看到工作台', () => {
      const userInfo: MockUserInfo = {
        username: 'user',
        permission: { isOwner: false }
      };
      const navList = getNavbarList(userInfo, { enableUserChatOnly: true });
      
      const hasStudio = navList.some(item => item.link === '/dashboard/agent');
      expect(hasStudio).toBe(false);
    });

    it('普通用户在纯聊天模式下不应看到知识库', () => {
      const userInfo: MockUserInfo = {
        username: 'user',
        permission: { isOwner: false }
      };
      const navList = getNavbarList(userInfo, { enableUserChatOnly: true });
      
      const hasDataset = navList.some(item => item.link === '/dataset/list');
      expect(hasDataset).toBe(false);
    });

    it('普通用户在纯聊天模式下应看到对话入口', () => {
      const userInfo: MockUserInfo = {
        username: 'user',
        permission: { isOwner: false }
      };
      const navList = getNavbarList(userInfo, { enableUserChatOnly: true });
      
      expect(hasChatFeature(navList)).toBe(true);
    });

    it('普通用户在纯聊天模式下应看到账号入口', () => {
      const userInfo: MockUserInfo = {
        username: 'user',
        permission: { isOwner: false }
      };
      const navList = getNavbarList(userInfo, { enableUserChatOnly: true });
      
      expect(hasAccountFeature(navList)).toBe(true);
    });

    it('普通用户在纯聊天模式下导航项数量应为 2', () => {
      const userInfo: MockUserInfo = {
        username: 'user',
        permission: { isOwner: false }
      };
      const navList = getNavbarList(userInfo, { enableUserChatOnly: true });
      
      expect(navList.length).toBe(2);
    });
  });

  describe('普通用户导航（非纯聊天模式）', () => {
    it('普通用户在非纯聊天模式下应看到所有导航项', () => {
      const userInfo: MockUserInfo = {
        username: 'user',
        permission: { isOwner: false }
      };
      const navList = getNavbarList(userInfo, { enableUserChatOnly: false });
      
      expect(hasChatFeature(navList)).toBe(true);
      expect(hasAdminFeatures(navList)).toBe(true);
      expect(hasAccountFeature(navList)).toBe(true);
    });

    it('普通用户在非纯聊天模式下导航项数量应为 4', () => {
      const userInfo: MockUserInfo = {
        username: 'user',
        permission: { isOwner: false }
      };
      const navList = getNavbarList(userInfo, { enableUserChatOnly: false });
      
      expect(navList.length).toBe(4);
    });
  });

  describe('边界情况', () => {
    it('userInfo 为 null 时应视为普通用户', () => {
      const navList = getNavbarList(null, { enableUserChatOnly: true });
      
      expect(hasAdminFeatures(navList)).toBe(false);
      expect(navList.length).toBe(2);
    });

    it('permission 为 undefined 时应视为普通用户', () => {
      const userInfo: MockUserInfo = {
        username: 'user'
      };
      const navList = getNavbarList(userInfo, { enableUserChatOnly: true });
      
      expect(hasAdminFeatures(navList)).toBe(false);
    });

    it('isOwner 为 undefined 时应视为普通用户', () => {
      const userInfo: MockUserInfo = {
        username: 'user',
        permission: {}
      };
      const navList = getNavbarList(userInfo, { enableUserChatOnly: true });
      
      expect(hasAdminFeatures(navList)).toBe(false);
    });

    it('enableUserChatOnly 为 undefined 时应视为 false', () => {
      const userInfo: MockUserInfo = {
        username: 'user',
        permission: { isOwner: false }
      };
      const navList = getNavbarList(userInfo, {});
      
      // 非纯聊天模式，应显示所有导航项
      expect(hasAdminFeatures(navList)).toBe(true);
    });
  });

  describe('导航项属性验证', () => {
    it('所有导航项应有正确的 showForUser 属性', () => {
      const userInfo: MockUserInfo = {
        username: 'admin',
        permission: { isOwner: true }
      };
      const navList = getNavbarList(userInfo, { enableUserChatOnly: false });
      
      // 对话和账号应该对普通用户可见
      const chatItem = navList.find(item => item.link === '/chat');
      const accountItem = navList.find(item => item.link === '/account/info');
      
      expect(chatItem?.showForUser).toBe(true);
      expect(accountItem?.showForUser).toBe(true);
      
      // 工作台和知识库应该仅对管理员可见
      const studioItem = navList.find(item => item.link === '/dashboard/agent');
      const datasetItem = navList.find(item => item.link === '/dataset/list');
      
      expect(studioItem?.showForUser).toBe(false);
      expect(datasetItem?.showForUser).toBe(false);
    });
  });
});
