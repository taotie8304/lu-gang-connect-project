/**
 * 鲁港通 - 知识库自动更新功能单元测试
 * 
 * 测试内容：
 * - 年份检测逻辑测试
 * - 日期解析功能测试
 * - 检测策略组合测试
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect } from 'vitest';
import { detectNewFile, detectByDetailPage, DetectionConfig } from './detector';
import type { ScrapedFileInfo } from './scraper';

// ============================================
// 年份检测逻辑测试
// Validates: Requirements 3.1, 3.2
// ============================================

describe('年份检测逻辑测试', () => {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  describe('文件名年份匹配', () => {
    it('应识别包含当前年份的文件名 (YYYY格式)', () => {
      const files: ScrapedFileInfo[] = [
        {
          fileName: `dataset_${currentYear}.csv`,
          fileUrl: 'https://example.com/file.csv'
        }
      ];

      const config: DetectionConfig = {
        yearPattern: ['YYYY'],
        checkUpdateTime: false,
        detailPageCheck: false
      };

      const result = detectNewFile(files, config);
      expect(result.isNewFile).toBe(true);
      expect(result.reason).toContain('当前年份');
    });

    it('应识别包含年份范围的文件名 (YYYY-YYYY格式)', () => {
      const files: ScrapedFileInfo[] = [
        {
          fileName: `dataset_${currentYear}-${nextYear}.csv`,
          fileUrl: 'https://example.com/file.csv'
        }
      ];

      const config: DetectionConfig = {
        yearPattern: ['YYYY-YYYY'],
        checkUpdateTime: false,
        detailPageCheck: false
      };

      const result = detectNewFile(files, config);
      expect(result.isNewFile).toBe(true);
      expect(result.reason).toContain('当前年份');
    });

    it('应识别包含年份范围的文件名 (YYYY/YY格式)', () => {
      const files: ScrapedFileInfo[] = [
        {
          fileName: `dataset_${currentYear}/${String(nextYear).slice(-2)}.csv`,
          fileUrl: 'https://example.com/file.csv'
        }
      ];

      const config: DetectionConfig = {
        yearPattern: ['YYYY/YY'],
        checkUpdateTime: false,
        detailPageCheck: false
      };

      const result = detectNewFile(files, config);
      expect(result.isNewFile).toBe(true);
      expect(result.reason).toContain('当前年份');
    });

    it('应识别包含中文年份范围的文件名 (YYYY至YYYY格式)', () => {
      const files: ScrapedFileInfo[] = [
        {
          fileName: `dataset_${currentYear}至${nextYear}.csv`,
          fileUrl: 'https://example.com/file.csv'
        }
      ];

      const config: DetectionConfig = {
        yearPattern: ['YYYY至YYYY'],
        checkUpdateTime: false,
        detailPageCheck: false
      };

      const result = detectNewFile(files, config);
      expect(result.isNewFile).toBe(true);
      expect(result.reason).toContain('当前年份');
    });

    it('不应识别包含旧年份的文件名', () => {
      const oldYear = currentYear - 2;
      const files: ScrapedFileInfo[] = [
        {
          fileName: `dataset_${oldYear}.csv`,
          fileUrl: 'https://example.com/file.csv'
        }
      ];

      const config: DetectionConfig = {
        yearPattern: ['YYYY'],
        checkUpdateTime: false,
        detailPageCheck: false
      };

      const result = detectNewFile(files, config);
      expect(result.isNewFile).toBe(false);
    });

    it('应处理大小写不敏感的文件名', () => {
      const files: ScrapedFileInfo[] = [
        {
          fileName: `DATASET_${currentYear}.CSV`,
          fileUrl: 'https://example.com/file.csv'
        }
      ];

      const config: DetectionConfig = {
        yearPattern: ['YYYY'],
        checkUpdateTime: false,
        detailPageCheck: false
      };

      const result = detectNewFile(files, config);
      expect(result.isNewFile).toBe(true);
    });
  });

  describe('空文件列表处理', () => {
    it('空文件列表应返回未找到文件', () => {
      const files: ScrapedFileInfo[] = [];
      const config: DetectionConfig = {
        yearPattern: ['YYYY'],
        checkUpdateTime: false,
        detailPageCheck: false
      };

      const result = detectNewFile(files, config);
      expect(result.isNewFile).toBe(false);
      expect(result.reason).toBe('未找到任何文件');
    });
  });
});

// ============================================
// 日期解析功能测试
// Validates: Requirements 3.4
// ============================================

describe('日期解析功能测试', () => {
  describe('更新时间比较', () => {
    it('应正确比较 YYYY-MM-DD 格式的日期', () => {
      const files: ScrapedFileInfo[] = [
        {
          fileName: 'dataset.csv',
          fileUrl: 'https://example.com/file.csv',
          updateTime: '2025-01-15'
        }
      ];

      const config: DetectionConfig = {
        checkUpdateTime: true,
        detailPageCheck: false
      };

      const lastUpdateTime = new Date('2025-01-01');
      const result = detectNewFile(files, config, lastUpdateTime);
      
      expect(result.isNewFile).toBe(true);
      expect(result.reason).toContain('更新时间');
    });

    it('应正确比较 DD/MM/YYYY 格式的日期', () => {
      const files: ScrapedFileInfo[] = [
        {
          fileName: 'dataset.csv',
          fileUrl: 'https://example.com/file.csv',
          updateTime: '15/01/2025'
        }
      ];

      const config: DetectionConfig = {
        checkUpdateTime: true,
        detailPageCheck: false
      };

      const lastUpdateTime = new Date('2025-01-01');
      const result = detectNewFile(files, config, lastUpdateTime);
      
      expect(result.isNewFile).toBe(true);
      expect(result.reason).toContain('更新时间');
    });

    it('应正确比较 DD-MM-YYYY 格式的日期', () => {
      const files: ScrapedFileInfo[] = [
        {
          fileName: 'dataset.csv',
          fileUrl: 'https://example.com/file.csv',
          updateTime: '15-01-2025'
        }
      ];

      const config: DetectionConfig = {
        checkUpdateTime: true,
        detailPageCheck: false
      };

      const lastUpdateTime = new Date('2025-01-01');
      const result = detectNewFile(files, config, lastUpdateTime);
      
      expect(result.isNewFile).toBe(true);
      expect(result.reason).toContain('更新时间');
    });

    it('更新时间早于上次更新时间应返回无需更新', () => {
      const files: ScrapedFileInfo[] = [
        {
          fileName: 'dataset.csv',
          fileUrl: 'https://example.com/file.csv',
          updateTime: '2024-12-01'
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

    it('无更新时间字段应返回候选文件', () => {
      const files: ScrapedFileInfo[] = [
        {
          fileName: 'dataset.csv',
          fileUrl: 'https://example.com/file.csv'
        }
      ];

      const config: DetectionConfig = {
        checkUpdateTime: true,
        detailPageCheck: false
      };

      const lastUpdateTime = new Date('2025-01-01');
      const result = detectNewFile(files, config, lastUpdateTime);
      
      expect(result.isNewFile).toBe(false);
      expect(result.matchedFile).toBeDefined();
    });
  });

  describe('详情页检测', () => {
    it('首次导入应返回需要更新', () => {
      const result = detectByDetailPage('2025-01-15');
      expect(result.isNewFile).toBe(true);
      expect(result.reason).toContain('首次导入');
    });

    it('详情页时间晚于上次更新应返回需要更新', () => {
      const lastUpdateTime = new Date('2025-01-01');
      const result = detectByDetailPage('2025-01-15', lastUpdateTime);
      
      expect(result.isNewFile).toBe(true);
      expect(result.reason).toContain('详情页更新时间');
    });

    it('详情页时间早于上次更新应返回无需更新', () => {
      const lastUpdateTime = new Date('2025-01-15');
      const result = detectByDetailPage('2025-01-01', lastUpdateTime);
      
      expect(result.isNewFile).toBe(false);
      expect(result.reason).toContain('未变化');
    });

    it('无法解析详情页时间应返回无需更新', () => {
      const lastUpdateTime = new Date('2025-01-01');
      const result = detectByDetailPage('invalid-date', lastUpdateTime);
      
      expect(result.isNewFile).toBe(false);
      expect(result.reason).toContain('无法解析');
    });
  });
});

// ============================================
// 检测策略组合测试
// Validates: Requirements 3.1, 3.3, 3.4
// ============================================

describe('检测策略组合测试', () => {
  const currentYear = new Date().getFullYear();

  it('年份检测优先于时间检测', () => {
    const files: ScrapedFileInfo[] = [
      {
        fileName: `dataset_${currentYear}.csv`,
        fileUrl: 'https://example.com/file.csv',
        updateTime: '2024-01-01' // 旧的更新时间
      }
    ];

    const config: DetectionConfig = {
      yearPattern: ['YYYY'],
      checkUpdateTime: true,
      detailPageCheck: false
    };

    const lastUpdateTime = new Date('2025-01-01');
    const result = detectNewFile(files, config, lastUpdateTime);
    
    // 应该通过年份检测，而不是时间检测
    expect(result.isNewFile).toBe(true);
    expect(result.reason).toContain('当前年份');
  });

  it('禁用年份检测时应使用时间检测', () => {
    const files: ScrapedFileInfo[] = [
      {
        fileName: 'dataset.csv',
        fileUrl: 'https://example.com/file.csv',
        updateTime: '2025-01-15'
      }
    ];

    const config: DetectionConfig = {
      checkUpdateTime: true,
      detailPageCheck: false
    };

    const lastUpdateTime = new Date('2025-01-01');
    const result = detectNewFile(files, config, lastUpdateTime);
    
    expect(result.isNewFile).toBe(true);
    expect(result.reason).toContain('更新时间');
  });

  it('所有检测都未通过时应返回候选文件', () => {
    const oldYear = currentYear - 2;
    const files: ScrapedFileInfo[] = [
      {
        fileName: `dataset_${oldYear}.csv`,
        fileUrl: 'https://example.com/file.csv',
        updateTime: '2024-01-01'
      }
    ];

    const config: DetectionConfig = {
      yearPattern: ['YYYY'],
      checkUpdateTime: true,
      detailPageCheck: false
    };

    const lastUpdateTime = new Date('2025-01-01');
    const result = detectNewFile(files, config, lastUpdateTime);
    
    expect(result.isNewFile).toBe(false);
    expect(result.matchedFile).toBeDefined();
    expect(result.reason).toContain('详情页');
  });
});

// ============================================
// 边界情况测试
// ============================================

describe('边界情况测试', () => {
  it('应处理文件名包含多个年份的情况', () => {
    const currentYear = new Date().getFullYear();
    const oldYear = currentYear - 2;
    
    const files: ScrapedFileInfo[] = [
      {
        fileName: `dataset_${oldYear}_to_${currentYear}.csv`,
        fileUrl: 'https://example.com/file.csv'
      }
    ];

    const config: DetectionConfig = {
      yearPattern: ['YYYY'],
      checkUpdateTime: false,
      detailPageCheck: false
    };

    const result = detectNewFile(files, config);
    expect(result.isNewFile).toBe(true);
  });

  it('应处理文件名不包含年份但有更新时间的情况', () => {
    const files: ScrapedFileInfo[] = [
      {
        fileName: 'latest_dataset.csv',
        fileUrl: 'https://example.com/file.csv',
        updateTime: '2025-01-15'
      }
    ];

    const config: DetectionConfig = {
      yearPattern: ['YYYY'],
      checkUpdateTime: true,
      detailPageCheck: false
    };

    const lastUpdateTime = new Date('2025-01-01');
    const result = detectNewFile(files, config, lastUpdateTime);
    
    expect(result.isNewFile).toBe(true);
    expect(result.reason).toContain('更新时间');
  });

  it('应处理多个文件的情况并返回第一个匹配的文件', () => {
    const currentYear = new Date().getFullYear();
    const oldYear = currentYear - 1;
    
    const files: ScrapedFileInfo[] = [
      {
        fileName: `dataset_${oldYear}.csv`,
        fileUrl: 'https://example.com/old.csv'
      },
      {
        fileName: `dataset_${currentYear}.csv`,
        fileUrl: 'https://example.com/new.csv'
      }
    ];

    const config: DetectionConfig = {
      yearPattern: ['YYYY'],
      checkUpdateTime: false,
      detailPageCheck: false
    };

    const result = detectNewFile(files, config);
    expect(result.isNewFile).toBe(true);
    expect(result.matchedFile?.fileName).toContain(String(currentYear));
  });

  it('应处理没有上次更新时间的情况', () => {
    const files: ScrapedFileInfo[] = [
      {
        fileName: 'dataset.csv',
        fileUrl: 'https://example.com/file.csv',
        updateTime: '2025-01-15'
      }
    ];

    const config: DetectionConfig = {
      checkUpdateTime: true,
      detailPageCheck: false
    };

    // 没有传入 lastUpdateTime
    const result = detectNewFile(files, config);
    
    // 没有上次更新时间时，时间检测应该被跳过
    expect(result.isNewFile).toBe(false);
  });
});

// ============================================
// 配置验证测试
// ============================================

describe('配置验证测试', () => {
  it('应处理空的年份模式配置', () => {
    const currentYear = new Date().getFullYear();
    const files: ScrapedFileInfo[] = [
      {
        fileName: `dataset_${currentYear}.csv`,
        fileUrl: 'https://example.com/file.csv'
      }
    ];

    const config: DetectionConfig = {
      yearPattern: [],
      checkUpdateTime: false,
      detailPageCheck: false
    };

    const result = detectNewFile(files, config);
    // 空的年份模式应该跳过年份检测
    expect(result.isNewFile).toBe(false);
  });

  it('应处理未定义的年份模式配置', () => {
    const currentYear = new Date().getFullYear();
    const files: ScrapedFileInfo[] = [
      {
        fileName: `dataset_${currentYear}.csv`,
        fileUrl: 'https://example.com/file.csv'
      }
    ];

    const config: DetectionConfig = {
      checkUpdateTime: false,
      detailPageCheck: false
    };

    const result = detectNewFile(files, config);
    // 未定义的年份模式应该跳过年份检测
    expect(result.isNewFile).toBe(false);
  });

  it('应处理所有检测都禁用的情况', () => {
    const files: ScrapedFileInfo[] = [
      {
        fileName: 'dataset.csv',
        fileUrl: 'https://example.com/file.csv'
      }
    ];

    const config: DetectionConfig = {
      checkUpdateTime: false,
      detailPageCheck: false
    };

    const result = detectNewFile(files, config);
    expect(result.isNewFile).toBe(false);
    expect(result.matchedFile).toBeDefined();
  });
});
