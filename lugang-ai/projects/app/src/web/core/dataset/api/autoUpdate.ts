import { GET, POST } from '@/web/common/api/request';
import type {
  AutoUpdateConfigType,
  AutoUpdateHistoryResponseType,
  DetectResultType
} from '../type';

// 鲁港通 - 自动更新 API 客户端

/**
 * 获取自动更新配置
 */
export const getAutoUpdateConfig = (collectionId: string) =>
  GET<AutoUpdateConfigType>(`/core/dataset/collection/autoUpdate/config`, { collectionId });

/**
 * 更新自动更新配置
 */
export const updateAutoUpdateConfig = (data: { collectionId: string } & AutoUpdateConfigType) =>
  POST(`/core/dataset/collection/autoUpdate/config`, data);

/**
 * 手动触发更新
 */
export const triggerAutoUpdate = (collectionId: string) =>
  POST<{ success: boolean; message: string }>(`/core/dataset/collection/autoUpdate/trigger`, {
    collectionId
  });

/**
 * 识别数据集
 */
export const detectDataset = (data: { collectionId: string; datasetUrl: string }) =>
  POST<DetectResultType>(`/core/dataset/collection/autoUpdate/detect`, data);

/**
 * 获取更新历史
 */
export const getAutoUpdateHistory = (collectionId: string) =>
  GET<AutoUpdateHistoryResponseType>(`/core/dataset/collection/autoUpdate/history`, {
    collectionId
  });
