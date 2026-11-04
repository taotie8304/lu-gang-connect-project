/**
 * 鲁港通 - 智能体记忆数据模型
 * user_memories：用户记忆条目；user_memory_settings：用户级记忆总开关
 */
import { defineIndex, connectionMongo, getMongoModel } from '../../common/mongo';
const { Schema } = connectionMongo;
import {
  TeamCollectionName,
  TeamMemberCollectionName
} from '@fastgpt/global/support/user/team/constant';
import type {
  UserMemorySchemaType,
  UserMemorySettingSchemaType
} from '@fastgpt/global/support/memory/type';

export const userMemoryCollectionName = 'user_memories';
export const userMemorySettingCollectionName = 'user_memory_settings';

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

export const MongoUserMemory = getMongoModel<UserMemorySchemaType>(
  userMemoryCollectionName,
  UserMemorySchema
);
export const MongoUserMemorySetting = getMongoModel<UserMemorySettingSchemaType>(
  userMemorySettingCollectionName,
  UserMemorySettingSchema
);
