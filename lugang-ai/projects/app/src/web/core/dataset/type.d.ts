import type { PushDatasetDataChunkProps } from '@fastgpt/global/core/dataset/api';
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

// 鲁港通 - 自动更新配置类型
export type AutoUpdateConfigType = {
  enabled: boolean;
  source: 'hk-gov-data' | 'custom';
  datasetUrl: string;
  fileFormat: 'csv' | 'xlsx' | 'xml' | 'api';
  api?: {
    endpoint: string;
    method: string;
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
};

// 鲁港通 - 自动更新历史记录类型
export type AutoUpdateHistoryType = {
  timestamp: Date;
  status: 'success' | 'failed';
  message: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
};

// 鲁港通 - 自动更新历史响应类型
export type AutoUpdateHistoryResponseType = {
  enabled: boolean;
  lastCheckTime?: Date;
  lastUpdateTime?: Date;
  history: AutoUpdateHistoryType[];
};

// 鲁港通 - 数据集识别结果类型
export type DetectResultType = {
  success: boolean;
  message?: string;
  files: Array<{
    fileName: string;
    format: string;
    fileUrl: string;
  }>;
};
