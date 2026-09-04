import type { TrainingModeEnum } from '@fastgpt/global/core/dataset/constants';
import type { ChunkSettingModeEnum } from '@fastgpt/global/core/dataset/constants';
import type { UseFormReturn } from 'react-hook-form';
import type { APIFileItemType } from '@fastgpt/global/core/dataset/apiDataset/type';

export type ImportSourceItemType = {
  id: string;

  createStatus: 'waiting' | 'creating' | 'finish';
  metadata?: Record<string, any>;
  errorMsg?: string;

  // source
  sourceName: string;
  icon: string;

  // file
  sourceSize?: string;
  isUploading?: boolean;
  uploadedFileRate?: number;
  dbFileId?: string; // 存储在数据库里的文件Id

  file?: File; // Local file

  // link
  link?: string;

  // custom text
  rawText?: string;

  // external file
  externalFileUrl?: string;
  externalFileId?: string;

  // api dataset
  apiFileId?: string;
  apiFile?: APIFileItemType;
};

export type ImportSourceParamsType = UseFormReturn<
  {
    chunkSize: number;
    chunkOverlapRatio: number;
    chunkSplitter: string;
    prompt: string;
    mode: TrainingModeEnum;
    way: ChunkSettingModeEnum;
  },
  any
>;

// 鲁港通 - 知识库自动更新前端类型
// 字段与 packages/global/core/dataset/type.ts 的 DatasetAutoUpdateConfigSchema 及后端 autoUpdate API 响应保持一致

/** 鲁港通 - 自动更新配置（表单状态；source/datasetUrl/fileFormat/detection 在加载后必有值） */
export type AutoUpdateConfigType = {
  enabled: boolean;
  source: 'hk-gov-data' | 'custom';
  datasetUrl: string;
  fileFormat: 'csv' | 'xlsx' | 'xml' | 'json' | 'api';
  api?: {
    endpoint: string;
    method?: string;
    headers?: Record<string, string>;
    cacheKey?: string;
  };
  detection: {
    yearPattern?: string[];
    checkUpdateTime: boolean;
    detailPageCheck: boolean;
  };
  notification?: {
    enabled: boolean;
    email?: string;
  };
  // 运行时状态（后端维护，前端只读展示）
  resolvedResourceId?: string;
  resolvedResourceUrl?: string;
  lastMetadataModified?: string;
  lastCheckTime?: Date;
  lastUpdateTime?: Date;
  history?: AutoUpdateHistoryType[];
};

/** 鲁港通 - 单条自动更新历史 */
export type AutoUpdateHistoryType = {
  timestamp: Date;
  status: 'success' | 'failed';
  message?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
};

/** 鲁港通 - history 接口响应（对齐 api/core/dataset/collection/autoUpdate/history.ts） */
export type AutoUpdateHistoryResponseType = {
  enabled: boolean;
  source?: 'hk-gov-data' | 'custom';
  datasetUrl?: string;
  fileFormat?: string;
  lastCheckTime?: Date;
  lastUpdateTime?: Date;
  lastMetadataModified?: string;
  history: AutoUpdateHistoryType[];
};

/** 鲁港通 - detect 接口响应（对齐 api/core/dataset/collection/autoUpdate/detect.ts） */
export type DetectResultType = {
  success: boolean;
  type?: 'file' | 'api';
  message?: string;
  files?: Array<{
    fileName: string;
    format: string;
    fileUrl: string;
    fileSize?: string;
    updateTime?: string;
    detailPageUrl?: string;
  }>;
  apiInfo?: {
    endpoint: string;
    cacheKey: string;
    datasetId?: string;
    resourceId?: string;
    format?: string;
    metadataModified?: string;
    metadata?: {
      title?: string;
      description?: string;
      updateFrequency?: string;
      lastModified?: string;
      resourceName?: string;
    };
  };
};
