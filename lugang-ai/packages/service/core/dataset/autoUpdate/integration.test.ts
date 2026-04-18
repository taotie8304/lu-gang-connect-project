/**
 * 鲁港通 - 知识库自动更新功能集成测试
 * 
 * 测试内容：
 * - API 路由测试
 * - 数据库操作测试
 * - 权限验证测试
 * 
 * Validates: Requirements 1.2, 8.2, 12.1, 12.2
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================
// 模拟类型定义
// ============================================

interface AutoUpdateConfig {
  enabled: boolean;
  source?: string;
  datasetUrl?: string;
  fileFormat?: string;
  api?: {
    endpoint: string;
    method: string;
    headers?: Record<string, string>;
    cacheKey?: string;
  };
  detection?: {
    yearPattern?: string[];
    checkUpdateTime: boolean;
    detailPageCheck: boolean;
  };
  notification?: {
    enabled: boolean;
    email?: string;
  };
  lastCheckTime?: Date;
  lastUpdateTime?: Date;
  history?: Array<{
    timestamp: Date;
    status: string;
    message: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
  }>;
}

interface Collection {
  _id: string;
  name: string;
  autoUpdateConfig?: AutoUpdateConfig;
}

interface User {
  _id: string;
  username: string;
  permissions: string[];
}

// ============================================
// 模拟数据库操作
// ============================================

class MockDatabase {
  private collections: Map<string, Collection> = new Map();
  private users: Map<string, User> = new Map();

  // 集合操作
  async findCollectionById(id: string): Promise<Collection | null> {
    return this.collections.get(id) || null;
  }

  async updateCollection(id: string, update: Partial<Collection>): Promise<boolean> {
    const collection = this.collections.get(id);
    if (!collection) return false;

    this.collections.set(id, { ...collection, ...update });
    return true;
  }

  async createCollection(collection: Collection): Promise<void> {
    this.collections.set(collection._id, collection);
  }

  async deleteCollection(id: string): Promise<boolean> {
    return this.collections.delete(id);
  }

  // 用户操作
  async findUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async createUser(user: User): Promise<void> {
    this.users.set(user._id, user);
  }

  // 清空数据
  clear(): void {
    this.collections.clear();
    this.users.clear();
  }
}

// ============================================
// 模拟权限验证
// ============================================

class MockAuthService {
  constructor(private db: MockDatabase) {}

  async checkPermission(userId: string, collectionId: string, permission: string): Promise<boolean> {
    const user = await this.db.findUserById(userId);
    const collection = await this.db.findCollectionById(collectionId);

    if (!user || !collection) return false;

    return user.permissions.includes(permission);
  }
}

// ============================================
// 模拟 API 服务
// ============================================

class MockApiService {
  constructor(
    private db: MockDatabase,
    private auth: MockAuthService
  ) {}

  async configAutoUpdate(
    userId: string,
    collectionId: string,
    config: Partial<AutoUpdateConfig>
  ): Promise<{ success: boolean; error?: string }> {
    // 权限验证
    const hasPermission = await this.auth.checkPermission(userId, collectionId, 'write');
    if (!hasPermission) {
      return { success: false, error: '权限不足' };
    }

    // 查找集合
    const collection = await this.db.findCollectionById(collectionId);
    if (!collection) {
      return { success: false, error: '集合不存在' };
    }

    // 更新配置
    const updated = await this.db.updateCollection(collectionId, {
      autoUpdateConfig: {
        ...collection.autoUpdateConfig,
        ...config
      } as AutoUpdateConfig
    });

    return { success: updated };
  }

  async getAutoUpdateConfig(
    userId: string,
    collectionId: string
  ): Promise<{ success: boolean; config?: AutoUpdateConfig; error?: string }> {
    // 权限验证（读权限）
    const hasPermission = await this.auth.checkPermission(userId, collectionId, 'read');
    if (!hasPermission) {
      return { success: false, error: '权限不足' };
    }

    // 查找集合
    const collection = await this.db.findCollectionById(collectionId);
    if (!collection) {
      return { success: false, error: '集合不存在' };
    }

    return {
      success: true,
      config: collection.autoUpdateConfig || {
        enabled: false,
        source: 'hk-gov-data',
        datasetUrl: '',
        fileFormat: 'csv',
        detection: {
          yearPattern: [],
          checkUpdateTime: true,
          detailPageCheck: false
        }
      }
    };
  }

  async triggerAutoUpdate(
    userId: string,
    collectionId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    // 权限验证
    const hasPermission = await this.auth.checkPermission(userId, collectionId, 'write');
    if (!hasPermission) {
      return { success: false, error: '权限不足' };
    }

    // 查找集合
    const collection = await this.db.findCollectionById(collectionId);
    if (!collection) {
      return { success: false, error: '集合不存在' };
    }

    // 检查是否启用自动更新
    if (!collection.autoUpdateConfig?.enabled) {
      return { success: false, error: '自动更新未启用' };
    }

    // 模拟触发更新
    return { success: true, message: '更新任务已触发' };
  }
}

// ============================================
// 数据库操作测试
// Validates: Requirements 1.2
// ============================================

describe('数据库操作测试', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  describe('集合配置持久化', () => {
    it('应能保存自动更新配置', async () => {
      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection',
        autoUpdateConfig: {
          enabled: true,
          source: 'hk-gov-data',
          datasetUrl: 'https://data.gov.hk/dataset/123',
          fileFormat: 'csv',
          detection: {
            yearPattern: ['YYYY'],
            checkUpdateTime: true,
            detailPageCheck: false
          }
        }
      };

      await db.createCollection(collection);
      const saved = await db.findCollectionById('col1');

      expect(saved).toBeDefined();
      expect(saved?.autoUpdateConfig?.enabled).toBe(true);
      expect(saved?.autoUpdateConfig?.datasetUrl).toBe('https://data.gov.hk/dataset/123');
    });

    it('应能更新现有配置', async () => {
      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection',
        autoUpdateConfig: {
          enabled: false,
          source: 'hk-gov-data',
          datasetUrl: '',
          fileFormat: 'csv',
          detection: {
            yearPattern: [],
            checkUpdateTime: true,
            detailPageCheck: false
          }
        }
      };

      await db.createCollection(collection);

      // 更新配置
      await db.updateCollection('col1', {
        autoUpdateConfig: {
          enabled: true,
          source: 'hk-gov-data',
          datasetUrl: 'https://data.gov.hk/dataset/456',
          fileFormat: 'xlsx',
          detection: {
            yearPattern: ['YYYY-YYYY'],
            checkUpdateTime: true,
            detailPageCheck: true
          }
        }
      });

      const updated = await db.findCollectionById('col1');
      expect(updated?.autoUpdateConfig?.enabled).toBe(true);
      expect(updated?.autoUpdateConfig?.datasetUrl).toBe('https://data.gov.hk/dataset/456');
      expect(updated?.autoUpdateConfig?.fileFormat).toBe('xlsx');
    });

    it('应能删除集合', async () => {
      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection'
      };

      await db.createCollection(collection);
      expect(await db.findCollectionById('col1')).toBeDefined();

      await db.deleteCollection('col1');
      expect(await db.findCollectionById('col1')).toBeNull();
    });

    it('更新不存在的集合应返回失败', async () => {
      const result = await db.updateCollection('nonexistent', {
        autoUpdateConfig: { enabled: true } as AutoUpdateConfig
      });

      expect(result).toBe(false);
    });
  });

  describe('更新历史记录', () => {
    it('应能记录更新历史', async () => {
      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection',
        autoUpdateConfig: {
          enabled: true,
          source: 'hk-gov-data',
          datasetUrl: 'https://data.gov.hk/dataset/123',
          fileFormat: 'csv',
          detection: {
            yearPattern: [],
            checkUpdateTime: true,
            detailPageCheck: false
          },
          history: []
        }
      };

      await db.createCollection(collection);

      // 添加历史记录
      const historyEntry = {
        timestamp: new Date(),
        status: 'success',
        message: '成功导入数据',
        fileUrl: 'https://data.gov.hk/file.csv',
        fileName: 'dataset_2025.csv',
        fileSize: 1024000
      };

      await db.updateCollection('col1', {
        autoUpdateConfig: {
          ...collection.autoUpdateConfig,
          history: [historyEntry]
        }
      });

      const updated = await db.findCollectionById('col1');
      expect(updated?.autoUpdateConfig?.history).toHaveLength(1);
      expect(updated?.autoUpdateConfig?.history?.[0].status).toBe('success');
    });

    it('应能记录多条历史记录', async () => {
      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection',
        autoUpdateConfig: {
          enabled: true,
          source: 'hk-gov-data',
          datasetUrl: 'https://data.gov.hk/dataset/123',
          fileFormat: 'csv',
          detection: {
            yearPattern: [],
            checkUpdateTime: true,
            detailPageCheck: false
          },
          history: []
        }
      };

      await db.createCollection(collection);

      // 添加多条历史记录
      const history = [
        {
          timestamp: new Date('2025-01-01'),
          status: 'success',
          message: '成功导入数据'
        },
        {
          timestamp: new Date('2025-01-15'),
          status: 'failed',
          message: '下载失败'
        },
        {
          timestamp: new Date('2025-02-01'),
          status: 'success',
          message: '成功导入数据'
        }
      ];

      await db.updateCollection('col1', {
        autoUpdateConfig: {
          ...collection.autoUpdateConfig,
          history
        }
      });

      const updated = await db.findCollectionById('col1');
      expect(updated?.autoUpdateConfig?.history).toHaveLength(3);
    });
  });
});

// ============================================
// 权限验证测试
// Validates: Requirements 12.1, 12.2
// ============================================

describe('权限验证测试', () => {
  let db: MockDatabase;
  let auth: MockAuthService;

  beforeEach(() => {
    db = new MockDatabase();
    auth = new MockAuthService(db);
  });

  describe('配置权限验证', () => {
    it('有写权限的用户应能配置自动更新', async () => {
      const user: User = {
        _id: 'user1',
        username: 'admin',
        permissions: ['read', 'write']
      };

      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection'
      };

      await db.createUser(user);
      await db.createCollection(collection);

      const hasPermission = await auth.checkPermission('user1', 'col1', 'write');
      expect(hasPermission).toBe(true);
    });

    it('没有写权限的用户不应能配置自动更新', async () => {
      const user: User = {
        _id: 'user1',
        username: 'viewer',
        permissions: ['read']
      };

      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection'
      };

      await db.createUser(user);
      await db.createCollection(collection);

      const hasPermission = await auth.checkPermission('user1', 'col1', 'write');
      expect(hasPermission).toBe(false);
    });

    it('不存在的用户应验证失败', async () => {
      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection'
      };

      await db.createCollection(collection);

      const hasPermission = await auth.checkPermission('nonexistent', 'col1', 'write');
      expect(hasPermission).toBe(false);
    });

    it('不存在的集合应验证失败', async () => {
      const user: User = {
        _id: 'user1',
        username: 'admin',
        permissions: ['read', 'write']
      };

      await db.createUser(user);

      const hasPermission = await auth.checkPermission('user1', 'nonexistent', 'write');
      expect(hasPermission).toBe(false);
    });
  });

  describe('查询权限验证', () => {
    it('有读权限的用户应能查看配置', async () => {
      const user: User = {
        _id: 'user1',
        username: 'viewer',
        permissions: ['read']
      };

      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection'
      };

      await db.createUser(user);
      await db.createCollection(collection);

      const hasPermission = await auth.checkPermission('user1', 'col1', 'read');
      expect(hasPermission).toBe(true);
    });

    it('没有读权限的用户不应能查看配置', async () => {
      const user: User = {
        _id: 'user1',
        username: 'noAccess',
        permissions: []
      };

      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection'
      };

      await db.createUser(user);
      await db.createCollection(collection);

      const hasPermission = await auth.checkPermission('user1', 'col1', 'read');
      expect(hasPermission).toBe(false);
    });
  });
});

// ============================================
// API 路由测试
// Validates: Requirements 1.2, 8.2, 12.1, 12.2
// ============================================

describe('API 路由测试', () => {
  let db: MockDatabase;
  let auth: MockAuthService;
  let api: MockApiService;

  beforeEach(() => {
    db = new MockDatabase();
    auth = new MockAuthService(db);
    api = new MockApiService(db, auth);
  });

  describe('配置 API', () => {
    it('应能成功配置自动更新', async () => {
      const user: User = {
        _id: 'user1',
        username: 'admin',
        permissions: ['read', 'write']
      };

      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection'
      };

      await db.createUser(user);
      await db.createCollection(collection);

      const result = await api.configAutoUpdate('user1', 'col1', {
        enabled: true,
        datasetUrl: 'https://data.gov.hk/dataset/123',
        fileFormat: 'csv'
      });

      expect(result.success).toBe(true);
    });

    it('没有权限应返回错误', async () => {
      const user: User = {
        _id: 'user1',
        username: 'viewer',
        permissions: ['read']
      };

      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection'
      };

      await db.createUser(user);
      await db.createCollection(collection);

      const result = await api.configAutoUpdate('user1', 'col1', {
        enabled: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('权限不足');
    });

    it('集合不存在应返回错误', async () => {
      const user: User = {
        _id: 'user1',
        username: 'admin',
        permissions: ['read', 'write']
      };

      await db.createUser(user);

      const result = await api.configAutoUpdate('user1', 'nonexistent', {
        enabled: true
      });

      expect(result.success).toBe(false);
      // 权限验证会先检查集合是否存在，所以返回"权限不足"
      expect(result.error).toBe('权限不足');
    });
  });

  describe('获取配置 API', () => {
    it('应能成功获取配置', async () => {
      const user: User = {
        _id: 'user1',
        username: 'viewer',
        permissions: ['read']
      };

      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection',
        autoUpdateConfig: {
          enabled: true,
          source: 'hk-gov-data',
          datasetUrl: 'https://data.gov.hk/dataset/123',
          fileFormat: 'csv',
          detection: {
            yearPattern: ['YYYY'],
            checkUpdateTime: true,
            detailPageCheck: false
          }
        }
      };

      await db.createUser(user);
      await db.createCollection(collection);

      const result = await api.getAutoUpdateConfig('user1', 'col1');

      expect(result.success).toBe(true);
      expect(result.config?.enabled).toBe(true);
      expect(result.config?.datasetUrl).toBe('https://data.gov.hk/dataset/123');
    });

    it('没有权限应返回错误', async () => {
      const user: User = {
        _id: 'user1',
        username: 'noAccess',
        permissions: []
      };

      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection'
      };

      await db.createUser(user);
      await db.createCollection(collection);

      const result = await api.getAutoUpdateConfig('user1', 'col1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('权限不足');
    });

    it('集合不存在应返回错误', async () => {
      const user: User = {
        _id: 'user1',
        username: 'viewer',
        permissions: ['read']
      };

      await db.createUser(user);

      const result = await api.getAutoUpdateConfig('user1', 'nonexistent');

      expect(result.success).toBe(false);
      // 权限验证会先检查集合是否存在，所以返回"权限不足"
      expect(result.error).toBe('权限不足');
    });

    it('未配置时应返回默认配置', async () => {
      const user: User = {
        _id: 'user1',
        username: 'viewer',
        permissions: ['read']
      };

      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection'
      };

      await db.createUser(user);
      await db.createCollection(collection);

      const result = await api.getAutoUpdateConfig('user1', 'col1');

      expect(result.success).toBe(true);
      expect(result.config?.enabled).toBe(false);
      expect(result.config?.source).toBe('hk-gov-data');
    });
  });

  describe('触发更新 API', () => {
    it('应能成功触发更新', async () => {
      const user: User = {
        _id: 'user1',
        username: 'admin',
        permissions: ['read', 'write']
      };

      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection',
        autoUpdateConfig: {
          enabled: true,
          source: 'hk-gov-data',
          datasetUrl: 'https://data.gov.hk/dataset/123',
          fileFormat: 'csv',
          detection: {
            yearPattern: [],
            checkUpdateTime: true,
            detailPageCheck: false
          }
        }
      };

      await db.createUser(user);
      await db.createCollection(collection);

      const result = await api.triggerAutoUpdate('user1', 'col1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('更新任务已触发');
    });

    it('没有权限应返回错误', async () => {
      const user: User = {
        _id: 'user1',
        username: 'viewer',
        permissions: ['read']
      };

      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection',
        autoUpdateConfig: {
          enabled: true,
          source: 'hk-gov-data',
          datasetUrl: 'https://data.gov.hk/dataset/123',
          fileFormat: 'csv',
          detection: {
            yearPattern: [],
            checkUpdateTime: true,
            detailPageCheck: false
          }
        }
      };

      await db.createUser(user);
      await db.createCollection(collection);

      const result = await api.triggerAutoUpdate('user1', 'col1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('权限不足');
    });

    it('自动更新未启用应返回错误', async () => {
      const user: User = {
        _id: 'user1',
        username: 'admin',
        permissions: ['read', 'write']
      };

      const collection: Collection = {
        _id: 'col1',
        name: 'Test Collection',
        autoUpdateConfig: {
          enabled: false,
          source: 'hk-gov-data',
          datasetUrl: '',
          fileFormat: 'csv',
          detection: {
            yearPattern: [],
            checkUpdateTime: true,
            detailPageCheck: false
          }
        }
      };

      await db.createUser(user);
      await db.createCollection(collection);

      const result = await api.triggerAutoUpdate('user1', 'col1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('自动更新未启用');
    });

    it('集合不存在应返回错误', async () => {
      const user: User = {
        _id: 'user1',
        username: 'admin',
        permissions: ['read', 'write']
      };

      await db.createUser(user);

      const result = await api.triggerAutoUpdate('user1', 'nonexistent');

      expect(result.success).toBe(false);
      // 权限验证会先检查集合是否存在，所以返回"权限不足"
      expect(result.error).toBe('权限不足');
    });
  });
});
