// 鲁港通 - 自动更新定时任务模块
import cron from 'node-cron';
import { MongoDatasetCollection } from '../collection/schema';
import { scrapeDatasetPage, scrapeDetailPage } from './scraper';
import { detectNewFile, detectByDetailPage, checkApiUpdate } from './detector';
import { downloadAndParseFile, downloadApiData } from './downloader';
import { pushDataListToTrainingQueue } from '../training/controller';
import { Types } from '../../../common/mongo';

// 定时任务实例
let scheduledTask: cron.ScheduledTask | null = null;

/**
 * 启动自动更新定时任务
 * 每月1号凌晨2点执行
 */
export function startAutoUpdateScheduler() {
  if (scheduledTask) {
    console.log('鲁港通 - 自动更新定时任务已在运行');
    return;
  }

  // 每月1号凌晨2点执行
  scheduledTask = cron.schedule('0 2 1 * *', async () => {
    console.log('鲁港通 - 开始执行自动更新任务');
    await runAutoUpdateTask();
  });

  console.log('鲁港通 - 自动更新定时任务已启动 (每月1号凌晨2点)');
}

/**
 * 停止自动更新定时任务
 */
export function stopAutoUpdateScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('鲁港通 - 自动更新定时任务已停止');
  }
}

/**
 * 手动触发自动更新任务
 */
export async function triggerAutoUpdate(collectionId: string) {
  console.log(`鲁港通 - 手动触发自动更新: ${collectionId}`);
  await processCollection(collectionId);
}

/**
 * 执行自动更新任务
 * 遍历所有启用自动更新的知识库集合
 */
async function runAutoUpdateTask() {
  try {
    // 鲁港通 - 性能优化：只查询必要的字段
    const collections = await MongoDatasetCollection.find(
      { 'autoUpdateConfig.enabled': true },
      { _id: 1, name: 1 }
    ).lean();

    console.log(`鲁港通 - 找到 ${collections.length} 个需要检查更新的集合`);

    // 鲁港通 - 性能优化：使用并发控制，每次最多处理 3 个集合
    const concurrency = 3;
    for (let i = 0; i < collections.length; i += concurrency) {
      const batch = collections.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map((collection) => processCollection(collection._id.toString()))
      );
    }

    console.log('鲁港通 - 自动更新任务执行完成');
  } catch (error) {
    console.error('鲁港通 - 自动更新任务执行失败:', error);
  }
}

/**
 * 处理单个集合的自动更新
 */
async function processCollection(collectionId: string) {
  try {
    // 鲁港通 - 性能优化：使用 lean() 减少内存占用
    const collection = await MongoDatasetCollection.findById(collectionId).lean();
    if (!collection || !collection.autoUpdateConfig?.enabled) {
      return;
    }

    const config = collection.autoUpdateConfig;
    const now = new Date();

    console.log(`鲁港通 - 检查集合更新: ${collection.name}`);

    // 鲁港通 - 性能优化：使用 updateOne 代替 findByIdAndUpdate
    await MongoDatasetCollection.updateOne(
      { _id: collectionId },
      { $set: { 'autoUpdateConfig.lastCheckTime': now } }
    );

    // 根据文件格式处理
    if (config.fileFormat === 'api') {
      await processApiUpdate(collection);
    } else {
      await processFileUpdate(collection);
    }
  } catch (error: any) {
    console.error(`鲁港通 - 处理集合 ${collectionId} 失败:`, error);

    // 鲁港通 - 性能优化：使用 updateOne 记录失败历史
    await MongoDatasetCollection.updateOne(
      { _id: collectionId },
      {
        $push: {
          'autoUpdateConfig.history': {
            timestamp: new Date(),
            status: 'failed',
            message: error.message
          }
        }
      }
    );
  }
}

/**
 * 处理文件类型的更新 (CSV, XLSX, XML)
 */
async function processFileUpdate(collection: any) {
  const config = collection.autoUpdateConfig;

  // 1. 爬取数据集页面
  const scrapeResult = await scrapeDatasetPage(config.datasetUrl, config.fileFormat);

  if (scrapeResult.error || scrapeResult.files.length === 0) {
    throw new Error(scrapeResult.error || '未找到任何文件');
  }

  // 2. 检测是否有新文件
  const detectionResult = detectNewFile(
    scrapeResult.files,
    config.detection,
    config.lastUpdateTime
  );

  // 3. 如果需要详情页检查
  if (!detectionResult.isNewFile && config.detection.detailPageCheck) {
    const detailPageUrl = detectionResult.matchedFile?.detailPageUrl;
    if (detailPageUrl) {
      const detailUpdateTime = await scrapeDetailPage(detailPageUrl);
      if (detailUpdateTime) {
        const detailResult = detectByDetailPage(detailUpdateTime, config.lastUpdateTime);
        if (detailResult.isNewFile) {
          detectionResult.isNewFile = true;
          detectionResult.reason = detailResult.reason;
        }
      }
    }
  }

  // 4. 如果没有新文件，跳过
  if (!detectionResult.isNewFile) {
    console.log(`鲁港通 - ${collection.name}: ${detectionResult.reason}`);
    return;
  }

  // 5. 下载并解析文件
  const fileInfo = detectionResult.matchedFile!;
  const downloadResult = await downloadAndParseFile(fileInfo, config.fileFormat);

  if (!downloadResult.success) {
    throw new Error(downloadResult.error);
  }

  // 6. 导入到知识库
  await importToDataset(collection, downloadResult.rawText!, downloadResult.formatText!);

  // 7. 记录成功历史
  // 鲁港通 - 性能优化：使用 updateOne 批量更新
  await MongoDatasetCollection.updateOne(
    { _id: collection._id },
    {
      $set: { 'autoUpdateConfig.lastUpdateTime': new Date() },
      $push: {
        'autoUpdateConfig.history': {
          timestamp: new Date(),
          status: 'success',
          message: detectionResult.reason,
          fileUrl: fileInfo.fileUrl,
          fileName: fileInfo.fileName,
          fileSize: downloadResult.fileSize
        }
      }
    }
  );

  console.log(`鲁港通 - ${collection.name}: 更新成功`);
}

/**
 * 处理 API 类型的更新
 */
async function processApiUpdate(collection: any) {
  const config = collection.autoUpdateConfig;

  // 1. 检查 API 是否有更新
  const checkResult = await checkApiUpdate(config.api.endpoint, config.lastUpdateTime);

  if (!checkResult.isNewFile) {
    console.log(`鲁港通 - ${collection.name}: ${checkResult.reason}`);
    return;
  }

  // 2. 下载 API 数据
  const downloadResult = await downloadApiData(
    config.api.endpoint,
    config.api.method,
    config.api.headers
  );

  if (!downloadResult.success) {
    throw new Error(downloadResult.error);
  }

  // 3. 导入到知识库
  await importToDataset(collection, downloadResult.rawText!, downloadResult.formatText!);

  // 4. 记录成功历史
  // 鲁港通 - 性能优化：使用 updateOne 批量更新
  await MongoDatasetCollection.updateOne(
    { _id: collection._id },
    {
      $set: { 'autoUpdateConfig.lastUpdateTime': new Date() },
      $push: {
        'autoUpdateConfig.history': {
          timestamp: new Date(),
          status: 'success',
          message: checkResult.reason,
          fileUrl: config.api.endpoint,
          fileName: 'API Data',
          fileSize: downloadResult.fileSize
        }
      }
    }
  );

  console.log(`鲁港通 - ${collection.name}: API 缓存更新成功`);
}

/**
 * 导入数据到知识库
 */
async function importToDataset(collection: any, rawText: string, formatText: string) {
  // 鲁港通 - 使用现有的训练队列功能导入数据
  // 需要获取数据集信息来获取模型配置
  const { MongoDataset } = await import('../schema');
  const dataset = await MongoDataset.findById(collection.datasetId);
  
  if (!dataset) {
    throw new Error('数据集不存在');
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
        q: formatText || rawText,
        a: '',
        chunkIndex: 0
      }
    ]
  });
}
