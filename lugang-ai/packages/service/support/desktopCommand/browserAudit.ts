// 鲁港通 - 桌面浏览器操作审计写入（P2 阶段一）
import { MongoDesktopBrowserAudit } from './auditSchema';
import type { DesktopBrowserAuditRecord } from './browserOperation';

export const writeDesktopBrowserAudit = async (record: DesktopBrowserAuditRecord) => {
  await MongoDesktopBrowserAudit.create({
    tmbId: record.tmbId,
    uid: record.uid,
    chatId: record.chatId,
    deviceId: record.deviceId,
    action: record.action,
    url: record.url,
    ok: record.ok,
    code: record.code,
    changed: record.changed,
    stopped: record.stopped,
    confirmation: record.confirmation,
    createTime: new Date(record.createdAt)
  });
};
