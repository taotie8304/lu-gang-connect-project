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
  // 鲁港通 - GET 请求从 query 获取 collectionId，POST 请求从 body 获取
  const collectionId = req.method === 'GET' ? (req.query.collectionId as string) : req.body.collectionId;
  const { enabled, source, datasetUrl, fileFormat, api, detection, notification } = req.body;

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
  // 鲁港通 - 先检查 autoUpdateConfig 是否存在
  const collection = await MongoDatasetCollection.findById(collectionId);
  if (!collection) {
    return Promise.reject(CommonErrEnum.unExist);
  }

  // 鲁港通 - 如果 autoUpdateConfig 是 null 或不存在，先初始化整个对象
  if (!collection.autoUpdateConfig) {
    await MongoDatasetCollection.updateOne(
      { _id: collectionId },
      {
        $set: {
          autoUpdateConfig: {
            enabled: enabled || false,
            source: source || 'hk-gov-data',
            datasetUrl: datasetUrl || '',
            fileFormat: fileFormat || 'csv',
            api: api || undefined,
            detection: detection || {
              yearPattern: [],
              checkUpdateTime: true,
              detailPageCheck: false
            },
            notification: notification || undefined,
            history: []
          }
        }
      }
    );
  } else {
    // 鲁港通 - 如果已存在，使用 $set 更新各个字段
    const updateFields: any = {
      'autoUpdateConfig.enabled': enabled,
      'autoUpdateConfig.source': source,
      'autoUpdateConfig.datasetUrl': datasetUrl,
      'autoUpdateConfig.fileFormat': fileFormat,
      'autoUpdateConfig.detection': detection,
      'autoUpdateConfig.notification': notification
    };

    // 鲁港通 - 只有当 api 存在时才更新，否则删除该字段
    if (api) {
      updateFields['autoUpdateConfig.api'] = api;
    } else if (fileFormat !== 'api') {
      // 如果不是 API 格式，删除 api 字段
      await MongoDatasetCollection.updateOne(
        { _id: collectionId },
        { $unset: { 'autoUpdateConfig.api': '' } }
      );
    }

    await MongoDatasetCollection.updateOne(
      { _id: collectionId },
      { $set: updateFields }
    );
  }

  return { success: true };
}

export default NextAPI(handler);
