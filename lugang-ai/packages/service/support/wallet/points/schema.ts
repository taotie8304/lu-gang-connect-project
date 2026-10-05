// 鲁港通 - 个人积分账户模型（N4 支付配套）：团队共享池改为个人账户，余额决定能否发起对话
import { defineIndex, connectionMongo, getMongoModel } from '../../../common/mongo';
const { Schema } = connectionMongo;
import {
  TeamCollectionName,
  TeamMemberCollectionName
} from '@fastgpt/global/support/user/team/constant';
import { StandardSubLevelEnum, SubModeEnum } from '@fastgpt/global/support/wallet/sub/constants';
import type { UserPointsSchemaType } from '@fastgpt/global/support/wallet/points/type';

export const userPointsCollectionName = 'user_points';

const UserPointsSchema = new Schema(
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
    totalPoints: {
      type: Number,
      default: 0
    },
    surplusPoints: {
      type: Number,
      default: 0
    },
    currentSubLevel: {
      type: String,
      enum: Object.values(StandardSubLevelEnum),
      default: StandardSubLevelEnum.free
    },
    currentMode: {
      type: String,
      enum: Object.values(SubModeEnum)
    },
    expiredTime: Date
  },
  {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
  }
);

// 账户按团队成员唯一
defineIndex(UserPointsSchema, { key: { tmbId: 1 }, options: { unique: true } });
defineIndex(UserPointsSchema, { key: { teamId: 1 } });

export const MongoUserPoints = getMongoModel<UserPointsSchemaType>(
  userPointsCollectionName,
  UserPointsSchema
);
