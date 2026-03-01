/**
 * 鲁港通 - 活动数据模型
 * 用于存储营销活动信息
 */
import { connectionMongo, getMongoModel } from '../../common/mongo';
const { Schema } = connectionMongo;
import type { ActivitySchema } from '@fastgpt/global/support/activity/type';
import { ActivityCollectionName } from '@fastgpt/global/support/activity/constant';

const ActivitySchemaDefinition = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String
  },
  link: {
    type: String
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createTime: {
    type: Date,
    default: () => new Date()
  },
  updateTime: {
    type: Date,
    default: () => new Date()
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'users'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'users'
  }
});

try {
  // 索引：按开始日期和结束日期查询
  ActivitySchemaDefinition.index({ startDate: 1, endDate: 1 });
  // 索引：按活动状态查询
  ActivitySchemaDefinition.index({ isActive: 1 });
  // 索引：按创建时间排序
  ActivitySchemaDefinition.index({ createTime: -1 });
} catch (error) {
  console.log(error);
}

export const MongoActivity = getMongoModel<ActivitySchema>(
  ActivityCollectionName,
  ActivitySchemaDefinition
);
