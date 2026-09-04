/**
 * 鲁港通 - 更新检测模块（D8 修复版）
 *
 * 修复依据（实证 .qoder/d8-verify-harness.mjs）：
 *   data.gov.hk 资源级 `last_modified` 实测全 null → 依赖资源时间戳的检测恒判「无法判断」，永不更新；
 *   可靠的更新信号是 CKAN 包级 `metadata_modified`。
 *   故新增 `detectByMetadataModified` 作为 CKAN 源的一级判据；
 *   `detectNewFile` / `detectByDetailPage` / `checkApiUpdate` 保留给 custom 源与静态页兜底。
 */
import { type ScrapedFileInfo } from './scraper';

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
 * 鲁港通 - 修复：CKAN 包级 metadata_modified 检测（主判据）。
 * 资源级 last_modified 恒 null，唯有包级 metadata_modified 是可靠更新信号。
 * @param newModified 本次拉取到的包级 metadata_modified
 * @param oldModified 上次记录（autoUpdateConfig.lastMetadataModified）
 */
export function detectByMetadataModified(
  newModified?: string,
  oldModified?: string
): DetectionResult {
  if (!newModified) {
    return { isNewFile: false, reason: 'CKAN 未返回 metadata_modified，无法判断' };
  }
  // 首次导入：无历史记录，视为需更新
  if (!oldModified) {
    return { isNewFile: true, reason: `首次导入（metadata_modified=${newModified}）` };
  }

  const newTime = parseDate(newModified);
  const oldTime = parseDate(oldModified);
  if (newTime && oldTime) {
    if (newTime > oldTime) {
      return { isNewFile: true, reason: `包级 metadata_modified 更新（${oldModified} → ${newModified}）` };
    }
    return { isNewFile: false, reason: '包级 metadata_modified 未变化，无需更新' };
  }

  // 日期解析失败时退化为字符串对比（CKAN 返回 ISO8601，字典序即时间序）
  if (newModified !== oldModified) {
    return { isNewFile: true, reason: `包级 metadata_modified 变化（${oldModified} → ${newModified}）` };
  }
  return { isNewFile: false, reason: '包级 metadata_modified 未变化，无需更新' };
}

/**
 * 检测是否有新文件需要更新（custom 源 / 静态页兜底）。
 * @param files 爬取到的文件列表
 * @param config 检测配置
 * @param lastUpdateTime 上次更新时间
 */
export function detectNewFile(
  files: ScrapedFileInfo[],
  config: DetectionConfig,
  lastUpdateTime?: Date
): DetectionResult {
  if (files.length === 0) {
    return { isNewFile: false, reason: '未找到任何文件' };
  }

  // 一级检测：文件名年份匹配
  if (config.yearPattern && config.yearPattern.length > 0) {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const currentYearPatterns = [
      `${currentYear}/${String(nextYear).slice(-2)}`, // 2025/26
      `${currentYear}-${nextYear}`, // 2025-2026
      `${currentYear}至${nextYear}`, // 2025至2026
      `${currentYear}` // 2025
    ];

    for (const file of files) {
      const fileName = file.fileName.toLowerCase();
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

  // 未检测到新文件，返回第一个文件作为候选（供详情页二级检测）
  return {
    isNewFile: false,
    reason: '未检测到新文件，但可以通过详情页进一步检查',
    matchedFile: files[0]
  };
}

/**
 * 通过详情页更新时间进行最终检测。
 * @param detailPageUpdateTime 详情页的更新时间
 * @param lastUpdateTime 上次更新时间
 */
export function detectByDetailPage(
  detailPageUpdateTime: string,
  lastUpdateTime?: Date
): DetectionResult {
  if (!lastUpdateTime) {
    return { isNewFile: true, reason: '首次导入，无历史记录' };
  }

  const detailTime = parseDate(detailPageUpdateTime);
  if (!detailTime) {
    return { isNewFile: false, reason: '无法解析详情页更新时间' };
  }

  if (detailTime > lastUpdateTime) {
    return { isNewFile: true, reason: `详情页更新时间 (${detailPageUpdateTime}) 晚于上次更新时间` };
  }

  return { isNewFile: false, reason: '详情页更新时间未变化，无需更新' };
}

/**
 * 解析日期字符串，支持 YYYY-MM-DD / DD/MM/YYYY / DD-MM-YYYY / ISO8601 等。
 * @returns 解析成功返回 Date，失败返回 null
 */
export function parseDate(dateStr: string): Date | null {
  try {
    // 直接解析（ISO8601 与多数格式）
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;

    // 兜底解析 DD/MM/YYYY、YYYY-MM-DD、DD-MM-YYYY
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      const num1 = parseInt(parts[0]);
      const num2 = parseInt(parts[1]);
      const num3 = parseInt(parts[2]);

      let parsed: Date;
      if (num1 > 31) {
        parsed = new Date(num1, num2 - 1, num3); // YYYY-MM-DD
      } else if (num3 > 31) {
        parsed = new Date(num3, num2 - 1, num1); // DD-MM-YYYY
      } else {
        parsed = new Date(num3, num1 - 1, num2); // MM-DD-YYYY
      }
      if (!isNaN(parsed.getTime())) return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 检查 API 是否需要更新（HEAD / Last-Modified）。
 * 鲁港通 - 注意：data.gov.hk 资源实测 last_modified 全 null，此法对 CKAN 源无效；
 *   CKAN/API 源请改用 ./hkGovApiConverter.ts 的 `checkApiDataUpdated`（内容 MD5 哈希，可靠）。
 *   本函数仅保留给确会返回 Last-Modified 头的第三方 custom API。
 */
export async function checkApiUpdate(
  apiEndpoint: string,
  lastUpdateTime?: Date
): Promise<DetectionResult> {
  try {
    const response = await fetch(apiEndpoint, { method: 'HEAD' });
    const lastModified = response.headers.get('last-modified');
    if (!lastModified) {
      return { isNewFile: false, reason: 'API 未提供 Last-Modified 头，无法判断' };
    }

    const apiUpdateTime = new Date(lastModified);
    if (!lastUpdateTime || apiUpdateTime > lastUpdateTime) {
      return { isNewFile: true, reason: `API 更新时间 (${lastModified}) 晚于上次更新时间` };
    }
    return { isNewFile: false, reason: 'API 未更新，无需刷新缓存' };
  } catch (error) {
    return { isNewFile: false, reason: `API 检查失败: ${(error as Error).message}` };
  }
}
