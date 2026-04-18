// 鲁港通 - 手动触发自动更新
import { authDatasetCollection } from '@fastgpt/service/support/permission/dataset/auth';
import { NextAPI } from '@/service/middleware/entry';
import { WritePermissionVal } from '@fastgpt/global/support/permission/constant';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { type ApiRequestProps } from '@fastgpt/service/type/next';
import { triggerAutoUpdate } from '@fastgpt/service/core/dataset/autoUpdate';

export type TriggerAutoUpdateParams = {
  collectionId: string;
};

async function handler(req: ApiRequestProps<TriggerAutoUpdateParams>) {
  const { collectionId } = req.body;

  if (!collectionId) {
    return Promise.reject(CommonErrEnum.missingParams);
  }

  // 权限校验
  await authDatasetCollection({
    req,
    authToken: true,
    authApiKey: true,
    collectionId,
    per: WritePermissionVal
  });

  // 触发更新
  await triggerAutoUpdate(collectionId);

  return { success: true, message: '更新任务已触发' };
}

export default NextAPI(handler);
