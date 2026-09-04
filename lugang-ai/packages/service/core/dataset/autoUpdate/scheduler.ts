/**
 * 鲁港通 - 自动更新调度模块（D8 修复版）
 *
 * 修复依据（诊断 + 实证 .qoder/d8-verify-harness.mjs，真实 live data.gov.hk）：
 *  1. 数据源：CKAN 源改走 `package_show` 枚举全部资源，不再用 cheerio 抓 HTML <a>
 *     （CKAN 页面分页/JS 渲染，旧版抓不全 → 「无法正确提取 API 信息」的根因之一）。
 *  2. 更新检测：改用包级 `metadata_modified`（资源级 last_modified 实测全 null，
 *     旧版 HEAD/Last-Modified 恒判「无法判断」→ 永不更新）；API 源用内容 MD5 哈希。
 *  3. 入库：先清旧数据再导入（clean-old-first，避免重复/陈旧堆积），并用官方
 *     `rawText2Chunks` 按 chunkSize=512 分块（旧版整文件塞单巨块 chunkIndex:0，违反 ≤512 分块规范）。
 *  4. `pushDataListToTrainingQueue` 的 `billId` 必填（旧版传 undefined）；`mode` 用默认 chunk
 *     （旧版把 DatasetCollectionDataProcessModeEnum 误传给 TrainingModeEnum，两者是不同枚举）。
 *  5. console.* → getLogger；不用 node-cron，导出 runAutoUpdateTask/triggerAutoUpdate/processCollection
 *     供官方 cron.ts（setCron + checkTimerLock 分布式锁）调用。
 */
import { TrainingModeEnum } from '@fastgpt/global/core/dataset/constants';
import type { DatasetCollectionSchemaType } from '@fastgpt/global/core/dataset/type';
import { MongoDatasetCollection } from '../collection/schema';
import { MongoDataset } from '../schema';
import { MongoDatasetData } from '../data/schema';
import { MongoDatasetTraining } from '../training/schema';
import { getFullTextStore } from '../data/textStore';
import { deleteDatasetDataVector } from '../../../common/vectorDB/controller';
import { pushDataListToTrainingQueue } from '../training/controller';
import { rawText2Chunks } from '../read';
import { getLogger, LogCategories } from '../../../common/logger';
import {
  isHkGovDatasetUrl,
  fetchHkGovDataset,
  pickDataResource,
  checkApiDataUpdated
} from './hkGovApiConverter';
import { detectByMetadataModified, detectNewFile, detectByDetailPage } from './detector';
import { scrapeDatasetPage, scrapeDetailPage, type ScrapedFileInfo } from './scraper';
import { downloadAndParseFile, downloadApiData } from './downloader';

const logger = getLogger(LogCategories.MODULE.DATASET.AUTO_UPDATE);

type AutoUpdateCollection = DatasetCollectionSchemaType;
type AutoUpdateConfig = NonNullable<DatasetCollectionSchemaType['autoUpdateConfig']>;
type HistoryEntry = NonNullable<AutoUpdateConfig['history']>[number];

/** 自动更新处理结果（供手动触发路由反馈；cron 批量执行时忽略） */
export interface AutoUpdateResult {
  success: boolean; // 是否无异常完成
  updated: boolean; // 是否实际重新入库
  message: string;
}

// 鲁港通 - 并发上限：每批最多处理 3 个集合，避免同时打爆外部 API
const CONCURRENCY = 3;

/**
 * 执行自动更新任务（供官方 cron.ts 的 setCron 回调调用，不直接用 node-cron）。
 * 遍历所有启用自动更新的集合，分批并发处理。
 */
export async function runAutoUpdateTask(): Promise<void> {
  try {
    const collections = await MongoDatasetCollection.find(
      { 'autoUpdateConfig.enabled': true },
      { _id: 1, name: 1 }
    ).lean();

    logger.info(`鲁港通 - 自动更新：找到 ${collections.length} 个启用集合`);

    for (let i = 0; i < collections.length; i += CONCURRENCY) {
      const batch = collections.slice(i, i + CONCURRENCY);
      await Promise.allSettled(batch.map((item) => processCollection(String(item._id))));
    }

    logger.info('鲁港通 - 自动更新任务执行完成');
  } catch (error) {
    logger.error('鲁港通 - 自动更新任务执行失败', { error });
  }
}

/** 手动触发单个集合的自动更新（供 API 路由调用），返回执行结果 */
export async function triggerAutoUpdate(collectionId: string): Promise<AutoUpdateResult> {
  logger.info(`鲁港通 - 手动触发自动更新: ${collectionId}`);
  return processCollection(collectionId);
}

/** 处理单个集合：更新检查时间后按数据源类型分流 */
export async function processCollection(collectionId: string): Promise<AutoUpdateResult> {
  const collection = (await MongoDatasetCollection.findById(collectionId).lean()) as
    | AutoUpdateCollection
    | null;
  if (!collection || !collection.autoUpdateConfig?.enabled) {
    return { success: false, updated: false, message: '集合不存在或未启用自动更新' };
  }

  const config = collection.autoUpdateConfig;
  try {
    await MongoDatasetCollection.updateOne(
      { _id: collectionId },
      { $set: { 'autoUpdateConfig.lastCheckTime': new Date() } }
    );

    if (config.fileFormat === 'api') {
      return await processApiUpdate(collection);
    }
    if (
      config.source === 'hk-gov-data' ||
      (config.datasetUrl && isHkGovDatasetUrl(config.datasetUrl))
    ) {
      return await processCkanUpdate(collection);
    }
    return await processFileUpdate(collection);
  } catch (error) {
    const message = (error as Error).message;
    logger.error(`鲁港通 - 处理集合失败: ${collection.name}`, { collectionId, error });
    await recordHistory(collectionId, {
      timestamp: new Date(),
      status: 'failed',
      message
    });
    return { success: false, updated: false, message };
  }
}

/**
 * 处理 CKAN 政府数据源（data.gov.hk / csdi.gov.hk）。
 * package_show 枚举资源 → 包级 metadata_modified 检测 → 选资源下载解析 → 清旧入库。
 */
async function processCkanUpdate(collection: AutoUpdateCollection): Promise<AutoUpdateResult> {
  const config = collection.autoUpdateConfig as AutoUpdateConfig;
  const datasetUrl = config.datasetUrl;
  if (!datasetUrl) throw new Error('缺少数据集 URL');

  const dataset = await fetchHkGovDataset(datasetUrl);
  if (!dataset) throw new Error('无法从 CKAN 获取数据集信息');

  // 一级检测：包级 metadata_modified（可靠更新信号）
  const detection = detectByMetadataModified(dataset.metadataModified, config.lastMetadataModified);
  if (!detection.isNewFile) {
    logger.info(`鲁港通 - ${collection.name}: ${detection.reason}`);
    return { success: true, updated: false, message: detection.reason };
  }

  // 选数据资源（跳过图片，按格式优先级）
  const resource = pickDataResource(dataset.resources, config.fileFormat);
  if (!resource) throw new Error('数据集无可用数据资源（可能全是图片）');

  const fileInfo: ScrapedFileInfo = {
    fileName: resource.name || resource.url,
    fileUrl: resource.url
  };
  const downloadResult = await downloadAndParseFile(
    fileInfo,
    resource.format || config.fileFormat || 'csv'
  );
  if (!downloadResult.success || !downloadResult.rawText) {
    throw new Error(downloadResult.error || '文件解析失败');
  }

  await cleanAndImport(collection, downloadResult.rawText, downloadResult.formatText);

  await MongoDatasetCollection.updateOne(
    { _id: collection._id },
    {
      $set: {
        'autoUpdateConfig.lastUpdateTime': new Date(),
        'autoUpdateConfig.lastMetadataModified': dataset.metadataModified,
        'autoUpdateConfig.resolvedResourceId': resource.id,
        'autoUpdateConfig.resolvedResourceUrl': resource.url
      },
      $push: {
        'autoUpdateConfig.history': {
          timestamp: new Date(),
          status: 'success',
          message: detection.reason,
          fileUrl: resource.url,
          fileName: fileInfo.fileName,
          fileSize: downloadResult.fileSize
        }
      }
    }
  );

  logger.info(`鲁港通 - ${collection.name}: CKAN 更新成功`);
  return { success: true, updated: true, message: 'CKAN 数据已更新并重新入库' };
}

/**
 * 处理 API 数据源。
 * 修复：用内容 MD5 哈希检测（旧版 HEAD/Last-Modified 对 data.gov.hk 恒 null → 永不更新）。
 */
async function processApiUpdate(collection: AutoUpdateCollection): Promise<AutoUpdateResult> {
  const config = collection.autoUpdateConfig as AutoUpdateConfig;
  const endpoint = config.api?.endpoint;
  if (!endpoint) throw new Error('缺少 API 端点');

  const check = await checkApiDataUpdated(endpoint, config.api?.cacheKey || '', config.api?.headers);
  if (check.error) throw new Error(check.error);
  if (!check.updated) {
    logger.info(`鲁港通 - ${collection.name}: API 内容未变化`);
    return { success: true, updated: false, message: 'API 内容未变化，无需更新' };
  }

  const downloadResult = await downloadApiData(
    endpoint,
    config.api?.method || 'GET',
    config.api?.headers
  );
  if (!downloadResult.success || !downloadResult.rawText) {
    throw new Error(downloadResult.error || 'API 数据下载失败');
  }

  await cleanAndImport(collection, downloadResult.rawText, downloadResult.formatText);

  await MongoDatasetCollection.updateOne(
    { _id: collection._id },
    {
      $set: {
        'autoUpdateConfig.lastUpdateTime': new Date(),
        'autoUpdateConfig.api.cacheKey': check.newCacheKey
      },
      $push: {
        'autoUpdateConfig.history': {
          timestamp: new Date(),
          status: 'success',
          message: 'API 内容哈希变化',
          fileUrl: endpoint,
          fileName: 'API Data',
          fileSize: downloadResult.fileSize
        }
      }
    }
  );

  logger.info(`鲁港通 - ${collection.name}: API 缓存更新成功`);
  return { success: true, updated: true, message: 'API 数据已更新并重新入库' };
}

/**
 * 处理自定义静态页数据源（非 CKAN 兜底）。
 * scrapeDatasetPage 抓文件链接 → detectNewFile/详情页检测 → 下载解析 → 清旧入库。
 */
async function processFileUpdate(collection: AutoUpdateCollection): Promise<AutoUpdateResult> {
  const config = collection.autoUpdateConfig as AutoUpdateConfig;
  const datasetUrl = config.datasetUrl;
  if (!datasetUrl) throw new Error('缺少数据集 URL');

  const scrapeResult = await scrapeDatasetPage(datasetUrl, config.fileFormat || 'csv');
  if (scrapeResult.error || scrapeResult.files.length === 0) {
    throw new Error(scrapeResult.error || '未找到任何文件');
  }

  const detectionConfig = {
    yearPattern: config.detection?.yearPattern,
    checkUpdateTime: config.detection?.checkUpdateTime ?? true,
    detailPageCheck: config.detection?.detailPageCheck ?? false
  };

  let detection = detectNewFile(scrapeResult.files, detectionConfig, config.lastUpdateTime);

  // 二级检测：详情页更新时间
  if (!detection.isNewFile && detectionConfig.detailPageCheck) {
    const detailPageUrl = detection.matchedFile?.detailPageUrl;
    if (detailPageUrl) {
      const detailUpdateTime = await scrapeDetailPage(detailPageUrl);
      if (detailUpdateTime) {
        const detailResult = detectByDetailPage(detailUpdateTime, config.lastUpdateTime);
        if (detailResult.isNewFile) {
          detection = { ...detection, isNewFile: true, reason: detailResult.reason };
        }
      }
    }
  }

  if (!detection.isNewFile) {
    logger.info(`鲁港通 - ${collection.name}: ${detection.reason}`);
    return { success: true, updated: false, message: detection.reason };
  }

  const fileInfo = detection.matchedFile;
  if (!fileInfo) throw new Error('未匹配到目标文件');

  const downloadResult = await downloadAndParseFile(fileInfo, config.fileFormat || 'csv');
  if (!downloadResult.success || !downloadResult.rawText) {
    throw new Error(downloadResult.error || '文件解析失败');
  }

  await cleanAndImport(collection, downloadResult.rawText, downloadResult.formatText);

  await MongoDatasetCollection.updateOne(
    { _id: collection._id },
    {
      $set: { 'autoUpdateConfig.lastUpdateTime': new Date() },
      $push: {
        'autoUpdateConfig.history': {
          timestamp: new Date(),
          status: 'success',
          message: detection.reason,
          fileUrl: fileInfo.fileUrl,
          fileName: fileInfo.fileName,
          fileSize: downloadResult.fileSize
        }
      }
    }
  );

  logger.info(`鲁港通 - ${collection.name}: 文件更新成功`);
  return { success: true, updated: true, message: '文件已更新并重新入库' };
}

/**
 * 清旧数据后重新入库（clean-old-first）。
 * ① 删除该集合的向量 + 全文 + dataset_data + 残留 training（保留 collection 记录）；
 * ② 用官方 rawText2Chunks 按 chunkSize=512 分块（符合 RAG ≤512 token 规范）；
 * ③ 经训练队列重新入库，billId 必填传 ''，mode 用默认 chunk。
 */
async function cleanAndImport(
  collection: AutoUpdateCollection,
  rawText: string,
  formatText?: string
): Promise<void> {
  const teamId = collection.teamId;
  const datasetId = String(collection.datasetId);
  const collectionId = String(collection._id);

  const dataset = await MongoDataset.findById(datasetId).lean();
  if (!dataset) throw new Error('数据集不存在');

  // 1. 清旧数据（与官方 delCollectionAndRelatedData 一致的删除原语，但不删 collection 记录）
  await Promise.all([
    MongoDatasetTraining.deleteMany({ teamId, datasetId, collectionId }),
    getFullTextStore().deleteByCollectionIds(
      { teamId, datasetIds: [datasetId], collectionIds: [collectionId] },
      undefined
    ),
    MongoDatasetData.deleteMany({ teamId, datasetId, collectionId }),
    deleteDatasetDataVector({ teamId, datasetIds: [datasetId], collectionIds: [collectionId] })
  ]);

  // 2. 官方分块（chunkSize=512，符合 RAG 规范；小文件按触发阈值不拆分）
  const text = formatText || rawText;
  const chunks = await rawText2Chunks({ rawText: text, chunkSize: 512 });
  if (chunks.length === 0) throw new Error('分块结果为空，导入中止');

  // 3. 入训练队列（mode 默认 TrainingModeEnum.chunk；billId 必填，自动更新无账单传 ''）
  await pushDataListToTrainingQueue({
    teamId,
    tmbId: collection.tmbId,
    datasetId,
    collectionId,
    agentModel: dataset.agentModel,
    vectorModel: dataset.vectorModel,
    vlmModel: dataset.vlmModel,
    mode: TrainingModeEnum.chunk,
    billId: '',
    data: chunks.map((chunk, index) => ({
      q: chunk.q,
      a: chunk.a || '',
      chunkIndex: index
    }))
  });
}

/** 追加一条自动更新历史记录 */
async function recordHistory(collectionId: string, entry: HistoryEntry): Promise<void> {
  await MongoDatasetCollection.updateOne(
    { _id: collectionId },
    { $push: { 'autoUpdateConfig.history': entry } }
  );
}
