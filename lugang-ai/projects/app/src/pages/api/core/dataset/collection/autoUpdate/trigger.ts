/**
 * 鲁港通 - 手动触发知识库集合自动更新
 * 适配 4.16.2：ApiRequestProps 来自 @fastgpt/next/type；输入用 parseApiInput + Zod 校验。
 *
 * 修复：旧版此处内联了一整套「港府 API 更新」逻辑（引用不存在的 downloadHkGovApiData、
 *   mode 误传 collection.trainingType、billId:undefined、整块 chunkIndex:0 入库、require('crypto')），
 *   与调度器重复且带同样的 bug。现统一委托 triggerAutoUpdate → processCollection，
 *   走修复后的 CKAN/API/静态页分流 + clean-old-first + 分块入库，并回传执行结果。
 */
import z from 'zod';
import { authDatasetCollection } from '@fastgpt/service/support/permission/dataset/auth';
import { NextAPI } from '@/service/middleware/entry';
import { WritePermissionVal } from '@fastgpt/global/support/permission/constant';
import { type ApiRequestProps } from '@fastgpt/next/type';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import { triggerAutoUpdate } from '@fastgpt/service/core/dataset/autoUpdate';

const TriggerBodySchema = z.object({ collectionId: z.string() });

async function handler(req: ApiRequestProps) {
  const { collectionId } = parseApiInput({ req, bodySchema: TriggerBodySchema }).body!;

  await authDatasetCollection({
    req,
    authToken: true,
    authApiKey: true,
    collectionId,
    per: WritePermissionVal
  });

  const result = await triggerAutoUpdate(collectionId);

  return {
    success: result.success,
    updated: result.updated,
    message: result.message
  };
}

export default NextAPI(handler);
