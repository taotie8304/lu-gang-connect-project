/**
 * 鲁港通 - 识别数据集（CKAN package_show 优先，静态页文件爬取兜底）
 * 适配 4.16.2：ApiRequestProps 来自 @fastgpt/next/type；输入用 parseApiInput + Zod 校验。
 */
import z from 'zod';
import { authDatasetCollection } from '@fastgpt/service/support/permission/dataset/auth';
import { NextAPI } from '@/service/middleware/entry';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { type ApiRequestProps } from '@fastgpt/next/type';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import {
  isHkGovDatasetUrl,
  convertHkGovDatasetToApi
} from '@fastgpt/service/core/dataset/autoUpdate/hkGovApiConverter';
import { scrapeDatasetPage } from '@fastgpt/service/core/dataset/autoUpdate';

const DetectBodySchema = z.object({
  collectionId: z.string(),
  datasetUrl: z.string()
});

async function handler(req: ApiRequestProps) {
  const { collectionId, datasetUrl } = parseApiInput({ req, bodySchema: DetectBodySchema }).body!;

  await authDatasetCollection({
    req,
    authToken: true,
    authApiKey: true,
    collectionId,
    per: ReadPermissionVal
  });

  // 香港政府数据集：走 CKAN package_show 枚举资源（可靠）
  if (isHkGovDatasetUrl(datasetUrl)) {
    const apiInfo = await convertHkGovDatasetToApi(datasetUrl);
    if (apiInfo) {
      return {
        success: true,
        type: 'api',
        apiInfo: {
          endpoint: apiInfo.apiEndpoint,
          cacheKey: apiInfo.cacheKey,
          datasetId: apiInfo.datasetId,
          resourceId: apiInfo.resourceId,
          format: apiInfo.format,
          metadataModified: apiInfo.metadataModified,
          metadata: apiInfo.metadata
        },
        message: '成功识别香港政府数据集'
      };
    }
  }

  // 兜底：非 CKAN 静态页，按格式并行爬取文件链接
  const [csvResult, xlsxResult, xmlResult] = await Promise.all([
    scrapeDatasetPage(datasetUrl, 'csv'),
    scrapeDatasetPage(datasetUrl, 'xlsx'),
    scrapeDatasetPage(datasetUrl, 'xml')
  ]);

  const allFiles = [
    ...csvResult.files.map((f) => ({ ...f, format: 'csv' })),
    ...xlsxResult.files.map((f) => ({ ...f, format: 'xlsx' })),
    ...xmlResult.files.map((f) => ({ ...f, format: 'xml' }))
  ];

  if (allFiles.length === 0) {
    return {
      success: false,
      message: '未能识别到任何数据文件，请检查 URL 是否正确或该数据集是否仅提供图片资源'
    };
  }

  return {
    success: true,
    type: 'file',
    files: allFiles,
    message: `成功识别到 ${allFiles.length} 个数据文件`
  };
}

export default NextAPI(handler);
