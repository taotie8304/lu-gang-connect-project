// 鲁港通 - 代金券模型（Credits 改革批 3）：
// 下单原子预扣（lockedBillId 占位防双花）→ 取消释放 / 支付成功定案；单次订单最多一张券，可部分使用。
import { defineIndex, connectionMongo, getMongoModel } from '../../../common/mongo';
const { Schema } = connectionMongo;
import {
  TeamCollectionName,
  TeamMemberCollectionName
} from '@fastgpt/global/support/user/team/constant';
import { VoucherSourceEnum } from '@fastgpt/global/support/wallet/voucher/constants';
import type { UserVoucherSchemaType } from '@fastgpt/global/support/wallet/voucher/type';

export const voucherCollectionName = 'vouchers';

const VoucherSchema = new Schema(
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
    amount: {
      type: Number,
      required: true
    },
    remainingAmount: {
      type: Number,
      required: true
    },
    source: {
      type: String,
      enum: Object.values(VoucherSourceEnum),
      required: true
    },
    issuedBy: {
      type: String,
      default: ''
    },
    note: {
      type: String,
      default: ''
    },
    lockedBillId: {
      type: String,
      default: ''
    },
    usedBills: {
      type: [
        new Schema(
          {
            billId: { type: String, required: true },
            deducted: { type: Number, required: true },
            at: { type: Date, required: true }
          },
          { _id: false }
        )
      ],
      default: []
    }
  },
  {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
  }
);

// 用户持券列表（充值选券弹窗）按成员查询
defineIndex(VoucherSchema, { key: { tmbId: 1, createTime: -1 } });
defineIndex(VoucherSchema, { key: { teamId: 1 } });

export const MongoVouchers = getMongoModel<UserVoucherSchemaType>(
  voucherCollectionName,
  VoucherSchema
);
