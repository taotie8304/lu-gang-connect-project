// 鲁港通 - 识别香港政府数据集 API
import { authDatasetCollection } from '@fastgpt/service/support/permission/dataset/auth';
import { NextAPI } from '@/service/middleware/entry';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { type ApiRequestProps } from '@fastgpt/service/type/next';
import { scrapeDatasetPage } from '@fastgpt/service/core/dataset/autoUpdate';

export type DetectDatasetParams = {
  collectionId: string;
  datasetUrl: string;
};

async function handler(req: ApiRequestProps<DetectDatasetParams>) {
  const { collectionId, datasetUrl } = req.body;

  if (!collectionId || !datasetUrl) {
    return Promise.reject(CommonErrEnum.missingParams);
  }

  // 权限校验
  await authDatasetCollection({
    req,
    authToken: true,
    authApiKey: true,
    collectionId,
    per: ReadPermissionVal
  });

  // 爬取页面，识别数据集信息
  const csvResult = await scrapeDatasetPage(datasetUrl, 'csv');
  const xlsxResult = await scrapeDatasetPage(datasetUrl, 'xlsx');
  const xmlResult = await scrapeDatasetPage(datasetUrl, 'xml');

  // 合并结果
  const allFiles = [
    ...csvResult.files.map((f) => ({ ...f, format: 'csv' })),
    ...xlsxResult.files.map((f) => ({ ...f, format: 'xlsx' })),
    ...xmlResult.files.map((f) => ({ ...f, format: 'xml' }))
  ];

  if (allFiles.length === 0) {
    return {
      success: false,
      message: '未能识别到任何数据文件，请检查 URL 是否正确'
    };
  }

  // 返回识别结果
  return {
    success: true,
    files: allFiles,
    message: `成功识别到 ${allFiles.length} 个数据文件`
  };
}

export default NextAPI(handler);
