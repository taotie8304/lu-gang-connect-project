// 鲁港通 - 手动触发自动更新
import { authDatasetCollection } from '@fastgpt/service/support/permission/dataset/auth';
import { NextAPI } from '@/service/middleware/entry';
import { WritePermissionVal } from '@fastgpt/global/support/permission/constant';
import { CommonErrEnum } from '@fastgpt/global/common/error/code/common';
import { type ApiRequestProps } from '@fastgpt/service/type/next';
import { triggerAutoUpdate } from '@fastgpt/service/core/dataset/autoUpdate';
import { MongoDatasetCollection } from '@fastgpt/service/core/dataset/collection/schema';
import { downloadHkGovApiData, checkApiDataUpdated } from '@fastgpt/service/core/dataset/autoUpdate/hkGovApiConverter';
import { pushDataListToTrainingQueue } from '@fastgpt/service/core/dataset/training/controller';
import { MongoDataset } from '@fastgpt/service/core/dataset/schema';

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

  // 鲁港通 - 获取集合配置
  const collection = await MongoDatasetCollection.findById(collectionId);
  if (!collection) {
    return Promise.reject(CommonErrEnum.unExist);
  }

  const config = collection.autoUpdateConfig;
  
  // 鲁港通 - 如果没有配置，返回错误
  if (!config) {
    return { success: false, message: '请先配置自动更新' };
  }

  // 鲁港通 - 检查是否是香港政府 API
  const isHkGovApi =
    config.datasetUrl?.includes('portal.csdi.gov.hk') ||
    config.datasetUrl?.includes('data.gov.hk') ||
    config.api?.endpoint?.includes('api.data.gov.hk');

  if (isHkGovApi && config.api?.endpoint) {
    // 鲁港通 - 处理香港政府 API 更新
    try {
      // 1. 检查数据是否更新
      const oldCacheKey = config.api.cacheKey || '';
      
      // 鲁港通 - 如果是首次导入（没有缓存键），直接下载数据
      const isFirstImport = !oldCacheKey;
      
      let shouldUpdate = isFirstImport;
      let newCacheKey = oldCacheKey;
      
      if (!isFirstImport) {
        const checkResult = await checkApiDataUpdated(config.api.endpoint, oldCacheKey);
        shouldUpdate = checkResult.updated;
        newCacheKey = checkResult.newCacheKey;
      }

      if (!shouldUpdate && !isFirstImport) {
        return {
          success: true,
          message: '数据未更新，无需导入',
          updated: false
        };
      }

      // 2. 下载 API 数据
      const downloadResult = await downloadHkGovApiData(
        config.api.endpoint,
        config.api.format || 'json'
      );

      if (!downloadResult.success) {
        throw new Error(downloadResult.error || '下载失败');
      }

      // 鲁港通 - 如果是首次导入，生成缓存键
      if (isFirstImport) {
        const crypto = require('crypto');
        newCacheKey = crypto
          .createHash('md5')
          .update(downloadResult.data || '')
          .digest('hex');
      }

      // 3. 导入到知识库
      const dataset = await MongoDataset.findById(collection.datasetId);
      if (!dataset) {
        return Promise.reject(CommonErrEnum.unExist);
      }

      await pushDataListToTrainingQueue({
        teamId: collection.teamId,
        tmbId: collection.tmbId,
        datasetId: collection.datasetId,
        collectionId: collection._id,
        agentModel: dataset.agentModel,
        vectorModel: dataset.vectorModel,
        vlmModel: dataset.vlmModel,
        mode: collection.trainingType,
        billId: undefined,
        data: [
          {
            q: downloadResult.data || '',
            a: '',
            chunkIndex: 0
          }
        ]
      });

      // 4. 更新缓存键和历史记录
      await MongoDatasetCollection.updateOne(
        { _id: collectionId },
        {
          $set: {
            'autoUpdateConfig.api.cacheKey': newCacheKey,
            'autoUpdateConfig.lastUpdateTime': new Date(),
            'autoUpdateConfig.lastCheckTime': new Date()
          },
          $push: {
            'autoUpdateConfig.history': {
              timestamp: new Date(),
              status: 'success',
              message: isFirstImport ? '首次导入香港政府 API 数据' : '香港政府 API 数据已更新',
              fileUrl: config.api.endpoint,
              fileName: 'API Data',
              fileSize: Buffer.byteLength(downloadResult.data || '', 'utf-8')
            }
          }
        }
      );

      return {
        success: true,
        message: isFirstImport ? '香港政府 API 数据首次导入成功' : '香港政府 API 数据已成功更新',
        updated: true
      };
    } catch (error: any) {
      // 记录失败历史
      await MongoDatasetCollection.updateOne(
        { _id: collectionId },
        {
          $set: { 'autoUpdateConfig.lastCheckTime': new Date() },
          $push: {
            'autoUpdateConfig.history': {
              timestamp: new Date(),
              status: 'failed',
              message: error.message
            }
          }
        }
      );

      return {
        success: false,
        message: `更新失败: ${error.message}`
      };
    }
  } else {
    // 鲁港通 - 使用原有的文件更新逻辑
    await triggerAutoUpdate(collectionId);
    return { success: true, message: '更新任务已触发' };
  }
}

export default NextAPI(handler);
