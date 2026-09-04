/**
 * 鲁港通 - 系统内容数据模型
 * 用于存储使用条款、隐私政策、个人资料收集声明等系统内容
 */
import { connectionMongo, defineIndex, getMongoModel } from '../../common/mongo';
const { Schema } = connectionMongo;
import type { SystemContentSchema } from '@fastgpt/global/support/systemContent/type';
import { SystemContentKeyEnum } from '@fastgpt/global/support/systemContent/constant';

export const systemContentCollectionName = 'system_contents';

const SystemContentMongoSchema = new Schema({
  key: {
    type: String,
    required: true,
    enum: Object.values(SystemContentKeyEnum)
  },
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    default: ''
  },
  contentType: {
    type: String,
    enum: ['markdown', 'html', 'text'],
    default: 'markdown'
  },
  updateTime: {
    type: Date,
    default: () => new Date()
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'users'
  },
  createTime: {
    type: Date,
    default: () => new Date()
  }
});

// 鲁港通 - key 唯一索引 + 更新时间倒序索引（4.16.2 defineIndex 约定，替代旧 try/catch console.log）
defineIndex(SystemContentMongoSchema, {
  key: { key: 1 },
  options: { unique: true }
});
defineIndex(SystemContentMongoSchema, { key: { updateTime: -1 } });

export const MongoSystemContent = getMongoModel<SystemContentSchema>(
  systemContentCollectionName,
  SystemContentMongoSchema
);
