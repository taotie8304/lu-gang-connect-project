import { GET, POST } from '@/web/common/api/request';
import type {
  AutoUpdateConfigType,
  AutoUpdateHistoryResponseType,
  DetectResultType
} from '../type';

// 鲁港通 - 知识库自动更新 API 客户端

/**
 * 鲁港通 - 获取集合的自动更新配置
 * @param collectionId 集合 ID
 */
export const getAutoUpdateConfig = (collectionId: string) =>
  GET<AutoUpdateConfigType>(`/core/dataset/collection/autoUpdate/config`, { collectionId });

/**
 * 鲁港通 - 保存集合的自动更新配置（后端以现有配置为基线合并，保留 history 与运行时状态）
 */
export const updateAutoUpdateConfig = (data: { collectionId: string } & AutoUpdateConfigType) =>
  POST(`/core/dataset/collection/autoUpdate/config`, data);

/**
 * 鲁港通 - 手动触发一次自动更新
 * @returns updated 表示本次是否真正检测到更新并重新入库
 */
export const triggerAutoUpdate = (collectionId: string) =>
  POST<{ success: boolean; updated: boolean; message: string }>(
    `/core/dataset/collection/autoUpdate/trigger`,
    { collectionId }
  );

/**
 * 鲁港通 - 识别数据集（CKAN package_show 优先，静态页文件爬取兜底）
 */
export const detectDataset = (data: { collectionId: string; datasetUrl: string }) =>
  POST<DetectResultType>(`/core/dataset/collection/autoUpdate/detect`, data);

/**
 * 鲁港通 - 获取自动更新历史（最近 50 条，倒序）
 */
export const getAutoUpdateHistory = (collectionId: string) =>
  GET<AutoUpdateHistoryResponseType>(`/core/dataset/collection/autoUpdate/history`, {
    collectionId
  });
