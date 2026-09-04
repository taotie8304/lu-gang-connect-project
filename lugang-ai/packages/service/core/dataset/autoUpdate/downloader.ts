/**
 * 鲁港通 - 文件下载与解析模块（D8 修复版）
 *
 * 修复依据（实证 .qoder/d8-verify-harness.mjs）：
 *  1. 编码：data.gov.hk 静态 CSV 实测为 UTF-16LE(带 BOM)，旧版硬编码 `encoding:'utf-8'` → 乱码入库；
 *     此处做 BOM 感知检测，剥离 BOM 后向官方读取器传正确 encoding（官方 readFileRawText 支持 utf16le）。
 *  2. 分隔符：官方 readCsvRawText 用 papaparse（自动识别 TAB/逗号），无需手动处理（实测该文件为 TAB 分隔）。
 *  3. 参数漂移：4.16.2 `ReadRawTextByBuffer = { extension, buffer, encoding }`，
 *     旧版传的 `metadata` 已非法、`extension` 变必填 → 已适配。
 *  4. headers 污染：旧版 `...axiosInstance.defaults.headers` 会把 common/get/post 当作 header 键展开 → 已改为仅传业务 header。
 */
import { axios } from '../../../common/api/axios';
import { getLogger, LogCategories } from '../../../common/logger';
import { readCsvRawText } from '../../../worker/readFile/extension/csv';
import { readXlsxRawText } from '../../../worker/readFile/extension/xlsx';
import { readFileRawText } from '../../../worker/readFile/extension/rawText';
import { type ReadFileResponse } from '../../../worker/readFile/type';
import { downloadResourceBuffer } from './hkGovApiConverter';
import { type ScrapedFileInfo } from './scraper';

const logger = getLogger(LogCategories.MODULE.DATASET.AUTO_UPDATE);
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export interface DownloadResult {
  success: boolean;
  rawText?: string;
  formatText?: string;
  fileSize?: number;
  error?: string;
}

/**
 * BOM 感知解码：返回剥离 BOM 后的 buffer 与官方读取器可识别的 encoding。
 * 覆盖 UTF-16LE/BE 与 UTF-8 BOM；无 BOM 时按 utf-8。
 */
export function decodeByBom(buffer: Buffer): { buffer: Buffer; encoding: 'utf16le' | 'utf-8' } {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { buffer: buffer.subarray(2), encoding: 'utf16le' };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    // 鲁港通 - UTF-16BE：剥离 BOM 后整体做一次 16 位字节交换，再以 utf16le 解码。
    //   swap16() 单次即交换整个缓冲区，切勿循环调用（会来回交换，长度可被 4 整除时净效果为未交换）。
    const swapped = Buffer.from(buffer.subarray(2));
    if (swapped.length % 2 === 0) swapped.swap16();
    return { buffer: swapped, encoding: 'utf16le' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { buffer: buffer.subarray(3), encoding: 'utf-8' };
  }
  return { buffer, encoding: 'utf-8' };
}

/**
 * 下载文件并解析为知识库文本。
 * @param fileInfo 文件信息（含直链 URL）
 * @param fileFormat 文件格式 csv/xlsx/xml
 */
export async function downloadAndParseFile(
  fileInfo: ScrapedFileInfo,
  fileFormat: string
): Promise<DownloadResult> {
  try {
    const buffer = await downloadResourceBuffer(fileInfo.fileUrl);
    const fileSize = buffer.length;
    const fmt = fileFormat.toLowerCase();

    let result: ReadFileResponse;
    if (fmt === 'xlsx') {
      // xlsx 为二进制 zip，交由官方 node-xlsx 解析器处理原始 buffer
      result = await readXlsxRawText({ extension: 'xlsx', buffer, encoding: 'utf-8' });
    } else if (fmt === 'csv') {
      const { buffer: textBuffer, encoding } = decodeByBom(buffer);
      result = await readCsvRawText({ extension: 'csv', buffer: textBuffer, encoding });
    } else if (fmt === 'xml' || fmt === 'txt' || fmt === 'text') {
      const { buffer: textBuffer, encoding } = decodeByBom(buffer);
      result = await readFileRawText({ extension: fmt === 'xml' ? 'xml' : 'txt', buffer: textBuffer, encoding });
    } else {
      return { success: false, error: `不支持的文件格式: ${fileFormat}` };
    }

    return {
      success: true,
      rawText: result.rawText,
      formatText: result.formatText,
      fileSize
    };
  } catch (error) {
    logger.error('鲁港通 - 文件下载或解析失败', { fileUrl: fileInfo.fileUrl, error });
    return { success: false, error: `文件下载或解析失败: ${(error as Error).message}` };
  }
}

/**
 * 下载 API 数据（JSON 等）并转为文本。
 * 修复：headers 仅传业务头，不再展开 axios defaults（旧版会把 common/get/post 当 header 键）。
 */
export async function downloadApiData(
  apiEndpoint: string,
  method: string = 'GET',
  headers?: Record<string, string>
): Promise<DownloadResult> {
  try {
    const response = await axios.request({
      url: apiEndpoint,
      method: method.toUpperCase() as 'GET' | 'POST' | 'PUT',
      headers: { 'User-Agent': UA, ...(headers || {}) },
      timeout: 60000,
      responseType: 'arraybuffer'
    });

    const buffer = Buffer.from(response.data as ArrayBuffer);
    const { buffer: textBuffer, encoding } = decodeByBom(buffer);
    const rawText = textBuffer.toString(encoding);
    const fileSize = Buffer.byteLength(rawText, 'utf-8');

    // JSON 数组转为易读表格文本，其余保持原样
    let formatText = rawText;
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) formatText = convertJsonArrayToText(parsed);
      else formatText = JSON.stringify(parsed, null, 2);
    } catch {
      // 非 JSON，按原始文本入库
    }

    return { success: true, rawText, formatText, fileSize };
  } catch (error) {
    logger.error('鲁港通 - API 数据下载失败', { apiEndpoint, error });
    return { success: false, error: `API 数据下载失败: ${(error as Error).message}` };
  }
}

/** 将 JSON 数组转为 Markdown 风格表格文本，便于知识库检索 */
function convertJsonArrayToText(jsonArray: Record<string, unknown>[]): string {
  if (jsonArray.length === 0) return '数据为空';
  const fields = Object.keys(jsonArray[0]);
  const lines: string[] = [];
  lines.push(fields.join(' | '));
  lines.push(fields.map(() => '---').join(' | '));
  for (const item of jsonArray) {
    lines.push(
      fields
        .map((field) => {
          const value = item[field];
          return value !== null && value !== undefined ? String(value) : '';
        })
        .join(' | ')
    );
  }
  return lines.join('\n');
}
