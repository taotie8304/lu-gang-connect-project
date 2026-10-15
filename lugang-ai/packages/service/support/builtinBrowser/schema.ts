// 鲁港通 - 办事浏览器会话模型（内置浏览器 P1）：每人同时最多一台进行中会话，
// tmbId 部分唯一索引仅约束进行中记录，配合开台时并发双击兜底
import { defineIndex, connectionMongo, getMongoModel } from '../../common/mongo';
const { Schema } = connectionMongo;
import {
  TeamCollectionName,
  TeamMemberCollectionName
} from '@fastgpt/global/support/user/team/constant';
import type { BuiltinBrowserSessionSchemaType } from '@fastgpt/global/support/builtinBrowser/type';

export const builtinBrowserSessionCollectionName = 'builtin_browser_sessions';

const BuiltinBrowserSessionSchema = new Schema(
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
    cloudSessionId: {
      type: String,
      required: true
    },
    resourceUrl: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      default: 'active'
    },
    openTime: {
      type: Date,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    closeTime: Date,
    closeReason: String,
    durationMs: Number
  },
  {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
  }
);

// 每人同时最多一条进行中会话（部分唯一索引：仅约束 status=active 的记录）
defineIndex(BuiltinBrowserSessionSchema, {
  key: { tmbId: 1 },
  options: { unique: true, partialFilterExpression: { status: 'active' } }
});
// 到期巡检扫描
defineIndex(BuiltinBrowserSessionSchema, { key: { status: 1, expiresAt: 1 } });

export const MongoBuiltinBrowserSessions = getMongoModel<BuiltinBrowserSessionSchemaType>(
  builtinBrowserSessionCollectionName,
  BuiltinBrowserSessionSchema
);
