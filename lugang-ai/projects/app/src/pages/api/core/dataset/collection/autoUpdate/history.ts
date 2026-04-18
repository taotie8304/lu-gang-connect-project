// 鲁港通 - 获取自动更新历史
import { MongoDatasetCollection } from '@fastgpt/service/core/dataset/collection/schema';
import { authDatasetCollection } from '@fastgpt/service/support/permission/dataset/auth';
import { NextAPI } from '@/service/middleware/entry';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { type ApiRequestProps } from '@fastgpt/service/type/next';

export type GetAutoUpdateHistoryParams = {
  collectionId: string;
};

async function handler(req: ApiRequestProps<GetAutoUpdateHistoryParams>) {
  const { collectionId } = req.query;

  if (!collectionId) {
    return Promise.reject(CommonErrEnum.missingParams);
  }

  // 权限校验
  await authDatasetCollection({
    req,
    authToken: true,
    authApiKey: true,
    collectionId: collectionId as string,
    per: ReadPermissionVal
  });

  // 获取配置和历史
  const collection = await MongoDatasetCollection.findById(collectionId, 'autoUpdateConfig');

  if (!collection?.autoUpdateConfig) {
    return {
      enabled: false,
      history: []
    };
  }

  return {
    enabled: collection.autoUpdateConfig.enabled,
    lastCheckTime: collection.autoUpdateConfig.lastCheckTime,
    lastUpdateTime: collection.autoUpdateConfig.lastUpdateTime,
    history: collection.autoUpdateConfig.history || []
  };
}

export default NextAPI(handler);
