// 鲁港通 - 桌面浏览器操作审计模型（P2 阶段一）：
// 只记录动作、站点与结果，不保存用户输入内容；90 天后由 TTL 索引自动清理。
import { defineIndex, connectionMongo, getMongoModel } from '../../common/mongo';
const { Schema } = connectionMongo;
import { TeamMemberCollectionName } from '@fastgpt/global/support/user/team/constant';

export const desktopBrowserAuditCollectionName = 'desktop_browser_audits';
export const DESKTOP_BROWSER_AUDIT_TTL_SECONDS = 90 * 24 * 60 * 60;

export type DesktopBrowserAuditSchemaType = {
  tmbId: string;
  uid?: string;
  chatId: string;
  deviceId?: string;
  action: string;
  url?: string;
  ok: boolean;
  code?: string;
  changed?: boolean;
  stopped?: boolean;
  /** 提交前确认结果（allow / handoff / cancel / timeout / unavailable），不记录确认文案 */
  confirmation?: string;
  createTime: Date;
};

const DesktopBrowserAuditSchema = new Schema({
  tmbId: {
    type: Schema.Types.ObjectId,
    ref: TeamMemberCollectionName,
    required: true
  },
  uid: String,
  chatId: {
    type: String,
    required: true
  },
  deviceId: String,
  action: {
    type: String,
    required: true
  },
  url: String,
  ok: {
    type: Boolean,
    required: true
  },
  code: String,
  changed: Boolean,
  stopped: Boolean,
  confirmation: String,
  createTime: {
    type: Date,
    required: true
  }
});

defineIndex(DesktopBrowserAuditSchema, {
  key: { tmbId: 1, createTime: -1 }
});
defineIndex(DesktopBrowserAuditSchema, {
  key: { createTime: 1 },
  options: { expireAfterSeconds: DESKTOP_BROWSER_AUDIT_TTL_SECONDS }
});

export const MongoDesktopBrowserAudit = getMongoModel<DesktopBrowserAuditSchemaType>(
  desktopBrowserAuditCollectionName,
  DesktopBrowserAuditSchema
);
