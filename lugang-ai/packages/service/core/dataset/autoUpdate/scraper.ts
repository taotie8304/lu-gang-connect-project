/**
 * 鲁港通 - 数据集页面爬取模块（D8 修复版）
 *
 * 定位：仅作为「非 CKAN 静态页面」的兜底抓取器。
 *   主路径（data.gov.hk / csdi.gov.hk）已改走 CKAN package_show 枚举全部资源，
 *   见 ./hkGovApiConverter.ts —— 旧版对本模块的 HTML <a> 抓取在 CKAN 分页/JS 渲染页面上抓不全，
 *   这是「自动更新不工作」的根因之一，故 CKAN 源不再依赖本模块。
 *
 * 修复点：
 *  1. 改用 4.16.2 封装 axios（SSRF 防护 + 代理感知），丢弃旧版 `require('http').Agent()` keepAlive hack；
 *  2. 收紧松匹配：去掉裸 `href.includes('download')`（会误命中大量无关链接），改为以扩展名/文件名为主判据；
 *  3. console.* → getLogger(LogCategories.MODULE.DATASET.AUTO_UPDATE)。
 */
import * as cheerio from 'cheerio';
import { axios } from '../../../common/api/axios';
import { getLogger, LogCategories } from '../../../common/logger';

const logger = getLogger(LogCategories.MODULE.DATASET.AUTO_UPDATE);

const REQUEST_TIMEOUT = 30000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export interface ScrapedFileInfo {
  fileName: string;
  fileUrl: string;
  /** 页面展示的体积文本（如 "1.2 MB"），非字节数 */
  fileSize?: string;
  updateTime?: string;
  detailPageUrl?: string;
}

export interface ScrapeResult {
  files: ScrapedFileInfo[];
  error?: string;
}

/** 将相对链接补全为绝对 URL */
function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  if (href.startsWith('//')) {
    const protocol = new URL(baseUrl).protocol; // http: 或 https:
    return `${protocol}${href}`;
  }
  if (href.startsWith('/')) {
    const urlObj = new URL(baseUrl);
    return `${urlObj.protocol}//${urlObj.host}${href}`;
  }
  return new URL(href, baseUrl).href;
}

/**
 * 判断链接是否命中目标文件格式（收紧版）。
 * 仅当 href 路径含目标扩展名，或链接文本含扩展名时命中；不再因裸 'download' 字样命中。
 */
function matchFileLink(lowerHref: string, lowerText: string, fmt: string): boolean {
  const ext = `.${fmt}`;
  // href 路径部分（去查询/锚点）以扩展名结尾，或含 `扩展名?`/`扩展名#`
  const hrefPath = lowerHref.split('?')[0].split('#')[0];
  if (hrefPath.endsWith(ext)) return true;
  if (lowerHref.includes(`${ext}?`) || lowerHref.includes(`${ext}#`)) return true;
  // 链接文本明确带扩展名（如 "budget_2025.csv"）
  if (lowerText.includes(ext)) return true;
  return false;
}

/**
 * 爬取（非 CKAN）数据集页面，提取指定格式的文件信息。
 * @param datasetUrl 数据集页面 URL
 * @param fileFormat 文件格式（csv/xlsx/xml）
 */
export async function scrapeDatasetPage(
  datasetUrl: string,
  fileFormat: string
): Promise<ScrapeResult> {
  try {
    const response = await axios.get(datasetUrl, {
      timeout: REQUEST_TIMEOUT,
      headers: { 'User-Agent': UA }
    });

    const $ = cheerio.load(response.data as string);
    const fmt = fileFormat.toLowerCase();

    // 鲁港通 - 预编译正则
    const dateRegex = /\d{2,4}[-/]\d{1,2}[-/]\d{1,4}/;
    const sizeRegex = /\d+(\.\d+)?\s*(KB|MB|GB)/i;

    // 鲁港通 - 用 Map 以 URL 去重
    const fileMap = new Map<string, ScrapedFileInfo>();

    $('a').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const text = $link.text().trim();
      if (!href) return;

      const lowerHref = href.toLowerCase();
      const lowerText = text.toLowerCase();

      if (!matchFileLink(lowerHref, lowerText, fmt)) return;

      const fullUrl = resolveUrl(href, datasetUrl);
      if (fileMap.has(fullUrl)) return;

      // 提取文件名：优先取 URL 末段，退化用链接文本
      let fileName = text;
      const urlPath = href.split('?')[0].split('#')[0];
      if (urlPath.toLowerCase().includes(`.${fmt}`)) {
        const parts = urlPath.split('/');
        fileName = parts[parts.length - 1] || text;
      }

      // 在同行的 td 中查找更新时间与体积
      const $row = $link.parent().closest('tr');
      let updateTime: string | undefined;
      let fileSize: string | undefined;
      if ($row.length > 0) {
        $row.find('td').each((_, td) => {
          const tdText = $(td).text().trim();
          if (!updateTime && dateRegex.test(tdText)) updateTime = tdText;
          if (!fileSize && sizeRegex.test(tdText)) fileSize = tdText;
        });
      }

      fileMap.set(fullUrl, { fileName: fileName || fullUrl, fileUrl: fullUrl, fileSize, updateTime });
    });

    const files = Array.from(fileMap.values());

    // 查找详情页链接，挂到第一个文件上（供 detector 二级检测）
    if (files.length > 0) {
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
          if (!files[0].detailPageUrl) files[0].detailPageUrl = resolveUrl(href, datasetUrl);
        }
      });
    }

    return { files };
  } catch (error) {
    logger.error('鲁港通 - 数据集页面爬取失败', { datasetUrl, error });
    return { files: [], error: `页面爬取失败: ${(error as Error).message}` };
  }
}

/**
 * 爬取详情页，提取「更新时间」文本（供二级检测）。
 * @returns 更新时间字符串；无法解析返回 null
 */
export async function scrapeDetailPage(detailPageUrl: string): Promise<string | null> {
  try {
    const response = await axios.get(detailPageUrl, {
      timeout: REQUEST_TIMEOUT,
      headers: { 'User-Agent': UA }
    });

    const $ = cheerio.load(response.data as string);
    const dateRegex = /\d{2,4}[-/]\d{1,2}[-/]\d{1,4}/;
    let updateTime: string | null = null;

    $('*').each((_, element) => {
      if (updateTime) return false; // 找到即停
      const $el = $(element);
      const text = $el.text().trim();

      if (
        text.includes('更新時間') ||
        text.includes('更新时间') ||
        text.includes('Last Updated') ||
        text.includes('Modified')
      ) {
        const dateMatch = text.match(dateRegex);
        if (dateMatch) {
          updateTime = dateMatch[0];
        } else {
          const nextDateMatch = $el.next().text().trim().match(dateRegex);
          if (nextDateMatch) updateTime = nextDateMatch[0];
        }
      }
    });

    return updateTime;
  } catch (error) {
    logger.warn('鲁港通 - 详情页爬取失败', { detailPageUrl, error });
    return null;
  }
}
