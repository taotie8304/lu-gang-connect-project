// 鲁港通 - 文件更新检测模块
import { ScrapedFileInfo } from './scraper';

export interface DetectionConfig {
  yearPattern?: string[]; // 年份匹配模式
  checkUpdateTime: boolean; // 是否检查更新时间
  detailPageCheck: boolean; // 是否需要详情页检查
}

export interface DetectionResult {
  isNewFile: boolean;
  reason: string;
  matchedFile?: ScrapedFileInfo;
}

/**
 * 检测是否有新文件需要更新
 * @param files 爬取到的文件列表
 * @param config 检测配置
 * @param lastUpdateTime 上次更新时间
 * @returns 检测结果
 */
export function detectNewFile(
  files: ScrapedFileInfo[],
  config: DetectionConfig,
  lastUpdateTime?: Date
): DetectionResult {
  if (files.length === 0) {
    return {
      isNewFile: false,
      reason: '未找到任何文件'
    };
  }

  // 一级检测：文件名年份匹配
  if (config.yearPattern && config.yearPattern.length > 0) {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    // 生成当前年份的所有可能模式
    const currentYearPatterns = [
      `${currentYear}/${String(nextYear).slice(-2)}`, // 2025/26
      `${currentYear}-${nextYear}`, // 2025-2026
      `${currentYear}至${nextYear}`, // 2025至2026
      `${currentYear}`, // 2025
      String(currentYear) // 2025
    ];

    for (const file of files) {
      const fileName = file.fileName.toLowerCase();

      // 检查文件名是否包含当前年份模式
      const hasCurrentYear = currentYearPatterns.some((pattern) =>
        fileName.includes(pattern.toLowerCase())
      );

      if (hasCurrentYear) {
        return {
          isNewFile: true,
          reason: `文件名包含当前年份 (${currentYear})`,
          matchedFile: file
        };
      }
    }
  }

  // 二级检测：更新时间对比
  if (config.checkUpdateTime && lastUpdateTime) {
    for (const file of files) {
      if (file.updateTime) {
        const fileUpdateTime = parseDate(file.updateTime);
        if (fileUpdateTime && fileUpdateTime > lastUpdateTime) {
          return {
            isNewFile: true,
            reason: `文件更新时间 (${file.updateTime}) 晚于上次更新时间`,
            matchedFile: file
          };
        }
      }
    }
  }

  // 如果没有检测到新文件，返回第一个文件作为候选
  return {
    isNewFile: false,
    reason: '未检测到新文件，但可以通过详情页进一步检查',
    matchedFile: files[0]
  };
}

/**
 * 通过详情页更新时间进行最终检测
 * @param detailPageUpdateTime 详情页的更新时间
 * @param lastUpdateTime 上次更新时间
 * @returns 是否是新文件
 */
export function detectByDetailPage(
  detailPageUpdateTime: string,
  lastUpdateTime?: Date
): DetectionResult {
  if (!lastUpdateTime) {
    return {
      isNewFile: true,
      reason: '首次导入，无历史记录'
    };
  }

  const detailTime = parseDate(detailPageUpdateTime);
  if (!detailTime) {
    return {
      isNewFile: false,
      reason: '无法解析详情页更新时间'
    };
  }

  if (detailTime > lastUpdateTime) {
    return {
      isNewFile: true,
      reason: `详情页更新时间 (${detailPageUpdateTime}) 晚于上次更新时间`
    };
  }

  return {
    isNewFile: false,
    reason: '详情页更新时间未变化，无需更新'
  };
}

/**
 * 解析日期字符串
 * 支持多种格式：YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY 等
 */
function parseDate(dateStr: string): Date | null {
  try {
    // 尝试直接解析
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // 尝试解析 DD/MM/YYYY 格式
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      // 判断是哪种格式
      const num1 = parseInt(parts[0]);
      const num2 = parseInt(parts[1]);
      const num3 = parseInt(parts[2]);

      // 如果第一个数字 > 31，则是 YYYY-MM-DD
      if (num1 > 31) {
        date = new Date(num1, num2 - 1, num3);
      }
      // 如果第三个数字 > 31，则是 DD-MM-YYYY
      else if (num3 > 31) {
        date = new Date(num3, num2 - 1, num1);
      }
      // 否则尝试 MM-DD-YYYY
      else {
        date = new Date(num3, num1 - 1, num2);
      }

      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 检查 API 是否需要更新缓存
 * @param apiEndpoint API 端点
 * @param lastUpdateTime 上次更新时间
 * @returns 是否需要更新
 */
export async function checkApiUpdate(
  apiEndpoint: string,
  lastUpdateTime?: Date
): Promise<DetectionResult> {
  try {
    // 发送 HEAD 请求检查 Last-Modified 头
    const response = await fetch(apiEndpoint, {
      method: 'HEAD'
    });

    const lastModified = response.headers.get('last-modified');
    if (!lastModified) {
      return {
        isNewFile: false,
        reason: 'API 未提供 Last-Modified 头，无法判断'
      };
    }

    const apiUpdateTime = new Date(lastModified);
    if (!lastUpdateTime || apiUpdateTime > lastUpdateTime) {
      return {
        isNewFile: true,
        reason: `API 更新时间 (${lastModified}) 晚于上次更新时间`
      };
    }

    return {
      isNewFile: false,
      reason: 'API 未更新，无需刷新缓存'
    };
  } catch (error: any) {
    return {
      isNewFile: false,
      reason: `API 检查失败: ${error.message}`
    };
  }
}
