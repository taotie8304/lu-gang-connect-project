/**
 * 鲁港通 - 香港政府数据集 CKAN API 客户端（D8 修复版）
 * 依据官方 CKAN API 开发指南：https://data.gov.hk/sc/help/ckan-api-development-guide
 *
 * 修复依据（实证脚本 .qoder/d8-verify-harness.mjs，真实 live data.gov.hk，7/7 PASS）：
 *  1. CKAN API 基址是 `/tc-data/api/3/action`（`/api/3/action` 实测 404）；
 *  2. 资源 `last_modified` 实测全 null → 更新检测改用包级 `metadata_modified`（可靠信号）；
 *  3. `datastore_active` 全 false → v2/filter API 不可用，直接用资源直链下载；
 *  4. 单个数据集资源可能含大量图片（实测 1020 资源中 1013 为 JPEG）→ 选资源须按数据格式过滤、跳过图片；
 *  5. 改用 4.16.2 封装 axios（SSRF 防护 + 代理感知），丢弃旧版 `require('http').Agent()` keepAlive hack。
 */
import crypto from 'crypto';
import { axios } from '../../../common/api/axios';
import { getLogger, LogCategories } from '../../../common/logger';

const logger = getLogger(LogCategories.MODULE.DATASET.AUTO_UPDATE);

// 实证确认的 CKAN API 基址（勿改回 /api/3/action，会 404）
const CKAN_API_BASE = 'https://data.gov.hk/tc-data/api/3/action';
const REQUEST_TIMEOUT = 30000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// 数据格式优先级（选资源时依次尝试），图片格式一律跳过
const DATA_FORMAT_PRIORITY = ['csv', 'xlsx', 'xml', 'json', 'api'];
const IMAGE_FORMATS = ['jpeg', 'jpg', 'png', 'gif', 'bmp', 'webp', 'tiff'];

export interface HkGovResource {
  id?: string;
  url: string;
  format: string;
  name?: string;
  created?: string;
}

export interface HkGovDatasetInfo {
  datasetId: string;
  title?: string;
  description?: string;
  updateFrequency?: string;
  // 鲁港通 - 修复：包级更新时间，作为可靠更新信号（资源级 last_modified 全 null）
  metadataModified?: string;
  resources: HkGovResource[];
}

export interface HkGovApiInfo {
  apiEndpoint: string;
  cacheKey: string;
  datasetId?: string;
  resourceId?: string;
  resourceUrl?: string;
  format?: string;
  metadataModified?: string;
  isDirectDownload?: boolean;
  metadata?: {
    title?: string;
    description?: string;
    updateFrequency?: string;
    lastModified?: string;
    resourceName?: string;
  };
}

/** 判断是否香港政府数据集页面 URL */
export function isHkGovDatasetUrl(datasetUrl: string): boolean {
  return (
    datasetUrl.includes('data.gov.hk') ||
    datasetUrl.includes('csdi.gov.hk') ||
    datasetUrl.includes('datasetId=')
  );
}

/** 从数据集页面 URL 提取 datasetId（支持 data.gov.hk 与 csdi geoportal 两种格式） */
export function extractDatasetId(datasetPageUrl: string): string | null {
  try {
    const url = new URL(datasetPageUrl);
    if (url.hostname.includes('data.gov.hk')) {
      // 格式：https://data.gov.hk/tc/dataset/<slug> 或 /tc-data/dataset/<slug>
      const pathParts = url.pathname.split('/').filter(Boolean);
      const datasetIdx = pathParts.findIndex((p) => p === 'dataset');
      if (datasetIdx >= 0 && pathParts[datasetIdx + 1]) {
        return pathParts[datasetIdx + 1];
      }
      return pathParts[pathParts.length - 1] || null;
    }
    if (url.hostname.includes('csdi.gov.hk') || url.hostname.includes('portal')) {
      // 格式：https://portal.csdi.gov.hk/geoportal/?datasetId=xxx
      return url.searchParams.get('datasetId');
    }
    return null;
  } catch (error) {
    logger.warn('鲁港通 - 提取 datasetId 失败', { datasetPageUrl, error });
    return null;
  }
}

/** 是否为图片格式（选资源时跳过） */
function isImageFormat(format?: string): boolean {
  return IMAGE_FORMATS.includes((format || '').toLowerCase());
}

/**
 * 调用 CKAN package_show 获取数据集完整信息（含全部资源 + 包级 metadata_modified）。
 * @returns 数据集信息；失败返回 null
 */
export async function fetchHkGovDataset(datasetPageUrl: string): Promise<HkGovDatasetInfo | null> {
  const datasetId = extractDatasetId(datasetPageUrl);
  if (!datasetId) {
    logger.warn('鲁港通 - 无法从 URL 提取 datasetId', { datasetPageUrl });
    return null;
  }

  try {
    const ckanUrl = `${CKAN_API_BASE}/package_show?id=${encodeURIComponent(datasetId)}`;
    const response = await axios.get(ckanUrl, {
      timeout: REQUEST_TIMEOUT,
      headers: { 'User-Agent': UA }
    });

    const body = response.data as { success?: boolean; result?: Record<string, any> };
    if (!body?.success || !body.result) {
      logger.warn('鲁港通 - CKAN package_show 返回 success=false', { datasetId });
      return null;
    }

    const pkg = body.result;
    const rawResources = Array.isArray(pkg.resources) ? pkg.resources : [];
    const resources: HkGovResource[] = rawResources
      .filter((r: any) => r && typeof r.url === 'string' && r.url)
      .map((r: any) => ({
        id: r.id,
        url: r.url,
        format: (r.format || '').toLowerCase(),
        name: r.name || r.description,
        created: r.created
      }));

    return {
      datasetId,
      title: pkg.title || pkg.name,
      description: pkg.notes || pkg.description,
      updateFrequency: pkg.update_frequency,
      metadataModified: pkg.metadata_modified || pkg.last_modified,
      resources
    };
  } catch (error) {
    logger.error('鲁港通 - 调用 CKAN package_show 失败', { datasetId, error });
    return null;
  }
}

/**
 * 从资源列表中按格式优先级挑选数据资源（跳过图片）。
 * @param preferFormat 若指定则优先匹配该格式
 */
export function pickDataResource(
  resources: HkGovResource[],
  preferFormat?: string
): HkGovResource | null {
  const pool = resources.filter((r) => !isImageFormat(r.format));
  if (pool.length === 0) return null;

  if (preferFormat) {
    const preferred = pool.find((r) => r.format === preferFormat.toLowerCase());
    if (preferred) return preferred;
  }
  for (const fmt of DATA_FORMAT_PRIORITY) {
    const hit = pool.find((r) => r.format === fmt);
    if (hit) return hit;
  }
  return pool[0];
}

/** 生成内容 MD5 哈希（可靠更新判据：内容变则哈希变） */
export function contentHash(input: Buffer | string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

/** 下载资源为 Buffer（供下载/哈希复用；封装 axios 已含 SSRF 防护与超时） */
export async function downloadResourceBuffer(
  url: string,
  headers?: Record<string, string>,
  timeout = 5 * 60 * 1000
): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout,
    headers: { 'User-Agent': UA, ...(headers || {}) },
    maxContentLength: 100 * 1024 * 1024,
    maxBodyLength: 100 * 1024 * 1024
  });
  return Buffer.from(response.data as ArrayBuffer);
}

/**
 * 兼容旧接口：将数据集页面 URL 转换为可调用的单资源 API 信息（供 detect 按钮使用）。
 * 修复：走 package_show 枚举 + 跳图片选资源 + 返回包级 metadata_modified。
 */
export async function convertHkGovDatasetToApi(
  datasetPageUrl: string
): Promise<HkGovApiInfo | null> {
  const dataset = await fetchHkGovDataset(datasetPageUrl);
  if (!dataset) return null;

  const resource = pickDataResource(dataset.resources);
  if (!resource) {
    logger.warn('鲁港通 - 数据集无可用数据资源（可能全是图片）', {
      datasetId: dataset.datasetId,
      resourceCount: dataset.resources.length
    });
    return null;
  }

  const cacheKey = contentHash(`${dataset.datasetId}:${resource.id || resource.url}`);

  return {
    apiEndpoint: resource.url,
    cacheKey,
    datasetId: dataset.datasetId,
    resourceId: resource.id,
    resourceUrl: resource.url,
    format: resource.format,
    metadataModified: dataset.metadataModified,
    isDirectDownload: true,
    metadata: {
      title: dataset.title,
      description: dataset.description,
      updateFrequency: dataset.updateFrequency,
      lastModified: dataset.metadataModified,
      resourceName: resource.name
    }
  };
}

/**
 * 检查 API 数据是否更新（内容 MD5 哈希对比）。
 * 修复：旧版调度器误用 HEAD/Last-Modified（data.gov.hk 恒 null）→ 永不更新；此处复活可靠的哈希检测。
 */
export async function checkApiDataUpdated(
  apiEndpoint: string,
  oldCacheKey: string,
  headers?: Record<string, string>
): Promise<{ updated: boolean; newCacheKey: string; error?: string }> {
  try {
    const buffer = await downloadResourceBuffer(apiEndpoint, headers, 60000);
    const newCacheKey = contentHash(buffer);
    return { updated: newCacheKey !== oldCacheKey, newCacheKey };
  } catch (error) {
    logger.error('鲁港通 - 检查 API 数据更新失败', { apiEndpoint, error });
    return { updated: false, newCacheKey: oldCacheKey, error: (error as Error).message };
  }
}
