/**
 * 鲁港通 - Task 15 Checkpoint 测试
 * 验证第三阶段（知识库权限控制和用户同步）的所有功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isAdminUser,
  canUserViewCitationSource,
  filterCitationsByUserRole
} from '@fastgpt/global/support/permission/citation';
import type { UserType } from '@fastgpt/global/support/user/type';
import type { TeamTmbItemType } from '@fastgpt/global/support/user/team/type';
import { TeamMemberRoleEnum } from '@fastgpt/global/support/user/team/constant';
import { validateUserRegistration } from '@fastgpt/global/support/user/validation';

describe('Task 15 Checkpoint: 权限控制和用户同步', () => {
  // 模拟用户数据
  let adminUser: UserType;
  let normalUser: UserType;

  beforeEach(() => {
    // 创建管理员用户
    adminUser = {
      _id: 'admin-id',
      username: 'root',
      avatar: '/avatar.png',
      timezone: 'Asia/Shanghai',
      promotionRate: 0,
      team: {
        teamId: 'team-id',
        teamName: '管理员团队',
        avatar: '/avatar.png',
        balance: 0,
        role: TeamMemberRoleEnum.owner,
        status: 'active',
        tmbId: 'tmb-id',
        defaultTeam: true,
        canWrite: true,
        maxSize: 1000000
      } as TeamTmbItemType,
      permission: {} as any
    };

    // 创建普通用户
    normalUser = {
      _id: 'user-id',
      username: 'user@example.com',
      avatar: '/avatar.png',
      timezone: 'Asia/Shanghai',
      promotionRate: 0,
      team: {
        teamId: 'team-id',
        teamName: '用户团队',
        avatar: '/avatar.png',
        balance: 0,
        role: TeamMemberRoleEnum.member,
        status: 'active',
        tmbId: 'tmb-id',
        defaultTeam: true,
        canWrite: true,
        maxSize: 1000000
      } as TeamTmbItemType,
      permission: {} as any
    };
  });

  describe('1. 知识库引用权限控制', () => {
    it('应该正确识别管理员用户', () => {
      expect(isAdminUser(adminUser.username)).toBe(true);
      expect(isAdminUser(normalUser.username)).toBe(false);
    });

    it('普通用户不能查看知识库文件引用', () => {
      const collectionType = undefined; // dataset 类型
      const sourceId = 'dataset-file-123';

      expect(canUserViewCitationSource(normalUser.username, collectionType, sourceId)).toBe(false);
    });

    it('普通用户可以查看 URL 引用', () => {
      const collectionType = undefined;
      const sourceId = 'https://example.com';

      expect(canUserViewCitationSource(normalUser.username, collectionType, sourceId)).toBe(true);
    });

    it('管理员可以查看所有类型的引用', () => {
      const datasetSourceId = 'dataset-file-123';
      const urlSourceId = 'https://example.com';

      expect(canUserViewCitationSource(adminUser.username, undefined, datasetSourceId)).toBe(true);
      expect(canUserViewCitationSource(adminUser.username, undefined, urlSourceId)).toBe(true);
    });

    it('应该正确过滤普通用户的引用列表', () => {
      const citations: any[] = [
        {
          id: 'cite-1',
          title: '知识库文档1',
          sourceId: 'dataset-file-1',
          sourceName: 'dataset'
        },
        {
          id: 'cite-2',
          title: '外部链接',
          sourceId: 'https://example.com',
          sourceName: 'url'
        },
        {
          id: 'cite-3',
          title: '知识库文档2',
          sourceId: 'dataset-file-2',
          sourceName: 'dataset'
        }
      ];

      const filtered = filterCitationsByUserRole(citations, normalUser.username);
      
      // 普通用户只能看到 URL 类型的引用
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('cite-2');
      expect(filtered[0].sourceId).toBe('https://example.com');
    });

    it('管理员应该看到所有引用', () => {
      const citations: any[] = [
        {
          id: 'cite-1',
          title: '知识库文档1',
          sourceId: 'dataset-file-1',
          sourceName: 'dataset'
        },
        {
          id: 'cite-2',
          title: '外部链接',
          sourceId: 'https://example.com',
          sourceName: 'url'
        },
        {
          id: 'cite-3',
          title: '知识库文档2',
          sourceId: 'dataset-file-2',
          sourceName: 'dataset'
        }
      ];

      const filtered = filterCitationsByUserRole(citations, adminUser.username);
      
      // 管理员可以看到所有引用
      expect(filtered).toHaveLength(3);
    });
  });

  describe('2. 用户信息扩展验证', () => {
    it('邮箱注册时必须提供手机号', () => {
      const result1 = validateUserRegistration('user@example.com', undefined, undefined);
      expect(result1.valid).toBe(false);
      expect(result1.error).toContain('手机号');

      const result2 = validateUserRegistration('user@example.com', undefined, '13800138000');
      expect(result2.valid).toBe(true);
    });

    it('手机号注册时必须提供邮箱', () => {
      const result1 = validateUserRegistration('13800138000', undefined, undefined);
      expect(result1.valid).toBe(false);
      expect(result1.error).toContain('邮箱');

      const result2 = validateUserRegistration('13800138000', 'user@example.com', undefined);
      expect(result2.valid).toBe(true);
    });

    it('应该拒绝无效的邮箱格式', () => {
      const result = validateUserRegistration('13800138000', 'invalid-email', undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('邮箱');
    });

    it('应该拒绝无效的手机号格式', () => {
      const result = validateUserRegistration('user@example.com', undefined, '12345678901');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('手机号');
    });
  });

  describe('3. 综合场景测试', () => {
    it('场景1: 普通用户注册并查看引用', () => {
      // 1. 验证注册信息
      const registrationData = {
        username: 'newuser@example.com',
        email: undefined,
        phone: '13900139000'
      };

      const validation = validateUserRegistration(
        registrationData.username,
        registrationData.email,
        registrationData.phone
      );

      expect(validation.valid).toBe(true);

      // 2. 模拟用户创建后查看引用
      const newUsername = registrationData.username;

      const citations: any[] = [
        {
          id: 'cite-1',
          title: '知识库文档',
          sourceId: 'dataset-file-1',
          sourceName: 'dataset'
        },
        {
          id: 'cite-2',
          title: '外部链接',
          sourceId: 'https://example.com',
          sourceName: 'url'
        }
      ];

      const visibleCitations = filterCitationsByUserRole(citations, newUsername);

      // 普通用户只能看到 URL 引用
      expect(visibleCitations).toHaveLength(1);
      expect(visibleCitations[0].sourceId).toBe('https://example.com');
    });

    it('场景2: 管理员查看所有引用', () => {
      const citations: any[] = [
        {
          id: 'cite-1',
          title: '知识库文档1',
          sourceId: 'dataset-file-1',
          sourceName: 'dataset'
        },
        {
          id: 'cite-2',
          title: '知识库文档2',
          sourceId: 'dataset-file-2',
          sourceName: 'dataset'
        },
        {
          id: 'cite-3',
          title: '外部链接',
          sourceId: 'https://example.com',
          sourceName: 'url'
        }
      ];

      const visibleCitations = filterCitationsByUserRole(citations, adminUser.username);

      // 管理员可以看到所有引用
      expect(visibleCitations).toHaveLength(3);
      expect(visibleCitations.some(c => c.sourceId.startsWith('dataset'))).toBe(true);
      expect(visibleCitations.some(c => c.sourceId.startsWith('https'))).toBe(true);
    });

    it('场景3: 不同用户角色的权限隔离', () => {
      const datasetSourceId = 'dataset-file-sensitive';

      // 普通用户无法查看
      expect(canUserViewCitationSource(normalUser.username, undefined, datasetSourceId)).toBe(false);

      // 管理员可以查看
      expect(canUserViewCitationSource(adminUser.username, undefined, datasetSourceId)).toBe(true);

      // 验证权限隔离
      expect(isAdminUser(normalUser.username)).toBe(false);
      expect(isAdminUser(adminUser.username)).toBe(true);
    });
  });

  describe('4. 边界情况测试', () => {
    it('应该处理空引用列表', () => {
      const emptyCitations: any[] = [];

      expect(filterCitationsByUserRole(emptyCitations, normalUser.username)).toHaveLength(0);
      expect(filterCitationsByUserRole(emptyCitations, adminUser.username)).toHaveLength(0);
    });

    it('应该处理只有知识库引用的情况', () => {
      const datasetOnlyCitations: any[] = [
        {
          id: 'cite-1',
          title: '知识库文档1',
          sourceId: 'dataset-file-1',
          sourceName: 'dataset'
        },
        {
          id: 'cite-2',
          title: '知识库文档2',
          sourceId: 'dataset-file-2',
          sourceName: 'dataset'
        }
      ];

      // 普通用户看不到任何引用
      expect(filterCitationsByUserRole(datasetOnlyCitations, normalUser.username)).toHaveLength(0);

      // 管理员可以看到所有引用
      expect(filterCitationsByUserRole(datasetOnlyCitations, adminUser.username)).toHaveLength(2);
    });

    it('应该处理只有 URL 引用的情况', () => {
      const urlOnlyCitations: any[] = [
        {
          id: 'cite-1',
          title: '外部链接1',
          sourceId: 'https://example1.com',
          sourceName: 'url'
        },
        {
          id: 'cite-2',
          title: '外部链接2',
          sourceId: 'https://example2.com',
          sourceName: 'url'
        }
      ];

      // 普通用户和管理员都可以看到所有 URL 引用
      expect(filterCitationsByUserRole(urlOnlyCitations, normalUser.username)).toHaveLength(2);
      expect(filterCitationsByUserRole(urlOnlyCitations, adminUser.username)).toHaveLength(2);
    });
  });
});
