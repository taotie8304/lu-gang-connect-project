// 鲁港通 - 香港政府数据页面爬取模块
import axios from 'axios';
import * as cheerio from 'cheerio';

// 鲁港通 - 性能优化：创建 axios 实例复用连接
const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  },
  // 鲁港通 - 启用 HTTP Keep-Alive 连接复用
  httpAgent: require('http').Agent({ keepAlive: true }),
  httpsAgent: require('https').Agent({ keepAlive: true })
});

export interface ScrapedFileInfo {
  fileName: string;
  fileUrl: string;
  fileSize?: string;
  updateTime?: string;
  detailPageUrl?: string;
}

export interface ScrapeResult {
  files: ScrapedFileInfo[];
  error?: string;
}

/**
 * 爬取香港政府数据集页面，提取文件信息
 * @param datasetUrl 数据集页面 URL
 * @param fileFormat 文件格式 (csv, xlsx, xml)
 * @returns 文件信息列表
 */
export async function scrapeDatasetPage(
  datasetUrl: string,
  fileFormat: string
): Promise<ScrapeResult> {
  try {
    // 鲁港通 - 性能优化：使用复用连接的 axios 实例
    const response = await axiosInstance.get(datasetUrl);

    const $ = cheerio.load(response.data);
    const files: ScrapedFileInfo[] = [];
    
    // 鲁港通 - 性能优化：预编译正则表达式
    const dateRegex = /\d{2,4}[-/]\d{1,2}[-/]\d{1,4}/;
    const sizeRegex = /\d+(\.\d+)?\s*(KB|MB|GB)/i;
    const fileFormatLower = fileFormat.toLowerCase();

    // 鲁港通 - 性能优化：使用 Map 去重，避免重复文件
    const fileMap = new Map<string, ScrapedFileInfo>();

    // 查找所有资源链接
    // 香港政府数据网站的资源通常在表格或列表中
    $('a').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const text = $link.text().trim();

      if (!href) return;

      // 检查是否是目标文件格式
      const lowerHref = href.toLowerCase();
      const lowerText = text.toLowerCase();

      if (
        lowerHref.includes(`.${fileFormatLower}`) ||
        lowerText.includes(fileFormatLower) ||
        lowerHref.includes('download')
      ) {
        // 构建完整 URL
        let fullUrl = href;
        if (href.startsWith('/')) {
          const urlObj = new URL(datasetUrl);
          fullUrl = `${urlObj.protocol}//${urlObj.host}${href}`;
        } else if (!href.startsWith('http')) {
          fullUrl = new URL(href, datasetUrl).href;
        }

        // 鲁港通 - 性能优化：使用 URL 作为 key 去重
        if (fileMap.has(fullUrl)) return;

        // 提取文件名
        let fileName = text;
        if (lowerHref.includes(`.${fileFormatLower}`)) {
          const urlParts = href.split('/');
          fileName = urlParts[urlParts.length - 1].split('?')[0];
        }

        // 查找相关的更新时间和文件大小
        const $parent = $link.parent();
        const $row = $parent.closest('tr');
        let updateTime: string | undefined;
        let fileSize: string | undefined;

        if ($row.length > 0) {
          // 鲁港通 - 性能优化：只遍历一次 td 元素
          $row.find('td').each((_, td) => {
            const tdText = $(td).text().trim();
            // 匹配日期格式 (YYYY-MM-DD, DD/MM/YYYY, etc.)
            if (!updateTime && dateRegex.test(tdText)) {
              updateTime = tdText;
            }
            // 匹配文件大小 (KB, MB, GB)
            if (!fileSize && sizeRegex.test(tdText)) {
              fileSize = tdText;
            }
          });
        }

        fileMap.set(fullUrl, {
          fileName,
          fileUrl: fullUrl,
          fileSize,
          updateTime
        });
      }
    });

    // 鲁港通 - 性能优化：转换 Map 为数组
    const filesArray = Array.from(fileMap.values());

    // 查找详情页链接
    $('a').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const text = $link.text().trim().toLowerCase();

      if (
        href &&
        (text.includes('detail') ||
          text.includes('詳情') ||
          text.includes('详情') ||
          text.includes('more'))
      ) {
        let fullUrl = href;
        if (href.startsWith('/')) {
          const urlObj = new URL(datasetUrl);
          fullUrl = `${urlObj.protocol}//${urlObj.host}${href}`;
        } else if (!href.startsWith('http')) {
          fullUrl = new URL(href, datasetUrl).href;
        }

        // 将详情页链接添加到第一个文件
        if (filesArray.length > 0 && !filesArray[0].detailPageUrl) {
          filesArray[0].detailPageUrl = fullUrl;
        }
      }
    });

    return { files: filesArray };
  } catch (error: any) {
    return {
      files: [],
      error: `页面爬取失败: ${error.message}`
    };
  }
}

/**
 * 爬取详情页获取更详细的更新时间
 * @param detailPageUrl 详情页 URL
 * @returns 更新时间
 */
export async function scrapeDetailPage(detailPageUrl: string): Promise<string | null> {
  try {
    // 鲁港通 - 性能优化：使用复用连接的 axios 实例
    const response = await axiosInstance.get(detailPageUrl);

    const $ = cheerio.load(response.data);
    let updateTime: string | null = null;
    
    // 鲁港通 - 性能优化：预编译正则表达式
    const dateRegex = /\d{2,4}[-/]\d{1,2}[-/]\d{1,4}/;

    // 查找更新时间相关的文本
    $('*').each((_, element) => {
      // 鲁港通 - 性能优化：找到后立即返回
      if (updateTime) return false;
      
      const $el = $(element);
      const text = $el.text().trim();

      // 匹配"更新时间"、"最后更新"等标签
      if (
        text.includes('更新時間') ||
        text.includes('更新时间') ||
        text.includes('Last Updated') ||
        text.includes('Modified')
      ) {
        // 在同一元素或相邻元素中查找日期
        const dateMatch = text.match(dateRegex);
        if (dateMatch) {
          updateTime = dateMatch[0];
        } else {
          // 查找下一个兄弟元素
          const $next = $el.next();
          const nextText = $next.text().trim();
          const nextDateMatch = nextText.match(dateRegex);
          if (nextDateMatch) {
            updateTime = nextDateMatch[0];
          }
        }
      }
    });

    return updateTime;
  } catch (error) {
    return null;
  }
}
