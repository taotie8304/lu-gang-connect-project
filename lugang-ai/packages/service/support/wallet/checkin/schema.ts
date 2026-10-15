// 鲁港通 - 每日打卡模型（Credits 改革批 2）：团队成员一人一条，tmbId 唯一索引配合条件原子更新防并发双发
import { defineIndex, connectionMongo, getMongoModel } from '../../../common/mongo';
const { Schema } = connectionMongo;
import {
  TeamCollectionName,
  TeamMemberCollectionName
} from '@fastgpt/global/support/user/team/constant';
import type { UserCheckinSchemaType } from '@fastgpt/global/support/wallet/checkin/type';

export const userCheckinCollectionName = 'user_checkins';

const UserCheckinSchema = new Schema(
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
    streak: {
      type: Number,
      default: 0
    },
    totalCheckins: {
      type: Number,
      default: 0
    },
    lastCheckinDate: {
      type: String,
      default: ''
    },
    lastReward: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
  }
);

// 打卡记录按团队成员唯一
defineIndex(UserCheckinSchema, { key: { tmbId: 1 }, options: { unique: true } });
defineIndex(UserCheckinSchema, { key: { teamId: 1 } });

export const MongoUserCheckins = getMongoModel<UserCheckinSchemaType>(
  userCheckinCollectionName,
  UserCheckinSchema
);
