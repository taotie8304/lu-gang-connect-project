/**
 * 鲁港通 - 智能体记忆数据模型
 * user_memories：用户记忆条目；user_memory_settings：用户级记忆总开关
 * user_memory_candidates：待确认候选记忆；user_memory_extraction_logs：提取频控日志
 */
import { defineIndex, connectionMongo, getMongoModel } from '../../common/mongo';
const { Schema } = connectionMongo;
import {
  TeamCollectionName,
  TeamMemberCollectionName
} from '@fastgpt/global/support/user/team/constant';
import type {
  UserMemoryCandidateSchemaType,
  UserMemoryExtractionLogSchemaType,
  UserMemorySchemaType,
  UserMemorySettingSchemaType
} from '@fastgpt/global/support/memory/type';

export const userMemoryCollectionName = 'user_memories';
export const userMemorySettingCollectionName = 'user_memory_settings';
export const userMemoryCandidateCollectionName = 'user_memory_candidates';
export const userMemoryExtractionLogCollectionName = 'user_memory_extraction_logs';

const UserMemorySchema = new Schema(
  {
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
    content: {
      type: String,
      required: true
    },
    enabled: {
      type: Boolean,
      default: true
    },
    source: {
      type: String,
      enum: ['manual', 'auto'],
      default: 'manual'
    }
  },
  {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
  }
);

// 用户维度列表与注入读取：按创建时间倒序
defineIndex(UserMemorySchema, { key: { tmbId: 1, createTime: -1 } });

const UserMemorySettingSchema = new Schema(
  {
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
    enabled: {
      type: Boolean,
      default: true
    },
    autoExtractEnabled: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
  }
);

defineIndex(UserMemorySettingSchema, {
  key: { teamId: 1, tmbId: 1 },
  options: { unique: true }
});

const UserMemoryCandidateSchema = new Schema(
  {
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
    content: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'adopted', 'ignored'],
      default: 'pending'
    },
    chatId: {
      type: String
    },
    expireAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
  }
);

// 待确认列表与去重查询：用户维度按状态 + 创建时间倒序
defineIndex(UserMemoryCandidateSchema, { key: { tmbId: 1, status: 1, createTime: -1 } });
// 过期清理与去重窗口查询
defineIndex(UserMemoryCandidateSchema, { key: { tmbId: 1, expireAt: 1 } });

const UserMemoryExtractionLogSchema = new Schema(
  {
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
    chatId: {
      type: String
    },
    createdCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: { createdAt: 'createTime', updatedAt: false }
  }
);

// 每日频控计数：按用户 + 时间窗口统计
defineIndex(UserMemoryExtractionLogSchema, { key: { tmbId: 1, createTime: -1 } });

export const MongoUserMemory = getMongoModel<UserMemorySchemaType>(
  userMemoryCollectionName,
  UserMemorySchema
);
export const MongoUserMemorySetting = getMongoModel<UserMemorySettingSchemaType>(
  userMemorySettingCollectionName,
  UserMemorySettingSchema
);
export const MongoUserMemoryCandidate = getMongoModel<UserMemoryCandidateSchemaType>(
  userMemoryCandidateCollectionName,
  UserMemoryCandidateSchema
);
export const MongoUserMemoryExtractionLog = getMongoModel<UserMemoryExtractionLogSchemaType>(
  userMemoryExtractionLogCollectionName,
  UserMemoryExtractionLogSchema
);
