// 鲁港通 - 香港政府数据集 API 地址转换器
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

// 鲁港通 - 性能优化：创建 axios 实例复用连接
const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  },
  httpAgent: require('http').Agent({ keepAlive: true }),
  httpsAgent: require('https').Agent({ keepAlive: true })
});

export interface HkGovApiInfo {
  apiEndpoint: string; // 可调用的 API 地址
  cacheKey: string; // 用于判断数据是否更新的缓存键
  datasetId?: string; // 数据集 ID
  format?: string; // 数据格式 (json, csv, xml)
  metadata?: {
    title?: string;
    description?: string;
    updateFrequency?: string;
    lastModified?: string;
  };
}

/**
 * 将香港政府数据集页面 URL 转换为可调用的 API 地址
 * @param datasetPageUrl 数据集页面 URL (如 https://portal.csdi.gov.hk/geoportal/?datasetId=xxx)
 * @returns API 信息
 */
export async function convertHkGovDatasetToApi(
  datasetPageUrl: string
): Promise<HkGovApiInfo | null> {
  try {
    // 1. 从 URL 中提取 datasetId
    const url = new URL(datasetPageUrl);
    const datasetId = url.searchParams.get('datasetId');

    if (!datasetId) {
      console.error('无法从 URL 中提取 datasetId');
      return null;
    }

    // 2. 爬取页面，查找 API 端点
    const response = await axiosInstance.get(datasetPageUrl);
    const $ = cheerio.load(response.data);

    // 3. 查找 API 链接
    // 香港政府数据集通常提供多种格式的 API
    let apiEndpoint: string | null = null;
    let format = 'json';
    const metadata: HkGovApiInfo['metadata'] = {};

    // 鲁港通 - 查找所有可能的 API 链接
    const possibleApiLinks: string[] = [];

    $('a').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const text = $link.text().trim().toLowerCase();

      if (!href) return;

      // 鲁港通 - 收集所有可能的 API 链接
      if (
        href.includes('api.data.gov.hk') ||
        href.includes('/api/') ||
        href.includes('.json') ||
        href.includes('.csv') ||
        href.includes('.xml') ||
        text.includes('api') ||
        text.includes('json') ||
        text.includes('csv') ||
        text.includes('xml') ||
        text.includes('数据接口') ||
        text.includes('資料介面') ||
        text.includes('download') ||
        text.includes('下载') ||
        text.includes('下載')
      ) {
        possibleApiLinks.push(href);
      }
    });

    // 鲁港通 - 优先选择 JSON API
    for (const link of possibleApiLinks) {
      if (link.includes('.json') || link.includes('format=json') || link.includes('api.data.gov.hk')) {
        apiEndpoint = link;
        format = 'json';
        break;
      }
    }

    // 鲁港通 - 如果没有 JSON，选择 CSV
    if (!apiEndpoint) {
      for (const link of possibleApiLinks) {
        if (link.includes('.csv') || link.includes('format=csv')) {
          apiEndpoint = link;
          format = 'csv';
          break;
        }
      }
    }

    // 鲁港通 - 如果还是没有，选择第一个可能的链接
    if (!apiEndpoint && possibleApiLinks.length > 0) {
      apiEndpoint = possibleApiLinks[0];
      // 根据链接判断格式
      if (apiEndpoint.includes('.json')) format = 'json';
      else if (apiEndpoint.includes('.csv')) format = 'csv';
      else if (apiEndpoint.includes('.xml')) format = 'xml';
    }

    // 4. 如果还是没有找到，返回 null
    if (!apiEndpoint) {
      console.error('鲁港通 - 未能在页面中找到任何 API 或数据链接');
      console.error('鲁港通 - 页面 URL:', datasetPageUrl);
      console.error('鲁港通 - 找到的链接数量:', possibleApiLinks.length);
      return null;
    }

    // 鲁港通 - 确保 API 端点是完整的 URL
    if (!apiEndpoint.startsWith('http')) {
      const baseUrl = new URL(datasetPageUrl);
      apiEndpoint = new URL(apiEndpoint, baseUrl.origin).href;
    }

    console.log('鲁港通 - 找到 API 端点:', apiEndpoint);
    console.log('鲁港通 - 数据格式:', format);

    // 5. 提取元数据
    // 标题
    const title = $('h1').first().text().trim() || $('title').text().trim();
    if (title) metadata.title = title;

    // 描述
    const description =
      $('meta[name="description"]').attr('content') ||
      $('.description').first().text().trim();
    if (description) metadata.description = description;

    // 更新频率
    $('*').each((_, element) => {
      const $el = $(element);
      const text = $el.text().trim();
      if (
        text.includes('更新頻率') ||
        text.includes('更新频率') ||
        text.includes('Update Frequency')
      ) {
        const $next = $el.next();
        const frequency = $next.text().trim();
        if (frequency) metadata.updateFrequency = frequency;
        return false;
      }
    });

    // 最后修改时间
    $('*').each((_, element) => {
      const $el = $(element);
      const text = $el.text().trim();
      if (
        text.includes('最後修改') ||
        text.includes('最后修改') ||
        text.includes('Last Modified')
      ) {
        const $next = $el.next();
        const lastModified = $next.text().trim();
        if (lastModified) metadata.lastModified = lastModified;
        return false;
      }
    });

    // 6. 生成缓存键
    // 缓存键用于判断数据是否更新，基于 API 响应的内容生成
    const cacheKey = await generateCacheKey(apiEndpoint);

    return {
      apiEndpoint,
      cacheKey,
      datasetId,
      format,
      metadata
    };
  } catch (error: any) {
    console.error('转换香港政府数据集 URL 失败:', error.message);
    return null;
  }
}

/**
 * 生成缓存键，用于判断 API 数据是否更新
 * @param apiEndpoint API 端点
 * @returns 缓存键 (MD5 哈希)
 */
async function generateCacheKey(apiEndpoint: string): Promise<string> {
  try {
    // 调用 API 获取数据
    const response = await axiosInstance.get(apiEndpoint, {
      timeout: 10000
    });

    // 将响应数据转换为字符串
    const dataString = JSON.stringify(response.data);

    // 生成 MD5 哈希作为缓存键
    const hash = crypto.createHash('md5').update(dataString).digest('hex');

    return hash;
  } catch (error: any) {
    console.error('生成缓存键失败:', error.message);
    // 如果 API 调用失败，使用时间戳作为缓存键
    return Date.now().toString();
  }
}

/**
 * 检查 API 数据是否更新（通过缓存键对比）
 * @param apiEndpoint API 端点
 * @param oldCacheKey 旧的缓存键
 * @returns 是否有更新
 */
export async function checkApiDataUpdated(
  apiEndpoint: string,
  oldCacheKey: string
): Promise<{ updated: boolean; newCacheKey: string }> {
  try {
    const newCacheKey = await generateCacheKey(apiEndpoint);

    return {
      updated: newCacheKey !== oldCacheKey,
      newCacheKey
    };
  } catch (error: any) {
    console.error('检查 API 数据更新失败:', error.message);
    return {
      updated: false,
      newCacheKey: oldCacheKey
    };
  }
}

/**
 * 下载 API 数据并转换为知识库格式
 * @param apiEndpoint API 端点
 * @param format 数据格式
 * @returns 格式化的文本数据
 */
export async function downloadHkGovApiData(
  apiEndpoint: string,
  format: string = 'json'
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const response = await axiosInstance.get(apiEndpoint);

    let formattedData: string;

    if (format === 'json') {
      // JSON 格式：转换为易读的文本
      const jsonData = response.data;

      if (Array.isArray(jsonData)) {
        // 如果是数组，转换为表格格式
        formattedData = convertJsonArrayToText(jsonData);
      } else {
        // 如果是对象，转换为键值对格式
        formattedData = JSON.stringify(jsonData, null, 2);
      }
    } else {
      // 其他格式直接返回
      formattedData = typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data, null, 2);
    }

    return {
      success: true,
      data: formattedData
    };
  } catch (error: any) {
    return {
      success: false,
      error: `下载 API 数据失败: ${error.message}`
    };
  }
}

/**
 * 将 JSON 数组转换为易读的文本格式
 * @param jsonArray JSON 数组
 * @returns 格式化的文本
 */
function convertJsonArrayToText(jsonArray: any[]): string {
  if (jsonArray.length === 0) {
    return '数据为空';
  }

  // 获取所有字段名
  const fields = Object.keys(jsonArray[0]);

  // 生成表格文本
  let text = '';

  // 表头
  text += fields.join(' | ') + '\n';
  text += fields.map(() => '---').join(' | ') + '\n';

  // 数据行
  jsonArray.forEach((item) => {
    const row = fields.map((field) => {
      const value = item[field];
      return value !== null && value !== undefined ? String(value) : '';
    });
    text += row.join(' | ') + '\n';
  });

  return text;
}

