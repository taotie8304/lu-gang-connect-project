// 鲁港通 - 配置自动更新
import { MongoDatasetCollection } from '@fastgpt/service/core/dataset/collection/schema';
import { authDatasetCollection } from '@fastgpt/service/support/permission/dataset/auth';
import { NextAPI } from '@/service/middleware/entry';
import { WritePermissionVal } from '@fastgpt/global/support/permission/constant';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { type ApiRequestProps } from '@fastgpt/service/type/next';

export type ConfigAutoUpdateParams = {
  collectionId: string;
  enabled: boolean;
  source?: string;
  datasetUrl?: string;
  fileFormat?: string;
  api?: {
    endpoint: string;
    method: string;
    headers?: Record<string, string>;
    cacheKey?: string;
  };
  detection?: {
    yearPattern?: string[];
    checkUpdateTime: boolean;
    detailPageCheck: boolean;
  };
  notification?: {
    enabled: boolean;
    email?: string;
  };
};

async function handler(req: ApiRequestProps<ConfigAutoUpdateParams>) {
  const { collectionId, enabled, source, datasetUrl, fileFormat, api, detection, notification } =
    req.body;

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

  // GET 请求 - 获取配置
  if (req.method === 'GET') {
    const collection = await MongoDatasetCollection.findById(collectionId);
    if (!collection) {
      return Promise.reject(CommonErrEnum.unExist);
    }
    return collection.autoUpdateConfig || {
      enabled: false,
      source: 'hk-gov-data',
      datasetUrl: '',
      fileFormat: 'csv',
      detection: {
        yearPattern: [],
        checkUpdateTime: true,
        detailPageCheck: false
      }
    };
  }

  // POST 请求 - 更新配置
  await MongoDatasetCollection.updateOne(
    { _id: collectionId },
    {
      $set: {
        'autoUpdateConfig.enabled': enabled,
        'autoUpdateConfig.source': source,
        'autoUpdateConfig.datasetUrl': datasetUrl,
        'autoUpdateConfig.fileFormat': fileFormat,
        'autoUpdateConfig.api': api,
        'autoUpdateConfig.detection': detection,
        'autoUpdateConfig.notification': notification
      }
    }
  );

  return { success: true };
}

export default NextAPI(handler);
