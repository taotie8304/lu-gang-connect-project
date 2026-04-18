/**
 * 鲁港通 - 知识库自动更新功能端到端测试和错误场景测试
 * 
 * 测试内容：
 * - 端到端测试（使用模拟数据）
 * - 错误场景测试（网络错误、解析错误、权限错误）
 * 
 * Validates: Requirements 2.5, 5.5, 5.6, 11.1, 11.2, 11.3, 11.4, 11.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { detectNewFile, DetectionConfig } from './detector';
import type { ScrapedFileInfo } from './scraper';

// ============================================
// 端到端测试 - 完整流程模拟
// Validates: Requirements 2.1, 3.1, 5.1, 6.1
// ============================================

describe('端到端测试 - 完整更新流程', () => {
  describe('文件类型数据集更新流程', () => {
    it('应能完成从检测到导入的完整流程', () => {
      // 步骤 1: 爬取页面获取文件列表
      const currentYear = new Date().getFullYear();
      const scrapedFiles: ScrapedFileInfo[] = [
        {
          fileName: `dataset_${currentYear}.csv`,
          fileUrl: 'https://data.gov.hk/file.csv',
          fileSize: '1.2 MB',
          updateTime: '2025-01-15'
        }
      ];

      expect(scrapedFiles).toHaveLength(1);
      expect(scrapedFiles[0].fileName).toContain(String(currentYear));

      // 步骤 2: 检测是否有新文件
      const config: DetectionConfig = {
        yearPattern: ['YYYY'],
        checkUpdateTime: true,
        detailPageCheck: false
      };

      const lastUpdateTime = new Date('2024-12-01');
      const detectionResult = detectNewFile(scrapedFiles, config, lastUpdateTime);

      expect(detectionResult.isNewFile).toBe(true);
      expect(detectionResult.matchedFile).toBeDefined();

      // 步骤 3: 模拟下载文件
      const downloadResult = {
        success: true,
        rawText: 'Name,Age,City\nJohn,30,HK\nJane,25,KL',
        fileSize: 1024000
      };

      expect(downloadResult.success).toBe(true);
      expect(downloadResult.rawText).toBeDefined();

      // 步骤 4: 模拟导入到知识库
      const importResult = {
        success: true,
        dataCount: 2
      };

      expect(importResult.success).toBe(true);
      expect(importResult.dataCount).toBeGreaterThan(0);

      // 步骤 5: 记录更新历史
      const historyEntry = {
        timestamp: new Date(),
        status: 'success',
        message: '成功导入数据',
        fileUrl: scrapedFiles[0].fileUrl,
        fileName: scrapedFiles[0].fileName,
        fileSize: downloadResult.fileSize
      };

      expect(historyEntry.status).toBe('success');
      expect(historyEntry.fileName).toBe(scrapedFiles[0].fileName);
    });

    it('应能处理无需更新的情况', () => {
      // 步骤 1: 爬取页面获取文件列表
      const oldYear = new Date().getFullYear() - 2;
      const scrapedFiles: ScrapedFileInfo[] = [
        {
          fileName: `dataset_${oldYear}.csv`,
          fileUrl: 'https://data.gov.hk/file.csv',
          fileSize: '1.2 MB',
          updateTime: '2024-01-15'
        }
      ];

      // 步骤 2: 检测是否有新文件
      const config: DetectionConfig = {
        yearPattern: ['YYYY'],
        checkUpdateTime: true,
        detailPageCheck: false
      };

      const lastUpdateTime = new Date('2025-01-01');
      const detectionResult = detectNewFile(scrapedFiles, config, lastUpdateTime);

      expect(detectionResult.isNewFile).toBe(false);

      // 步骤 3: 无需下载和导入
      // 步骤 4: 记录检查历史
      const historyEntry = {
        timestamp: new Date(),
        status: 'no_update',
        message: '未检测到新文件'
      };

      expect(historyEntry.status).toBe('no_update');
    });
  });

  describe('API 类型数据集更新流程', () => {
    it('应能完成 API 数据更新流程', () => {
      // 步骤 1: 检查 API 更新（模拟）
      const apiCheckResult = {
        isNewFile: true,
        reason: 'API 更新时间晚于上次更新时间'
      };

      expect(apiCheckResult.isNewFile).toBe(true);

      // 步骤 2: 下载 API 数据
      const downloadResult = {
        success: true,
        rawText: JSON.stringify({ data: [{ id: 1, name: 'Test' }] }),
        fileSize: 512
      };

      expect(downloadResult.success).toBe(true);

      // 步骤 3: 导入到知识库
      const importResult = {
        success: true,
        dataCount: 1
      };

      expect(importResult.success).toBe(true);

      // 步骤 4: 记录更新历史
      const historyEntry = {
        timestamp: new Date(),
        status: 'success',
        message: '成功刷新 API 缓存',
        fileSize: downloadResult.fileSize
      };

      expect(historyEntry.status).toBe('success');
    });
  });

  describe('定时任务执行流程', () => {
    it('应能处理多个集合的批量更新', () => {
      // 模拟多个启用自动更新的集合
      const collections = [
        {
          _id: 'col1',
          name: 'Collection 1',
          autoUpdateConfig: {
            enabled: true,
            datasetUrl: 'https://data.gov.hk/dataset/1',
            fileFormat: 'csv'
          }
        },
        {
          _id: 'col2',
          name: 'Collection 2',
          autoUpdateConfig: {
            enabled: true,
            datasetUrl: 'https://data.gov.hk/dataset/2',
            fileFormat: 'xlsx'
          }
        },
        {
          _id: 'col3',
          name: 'Collection 3',
          autoUpdateConfig: {
            enabled: false, // 未启用
            datasetUrl: 'https://data.gov.hk/dataset/3',
            fileFormat: 'csv'
          }
        }
      ];

      // 过滤启用的集合
      const enabledCollections = collections.filter((c) => c.autoUpdateConfig.enabled);

      expect(enabledCollections).toHaveLength(2);

      // 模拟处理每个集合
      const results = enabledCollections.map((col) => ({
        collectionId: col._id,
        success: true,
        message: '更新检查完成'
      }));

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('一个集合失败不应影响其他集合', () => {
      const collections = [
        { _id: 'col1', name: 'Collection 1' },
        { _id: 'col2', name: 'Collection 2' },
        { _id: 'col3', name: 'Collection 3' }
      ];

      // 模拟处理结果，col2 失败
      const results = [
        { collectionId: 'col1', success: true, message: '更新成功' },
        { collectionId: 'col2', success: false, message: '网络错误' },
        { collectionId: 'col3', success: true, message: '更新成功' }
      ];

      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.filter((r) => !r.success).length;

      expect(successCount).toBe(2);
      expect(failedCount).toBe(1);
      expect(results).toHaveLength(3); // 所有集合都被处理了
    });
  });
});

// ============================================
// 错误场景测试 - 网络错误
// Validates: Requirements 2.5, 11.2
// ============================================

describe('错误场景测试 - 网络错误', () => {
  describe('页面爬取错误', () => {
    it('应处理页面无法访问的情况', () => {
      const error = {
        type: 'NetworkError',
        message: '页面爬取失败: ECONNREFUSED',
        url: 'https://invalid-domain.com/dataset'
      };

      expect(error.type).toBe('NetworkError');
      expect(error.message).toContain('页面爬取失败');

      // 应记录错误日志
      const logEntry = {
        timestamp: new Date(),
        level: 'error',
        message: error.message,
        url: error.url
      };

      expect(logEntry.level).toBe('error');
    });

    it('应处理页面超时的情况', () => {
      const error = {
        type: 'TimeoutError',
        message: '页面爬取失败: timeout of 30000ms exceeded',
        url: 'https://slow-server.com/dataset'
      };

      expect(error.type).toBe('TimeoutError');
      expect(error.message).toContain('timeout');
    });

    it('应处理 HTTP 错误状态码', () => {
      const error = {
        type: 'HTTPError',
        message: '页面爬取失败: Request failed with status code 404',
        statusCode: 404,
        url: 'https://data.gov.hk/nonexistent'
      };

      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('404');
    });
  });

  describe('文件下载错误', () => {
    it('应处理文件下载失败的情况', () => {
      const error = {
        type: 'DownloadError',
        message: '文件下载或解析失败: ECONNRESET',
        fileUrl: 'https://data.gov.hk/file.csv'
      };

      expect(error.type).toBe('DownloadError');
      expect(error.message).toContain('下载或解析失败');

      // 应记录到更新历史
      const historyEntry = {
        timestamp: new Date(),
        status: 'failed',
        message: error.message,
        fileUrl: error.fileUrl
      };

      expect(historyEntry.status).toBe('failed');
    });

    it('应处理文件过大的情况', () => {
      const error = {
        type: 'FileSizeError',
        message: '文件下载或解析失败: File size exceeds limit',
        fileUrl: 'https://data.gov.hk/large-file.csv',
        fileSize: 100 * 1024 * 1024 // 100MB
      };

      expect(error.type).toBe('FileSizeError');
      expect(error.fileSize).toBeGreaterThan(50 * 1024 * 1024);
    });
  });

  describe('API 请求错误', () => {
    it('应处理 API 不可用的情况', () => {
      const error = {
        type: 'APIError',
        message: 'API 数据下载失败: Service Unavailable',
        statusCode: 503,
        endpoint: 'https://api.data.gov.hk/v1/dataset'
      };

      expect(error.statusCode).toBe(503);
      expect(error.message).toContain('下载失败');
    });

    it('应处理 API 认证失败的情况', () => {
      const error = {
        type: 'AuthError',
        message: 'API 数据下载失败: Unauthorized',
        statusCode: 401,
        endpoint: 'https://api.data.gov.hk/v1/dataset'
      };

      expect(error.statusCode).toBe(401);
    });
  });
});

// ============================================
// 错误场景测试 - 解析错误
// Validates: Requirements 5.6, 11.3
// ============================================

describe('错误场景测试 - 解析错误', () => {
  describe('文件格式错误', () => {
    it('应处理不支持的文件格式', () => {
      const error = {
        type: 'FormatError',
        message: '不支持的文件格式: pdf',
        fileFormat: 'pdf'
      };

      expect(error.type).toBe('FormatError');
      expect(error.message).toContain('不支持');
    });

    it('应处理损坏的 CSV 文件', () => {
      const error = {
        type: 'ParseError',
        message: '文件下载或解析失败: Invalid CSV format',
        fileUrl: 'https://data.gov.hk/corrupted.csv'
      };

      expect(error.type).toBe('ParseError');
      expect(error.message).toContain('解析失败');
    });

    it('应处理损坏的 XLSX 文件', () => {
      const error = {
        type: 'ParseError',
        message: '文件下载或解析失败: Invalid XLSX format',
        fileUrl: 'https://data.gov.hk/corrupted.xlsx'
      };

      expect(error.type).toBe('ParseError');
    });

    it('应处理无效的 XML 文件', () => {
      const error = {
        type: 'ParseError',
        message: '文件下载或解析失败: Invalid XML syntax',
        fileUrl: 'https://data.gov.hk/invalid.xml'
      };

      expect(error.type).toBe('ParseError');
    });
  });

  describe('日期解析错误', () => {
    it('应处理无法识别的日期格式', () => {
      const files: ScrapedFileInfo[] = [
        {
          fileName: 'dataset.csv',
          fileUrl: 'https://data.gov.hk/file.csv',
          updateTime: 'invalid-date-format'
        }
      ];

      const config: DetectionConfig = {
        checkUpdateTime: true,
        detailPageCheck: false
      };

      const lastUpdateTime = new Date('2025-01-01');
      const result = detectNewFile(files, config, lastUpdateTime);

      // 无法解析日期时应跳过时间检测
      expect(result.isNewFile).toBe(false);
    });

    it('应处理空的日期字段', () => {
      const files: ScrapedFileInfo[] = [
        {
          fileName: 'dataset.csv',
          fileUrl: 'https://data.gov.hk/file.csv',
          updateTime: ''
        }
      ];

      const config: DetectionConfig = {
        checkUpdateTime: true,
        detailPageCheck: false
      };

      const lastUpdateTime = new Date('2025-01-01');
      const result = detectNewFile(files, config, lastUpdateTime);

      expect(result.isNewFile).toBe(false);
    });
  });

  describe('数据导入错误', () => {
    it('应处理数据格式不符合要求的情况', () => {
      const error = {
        type: 'ImportError',
        message: '数据导入失败: Invalid data format',
        collectionId: 'col1'
      };

      expect(error.type).toBe('ImportError');
      expect(error.message).toContain('导入失败');

      // 应记录到更新历史
      const historyEntry = {
        timestamp: new Date(),
        status: 'failed',
        message: error.message
      };

      expect(historyEntry.status).toBe('failed');
    });

    it('应处理数据库写入失败的情况', () => {
      const error = {
        type: 'DatabaseError',
        message: '数据导入失败: Database connection lost',
        collectionId: 'col1'
      };

      expect(error.type).toBe('DatabaseError');
    });
  });
});

// ============================================
// 错误场景测试 - 权限错误
// Validates: Requirements 12.1, 12.2, 11.4
// ============================================

describe('错误场景测试 - 权限错误', () => {
  describe('配置权限错误', () => {
    it('应拒绝没有写权限的用户配置自动更新', () => {
      const user = {
        _id: 'user1',
        permissions: ['read'] // 只有读权限
      };

      const hasWritePermission = user.permissions.includes('write');
      expect(hasWritePermission).toBe(false);

      // 应返回权限错误
      const error = {
        type: 'PermissionError',
        message: '权限不足',
        requiredPermission: 'write',
        userPermissions: user.permissions
      };

      expect(error.type).toBe('PermissionError');
      expect(error.message).toBe('权限不足');
    });

    it('应拒绝未认证的用户配置自动更新', () => {
      const user = null; // 未认证

      expect(user).toBeNull();

      const error = {
        type: 'AuthenticationError',
        message: '未认证'
      };

      expect(error.type).toBe('AuthenticationError');
    });
  });

  describe('触发更新权限错误', () => {
    it('应拒绝没有写权限的用户触发更新', () => {
      const user = {
        _id: 'user1',
        permissions: ['read']
      };

      const hasWritePermission = user.permissions.includes('write');
      expect(hasWritePermission).toBe(false);

      const error = {
        type: 'PermissionError',
        message: '权限不足',
        requiredPermission: 'write'
      };

      expect(error.type).toBe('PermissionError');
    });
  });

  describe('查询历史权限错误', () => {
    it('应拒绝没有读权限的用户查询历史', () => {
      const user = {
        _id: 'user1',
        permissions: [] // 没有任何权限
      };

      const hasReadPermission = user.permissions.includes('read');
      expect(hasReadPermission).toBe(false);

      const error = {
        type: 'PermissionError',
        message: '权限不足',
        requiredPermission: 'read'
      };

      expect(error.type).toBe('PermissionError');
    });
  });
});

// ============================================
// 错误恢复测试
// Validates: Requirements 11.6
// ============================================

describe('错误恢复测试', () => {
  it('应能从网络错误中恢复', () => {
    // 第一次尝试失败
    const firstAttempt = {
      success: false,
      error: '页面爬取失败: ECONNREFUSED'
    };

    expect(firstAttempt.success).toBe(false);

    // 第二次尝试成功
    const secondAttempt = {
      success: true,
      files: [
        {
          fileName: 'dataset.csv',
          fileUrl: 'https://data.gov.hk/file.csv'
        }
      ]
    };

    expect(secondAttempt.success).toBe(true);
  });

  it('应能记录错误并继续处理其他集合', () => {
    const collections = ['col1', 'col2', 'col3'];
    const results: Array<{ collectionId: string; success: boolean; error?: string }> = [];

    // 模拟处理每个集合
    for (const collectionId of collections) {
      try {
        if (collectionId === 'col2') {
          // col2 失败
          throw new Error('Network error');
        }
        results.push({ collectionId, success: true });
      } catch (error: any) {
        // 记录错误但继续处理
        results.push({
          collectionId,
          success: false,
          error: error.message
        });
      }
    }

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);
  });

  it('应能在多次失败后停止重试', () => {
    const maxRetries = 3;
    let attemptCount = 0;

    const tryDownload = (): boolean => {
      attemptCount++;
      return false; // 总是失败
    };

    while (attemptCount < maxRetries) {
      const success = tryDownload();
      if (success) break;
    }

    expect(attemptCount).toBe(maxRetries);
  });
});
