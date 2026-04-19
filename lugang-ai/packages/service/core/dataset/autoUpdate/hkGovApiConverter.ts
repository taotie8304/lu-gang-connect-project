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
  resourceUrl?: string; // 资源 URL（用于 v2/filter API）
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
      console.error('鲁港通 - 无法从 URL 中提取 datasetId');
      return null;
    }

    console.log('鲁港通 - 数据集 ID:', datasetId);

    // 2. 使用 CKAN API 获取数据集元数据
    const ckanApiUrl = `https://data.gov.hk/tc-data/api/3/action/package_show?id=${datasetId}`;
    console.log('鲁港通 - 调用 CKAN API:', ckanApiUrl);

    const ckanResponse = await axiosInstance.get(ckanApiUrl);

    if (!ckanResponse.data.success) {
      console.error('鲁港通 - CKAN API 调用失败');
      return null;
    }

    const packageData = ckanResponse.data.result;
    console.log('鲁港通 - 数据集名称:', packageData.title || packageData.name);

    // 3. 提取元数据
    const metadata: HkGovApiInfo['metadata'] = {
      title: packageData.title || packageData.name,
      description: packageData.notes || packageData.description,
      updateFrequency: packageData.update_frequency,
      lastModified: packageData.metadata_modified || packageData.last_modified
    };

    // 4. 查找资源（resources）
    const resources = packageData.resources || [];
    if (resources.length === 0) {
      console.error('鲁港通 - 数据集没有资源');
      return null;
    }

    // 鲁港通 - 优先选择 CSV 或 JSON 格式的资源
    let selectedResource = null;
    let format = 'csv';

    // 优先选择 CSV
    for (const resource of resources) {
      const resourceFormat = (resource.format || '').toLowerCase();
      const resourceUrl = resource.url || '';

      if (resourceFormat === 'csv' || resourceUrl.endsWith('.csv')) {
        selectedResource = resource;
        format = 'csv';
        break;
      }
    }

    // 如果没有 CSV，选择 JSON
    if (!selectedResource) {
      for (const resource of resources) {
        const resourceFormat = (resource.format || '').toLowerCase();
        const resourceUrl = resource.url || '';

        if (resourceFormat === 'json' || resourceUrl.endsWith('.json')) {
          selectedResource = resource;
          format = 'json';
          break;
        }
      }
    }

    // 如果还是没有，选择第一个资源
    if (!selectedResource) {
      selectedResource = resources[0];
      format = (selectedResource.format || 'csv').toLowerCase();
    }

    const resourceUrl = selectedResource.url;
    console.log('鲁港通 - 选择的资源 URL:', resourceUrl);
    console.log('鲁港通 - 资源格式:', format);

    // 5. 构建数据筛选 API 地址
    // 根据香港政府 API 规范，使用 v2/filter API
    const filterQuery = {
      resource: resourceUrl,
      section: 1,
      format: 'json' // 始终请求 JSON 格式，便于处理
    };

    const apiEndpoint = `https://api.data.gov.hk/v2/filter?q=${encodeURIComponent(
      JSON.stringify(filterQuery)
    )}`;

    console.log('鲁港通 - 生成的 API 端点:', apiEndpoint);

    // 6. 生成缓存键
    const cacheKey = await generateCacheKey(apiEndpoint);

    return {
      apiEndpoint,
      cacheKey,
      datasetId,
      resourceUrl,
      format,
      metadata
    };
  } catch (error: any) {
    console.error('鲁港通 - 转换香港政府数据集 URL 失败:', error.message);
    if (error.response) {
      console.error('鲁港通 - 响应状态:', error.response.status);
      console.error('鲁港通 - 响应数据:', error.response.data);
    }
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
    console.error('鲁港通 - 生成缓存键失败:', error.message);
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
    console.error('鲁港通 - 检查 API 数据更新失败:', error.message);
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

    // 鲁港通 - v2/filter API 始终返回 JSON 格式
    const jsonData = response.data;

    if (Array.isArray(jsonData)) {
      // 如果是数组，转换为表格格式
      formattedData = convertJsonArrayToText(jsonData);
    } else {
      // 如果是对象，转换为键值对格式
      formattedData = JSON.stringify(jsonData, null, 2);
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

