// 鲁港通 - 文件下载和导入模块
import axios from 'axios';
import { ScrapedFileInfo } from './scraper';
import { readCsvRawText } from '../../worker/readFile/extension/csv';
import { readXlsxRawText } from '../../worker/readFile/extension/xlsx';
import { readFileRawText } from '../../worker/readFile/extension/rawText';

// 鲁港通 - 性能优化：创建 axios 实例复用连接
const axiosInstance = axios.create({
  timeout: 5 * 60 * 1000, // 5 分钟超时
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  },
  // 鲁港通 - 启用 HTTP Keep-Alive 连接复用
  httpAgent: require('http').Agent({ keepAlive: true, maxSockets: 5 }),
  httpsAgent: require('https').Agent({ keepAlive: true, maxSockets: 5 }),
  // 鲁港通 - 性能优化：限制最大内容长度为 100MB
  maxContentLength: 100 * 1024 * 1024,
  maxBodyLength: 100 * 1024 * 1024
});

export interface DownloadResult {
  success: boolean;
  rawText?: string;
  formatText?: string;
  fileSize?: number;
  error?: string;
}

/**
 * 下载文件并解析内容
 * @param fileInfo 文件信息
 * @param fileFormat 文件格式
 * @returns 下载和解析结果
 */
export async function downloadAndParseFile(
  fileInfo: ScrapedFileInfo,
  fileFormat: string
): Promise<DownloadResult> {
  try {
    // 鲁港通 - 性能优化：使用流式下载，减少内存占用
    const response = await axiosInstance.get(fileInfo.fileUrl, {
      responseType: 'arraybuffer'
    });

    const buffer = Buffer.from(response.data);
    const fileSize = buffer.length;

    // 根据文件格式解析
    let result;
    switch (fileFormat.toLowerCase()) {
      case 'csv':
        result = await readCsvRawText({
          buffer,
          encoding: 'utf-8',
          metadata: {}
        });
        break;

      case 'xlsx':
        result = await readXlsxRawText({
          buffer,
          encoding: 'utf-8',
          metadata: {}
        });
        break;

      case 'xml':
        result = await readFileRawText({
          buffer,
          encoding: 'utf-8',
          metadata: {}
        });
        break;

      default:
        return {
          success: false,
          error: `不支持的文件格式: ${fileFormat}`
        };
    }

    return {
      success: true,
      rawText: result.rawText,
      formatText: result.formatText,
      fileSize
    };
  } catch (error: any) {
    return {
      success: false,
      error: `文件下载或解析失败: ${error.message}`
    };
  }
}

/**
 * 下载 API 数据
 * @param apiEndpoint API 端点
 * @param method HTTP 方法
 * @param headers 请求头
 * @returns 下载结果
 */
export async function downloadApiData(
  apiEndpoint: string,
  method: string = 'GET',
  headers?: Record<string, string>
): Promise<DownloadResult> {
  try {
    // 鲁港通 - 性能优化：使用复用连接的 axios 实例
    const response = await axiosInstance({
      url: apiEndpoint,
      method,
      headers: {
        ...axiosInstance.defaults.headers,
        ...headers
      },
      timeout: 60000
    });

    const rawText = JSON.stringify(response.data, null, 2);
    const fileSize = Buffer.byteLength(rawText, 'utf-8');

    return {
      success: true,
      rawText,
      formatText: rawText,
      fileSize
    };
  } catch (error: any) {
    return {
      success: false,
      error: `API 数据下载失败: ${error.message}`
    };
  }
}
