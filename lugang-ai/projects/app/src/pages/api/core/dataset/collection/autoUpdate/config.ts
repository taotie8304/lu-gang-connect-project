/**
 * 鲁港通 - 配置知识库集合自动更新（GET 读取 / POST 写入）
 * 适配 4.16.2：ApiRequestProps 来自 @fastgpt/next/type；输入用 parseApiInput + Zod 校验。
 */
import z from 'zod';
import { MongoDatasetCollection } from '@fastgpt/service/core/dataset/collection/schema';
import { authDatasetCollection } from '@fastgpt/service/support/permission/dataset/auth';
import { NextAPI } from '@/service/middleware/entry';
import { WritePermissionVal } from '@fastgpt/global/support/permission/constant';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { type ApiRequestProps } from '@fastgpt/next/type';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';

const ConfigQuerySchema = z.object({ collectionId: z.string() });

const ConfigBodySchema = z.object({
  collectionId: z.string(),
  enabled: z.boolean(),
  source: z.enum(['hk-gov-data', 'custom']).optional(),
  datasetUrl: z.string().optional(),
  fileFormat: z.enum(['csv', 'xlsx', 'xml', 'json', 'api']).optional(),
  api: z
    .object({
      endpoint: z.string(),
      method: z.string().optional(),
      headers: z.record(z.string(), z.string()).optional(),
      cacheKey: z.string().optional()
    })
    .optional(),
  detection: z
    .object({
      yearPattern: z.array(z.string()).optional(),
      checkUpdateTime: z.boolean().optional(),
      detailPageCheck: z.boolean().optional()
    })
    .optional(),
  notification: z.object({ enabled: z.boolean(), email: z.string().optional() }).optional()
});

// 未配置时返回的默认值
const DEFAULT_CONFIG = {
  enabled: false,
  source: 'hk-gov-data',
  datasetUrl: '',
  fileFormat: 'csv',
  detection: { yearPattern: [], checkUpdateTime: true, detailPageCheck: false }
};

async function handler(req: ApiRequestProps) {
  // GET：读取当前配置
  if (req.method === 'GET') {
    const { collectionId } = parseApiInput({ req, querySchema: ConfigQuerySchema }).query!;
    await authDatasetCollection({
      req,
      authToken: true,
      authApiKey: true,
      collectionId,
      per: WritePermissionVal
    });

    const collection = await MongoDatasetCollection.findById(collectionId).lean();
    if (!collection) return Promise.reject(CommonErrEnum.unExist);
    return collection.autoUpdateConfig || DEFAULT_CONFIG;
  }

  // POST：写入配置（保留 history 与运行时状态字段）
  const { collectionId, enabled, source, datasetUrl, fileFormat, api, detection, notification } =
    parseApiInput({ req, bodySchema: ConfigBodySchema }).body!;
  await authDatasetCollection({
    req,
    authToken: true,
    authApiKey: true,
    collectionId,
    per: WritePermissionVal
  });

  const collection = await MongoDatasetCollection.findById(collectionId).lean();
  if (!collection) return Promise.reject(CommonErrEnum.unExist);

  // 以现有配置为基线合并用户编辑，保留 history/lastCheckTime/lastUpdateTime/lastMetadataModified/cacheKey 等状态
  const existing = (collection.autoUpdateConfig || {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = {
    ...existing,
    enabled,
    ...(source !== undefined && { source }),
    ...(datasetUrl !== undefined && { datasetUrl }),
    ...(fileFormat !== undefined && { fileFormat }),
    ...(detection !== undefined && { detection }),
    ...(notification !== undefined && { notification }),
    ...(api !== undefined && { api })
  };
  // 非 API 格式时清除残留 api 配置，避免误触发 API 分支
  const effectiveFormat = (fileFormat ?? existing.fileFormat) as string | undefined;
  if (effectiveFormat && effectiveFormat !== 'api') delete merged.api;

  await MongoDatasetCollection.updateOne(
    { _id: collectionId },
    { $set: { autoUpdateConfig: merged } }
  );

  return { success: true };
}

export default NextAPI(handler);
