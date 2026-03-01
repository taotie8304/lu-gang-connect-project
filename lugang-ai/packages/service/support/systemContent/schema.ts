/**
 * 鲁港通 - 系统内容数据模型
 * 用于存储使用条款、隐私政策、个人资料收集声明等系统内容
 */
import { connectionMongo, getMongoModel } from '../../common/mongo';
const { Schema } = connectionMongo;
import type { SystemContentSchema } from '@fastgpt/global/support/systemContent/type';
import { SystemContentKeyEnum } from '@fastgpt/global/support/systemContent/constant';

export const systemContentCollectionName = 'system_contents';

const SystemContentSchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true,
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

try {
  SystemContentSchema.index({ key: 1 });
  SystemContentSchema.index({ updateTime: -1 });
} catch (error) {
  console.log(error);
}

export const MongoSystemContent = getMongoModel<SystemContentSchema>(
  systemContentCollectionName,
  SystemContentSchema
);
