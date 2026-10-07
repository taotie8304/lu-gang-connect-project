/**
 * 鲁港通 - 工单系统数据模型
 * support_tickets：工单主表；support_ticket_messages：消息流；support_ticket_sequences：当日序号计数器
 */
import { defineIndex, connectionMongo, getMongoModel } from '../../common/mongo';
const { Schema } = connectionMongo;
import {
  TeamCollectionName,
  TeamMemberCollectionName
} from '@fastgpt/global/support/user/team/constant';
import {
  TicketRoleEnum,
  TicketStatusEnum,
  TicketTypeEnum
} from '@fastgpt/global/support/ticket/constants';
import type {
  SupportTicketMessageSchemaType,
  SupportTicketSchemaType
} from '@fastgpt/global/support/ticket/type';

export const supportTicketCollectionName = 'support_tickets';
export const supportTicketMessageCollectionName = 'support_ticket_messages';
export const supportTicketSequenceCollectionName = 'support_ticket_sequences';

const SupportTicketSchema = new Schema(
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
    userSnapshot: {
      name: { type: String, required: true },
      email: { type: String }
    },
    ticketNo: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: Object.values(TicketTypeEnum),
      required: true
    },
    title: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(TicketStatusEnum),
      default: TicketStatusEnum.pending
    },
    lastReplyAt: Date,
    lastReplyRole: {
      type: String,
      enum: Object.values(TicketRoleEnum)
    },
    lastReplyName: String,
    userUnread: {
      type: Number,
      default: 0
    },
    adminUnread: {
      type: Number,
      default: 0
    },
    lastActiveTime: {
      type: Date,
      default: () => new Date()
    }
  },
  {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
  }
);

defineIndex(SupportTicketSchema, { key: { ticketNo: 1 }, options: { unique: true } });
// 用户侧列表：本人 + 最近活跃排序
defineIndex(SupportTicketSchema, { key: { tmbId: 1, lastActiveTime: -1 } });
// 管理侧队列：状态筛选 + 最近活跃排序
defineIndex(SupportTicketSchema, { key: { status: 1, lastActiveTime: -1 } });

const SupportTicketMessageSchema = new Schema(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: TeamCollectionName,
      required: true
    },
    role: {
      type: String,
      enum: Object.values(TicketRoleEnum),
      required: true
    },
    name: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    }
  },
  {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
  }
);

// 消息流按工单聚合、时间正序读取
defineIndex(SupportTicketMessageSchema, { key: { ticketId: 1, createTime: 1 } });

// 当日序号计数器：原子自增生成 T20261007-001 形式的工单编号
const SupportTicketSequenceSchema = new Schema({
  date: {
    type: String,
    required: true
  },
  seq: {
    type: Number,
    default: 0
  },
  updateTime: {
    type: Date,
    default: () => new Date()
  }
});

defineIndex(SupportTicketSequenceSchema, { key: { date: 1 }, options: { unique: true } });

export const MongoSupportTicket = getMongoModel<SupportTicketSchemaType>(
  supportTicketCollectionName,
  SupportTicketSchema
);
export const MongoSupportTicketMessage = getMongoModel<SupportTicketMessageSchemaType>(
  supportTicketMessageCollectionName,
  SupportTicketMessageSchema
);
export const MongoSupportTicketSequence = getMongoModel<{ date: string; seq: number }>(
  supportTicketSequenceCollectionName,
  SupportTicketSequenceSchema
);
