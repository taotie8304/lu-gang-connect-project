/*
  鲁港通 - 本地支付订单模型（N4 在线支付，支付宝当面付）
  顶替商业版 proApi 支付通道：订单生命周期 NOTPAY -> SUCCESS / CLOSED
*/
import { defineIndex, connectionMongo, getMongoModel } from '../../../common/mongo';
const { Schema } = connectionMongo;
import { TeamCollectionName } from '@fastgpt/global/support/user/team/constant';
import {
  BillStatusEnum,
  BillTypeEnum,
  BillPayWayEnum
} from '@fastgpt/global/support/wallet/bill/constants';
import {
  StandardSubLevelEnum,
  SubModeEnum
} from '@fastgpt/global/support/wallet/sub/constants';

export const billCollectionName = 'team_bills';

export interface BillMetadataType {
  /** 支付方式 */
  payWay?: `${BillPayWayEnum}`;
  /** 订阅周期（标准套餐订单） */
  subMode?: `${SubModeEnum}`;
  /** 标准套餐等级（标准套餐订单） */
  standSubLevel?: `${StandardSubLevelEnum}`;
  /** 订阅/有效月数 */
  month?: number;
  /** 购买的积分基数（额外积分订单） */
  extraPoints?: number;
  /** 到账后最终发放的积分（含年付/活动赠送） */
  totalPoints?: number;
}

export type BillSchemaType = {
  _id: unknown;
  teamId: unknown;
  tmbId: unknown;
  /** 商户订单号（支付宝 out_trade_no），全局唯一 */
  orderId: string;
  status: `${BillStatusEnum}`;
  type: `${BillTypeEnum}`;
  payWay: `${BillPayWayEnum}`;
  /** 订单金额，系统内部金额单位（元 × PRICE_SCALE） */
  price: number;
  /** 实际支付金额（内部单位） */
  paidAmount?: number;
  metadata: BillMetadataType;
  /** 支付宝收款码内容 */
  qrCode?: string;
  /** 支付宝交易号 */
  tradeNo?: string;
  createTime: Date;
  payTime?: Date;
};

const BillSchema = new Schema({
  teamId: {
    type: Schema.Types.ObjectId,
    ref: TeamCollectionName,
    required: true
  },
  tmbId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  orderId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: Object.values(BillStatusEnum),
    required: true
  },
  type: {
    type: String,
    enum: Object.values(BillTypeEnum),
    required: true
  },
  payWay: {
    type: String,
    enum: Object.values(BillPayWayEnum),
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  paidAmount: Number,
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  qrCode: String,
  tradeNo: String,
  createTime: {
    type: Date,
    default: () => new Date()
  },
  payTime: Date
});

// 订单列表/详情按团队查询
defineIndex(BillSchema, { key: { teamId: 1, createTime: -1 } });
// 商户订单号唯一（并发预下单幂等）
defineIndex(BillSchema, { key: { orderId: 1 }, options: { unique: true } });
// 异步通知按订单号定位
defineIndex(BillSchema, { key: { orderId: 1, status: 1 } });

export const MongoBill = getMongoModel<BillSchemaType>(billCollectionName, BillSchema);
