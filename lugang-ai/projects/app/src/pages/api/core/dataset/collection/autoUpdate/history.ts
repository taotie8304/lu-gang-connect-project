/**
 * 鲁港通 - 获取知识库集合自动更新历史
 * 适配 4.16.2：ApiRequestProps 来自 @fastgpt/next/type；输入用 parseApiInput + Zod 校验。
 */
import z from 'zod';
import { MongoDatasetCollection } from '@fastgpt/service/core/dataset/collection/schema';
import { authDatasetCollection } from '@fastgpt/service/support/permission/dataset/auth';
import { NextAPI } from '@/service/middleware/entry';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { type ApiRequestProps } from '@fastgpt/next/type';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';

const HistoryQuerySchema = z.object({ collectionId: z.string() });

async function handler(req: ApiRequestProps) {
  const { collectionId } = parseApiInput({ req, querySchema: HistoryQuerySchema }).query!;

  await authDatasetCollection({
    req,
    authToken: true,
    authApiKey: true,
    collectionId,
    per: ReadPermissionVal
  });

  const collection = await MongoDatasetCollection.findById(collectionId, 'autoUpdateConfig').lean();
  const config = collection?.autoUpdateConfig;
  if (!config) {
    return { enabled: false, history: [] };
  }

  return {
    enabled: config.enabled ?? false,
    source: config.source,
    datasetUrl: config.datasetUrl,
    fileFormat: config.fileFormat,
    lastCheckTime: config.lastCheckTime,
    lastUpdateTime: config.lastUpdateTime,
    lastMetadataModified: config.lastMetadataModified,
    // 最近 50 条，倒序（最新在前），避免历史无限增长拖慢响应
    history: (config.history || []).slice(-50).reverse()
  };
}

export default NextAPI(handler);
