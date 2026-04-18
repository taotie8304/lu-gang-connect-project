import { connectionMongo, getMongoModel } from '../../../common/mongo';
const { Schema } = connectionMongo;
import { type DatasetCollectionSchemaType } from '@fastgpt/global/core/dataset/type.d';
import { DatasetCollectionTypeMap } from '@fastgpt/global/core/dataset/constants';
import { ChunkSettings, DatasetCollectionName } from '../schema';
import {
  TeamCollectionName,
  TeamMemberCollectionName
} from '@fastgpt/global/support/user/team/constant';

export const DatasetColCollectionName = 'dataset_collections';

const DatasetCollectionSchema = new Schema({
  parentId: {
    type: Schema.Types.ObjectId,
    ref: DatasetColCollectionName,
    default: null
  },
  teamId: {
    type: Schema.Types.ObjectId,
    ref: TeamCollectionName,
    required: true
  },
  tmbId: {
    type: Schema.Types.ObjectId,
    ref: TeamMemberCollectionName,
    required: true
  },
  datasetId: {
    type: Schema.Types.ObjectId,
    ref: DatasetCollectionName,
    required: true
  },

  // Basic info
  type: {
    type: String,
    enum: Object.keys(DatasetCollectionTypeMap),
    required: true
  },
  name: {
    type: String,
    required: true
  },
  tags: {
    type: [String],
    default: []
  },

  createTime: {
    type: Date,
    default: () => new Date()
  },
  updateTime: {
    type: Date,
    default: () => new Date()
  },

  // Metadata
  // local file collection
  // Support both GridFS ObjectId (string) and S3 key (string)
  fileId: String,
  // web link collection
  rawLink: String,
  // Api collection
  apiFileId: String,
  // external collection(Abandoned)
  externalFileId: String,
  externalFileUrl: String, // external import url

  rawTextLength: Number,
  hashRawText: String,

  metadata: {
    type: Object,
    default: {}
  },

  forbid: Boolean,

  // 鲁港通 - 自动更新配置
  autoUpdateConfig: {
    type: {
      enabled: Boolean, // 是否启用自动更新
      source: {
        type: String,
        enum: ['hk-gov-data', 'custom'] // 数据源类型
      },
      datasetUrl: String, // 香港政府数据集页面 URL
      fileFormat: {
        type: String,
        enum: ['csv', 'xlsx', 'xml', 'api'] // 支持的文件格式
      },
      // API 配置（当 fileFormat 为 'api' 时使用）
      api: {
        endpoint: String, // API 端点
        method: String, // HTTP 方法
        headers: Object, // 请求头
        cacheKey: String // 缓存键
      },
      // 检测配置
      detection: {
        yearPattern: [String], // 年份匹配模式，如 ['2025/26', '2025-2026']
        checkUpdateTime: Boolean, // 是否检查更新时间
        detailPageCheck: Boolean // 是否需要进入详情页检查
      },
      // 导入历史
      history: [
        {
          timestamp: Date,
          status: String, // 'success' | 'failed'
          message: String,
          fileUrl: String,
          fileName: String,
          fileSize: Number
        }
      ],
      lastCheckTime: Date, // 最后检查时间
      lastUpdateTime: Date, // 最后更新时间
      // 通知设置
      notification: {
        enabled: Boolean,
        email: String
      }
    },
    default: null
  },

  // Parse settings
  customPdfParse: Boolean,
  apiFileParentId: String,

  // Chunk settings
  ...ChunkSettings
});

DatasetCollectionSchema.virtual('dataset', {
  ref: DatasetCollectionName,
  localField: 'datasetId',
  foreignField: '_id',
  justOne: true
});

try {
  // auth file
  DatasetCollectionSchema.index({ teamId: 1, fileId: 1 });

  // list collection; deep find collections
  DatasetCollectionSchema.index({
    teamId: 1,
    datasetId: 1,
    parentId: 1,
    updateTime: -1
  });

  // Tag filter
  DatasetCollectionSchema.index({ teamId: 1, datasetId: 1, tags: 1 });
  // create time filter
  DatasetCollectionSchema.index({ teamId: 1, datasetId: 1, createTime: 1 });

  // Get collection by external file id
  DatasetCollectionSchema.index(
    { datasetId: 1, externalFileId: 1 },
    {
      unique: true,
      partialFilterExpression: {
        externalFileId: { $exists: true }
      }
    }
  );

  // Clear invalid image
  DatasetCollectionSchema.index({
    teamId: 1,
    'metadata.relatedImgId': 1
  });
} catch (error) {
  console.log(error);
}

export const MongoDatasetCollection = getMongoModel<DatasetCollectionSchemaType>(
  DatasetColCollectionName,
  DatasetCollectionSchema
);
