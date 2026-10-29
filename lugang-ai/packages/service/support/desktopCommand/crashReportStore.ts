// 鲁港通 - 桌面崩溃上报存储：设备上报后写入，30 天后由 TTL 索引自动清理
import { defineIndex, connectionMongo, getMongoModel } from '../../common/mongo';
const { Schema } = connectionMongo;
import { TeamMemberCollectionName } from '@fastgpt/global/support/user/team/constant';
import type {
  DesktopCrashReportInput,
  DesktopCrashReportType,
  DesktopCrashReportView
} from '@fastgpt/global/support/desktopCommand/type';
import { normalizeDesktopCrashReport } from './crashReport';

export const desktopCrashReportCollectionName = 'desktop_crash_reports';
export const DESKTOP_CRASH_REPORT_TTL_SECONDS = 30 * 24 * 60 * 60;

export type DesktopCrashReportSchemaType = {
  deviceId: string;
  deviceName?: string;
  tmbId: string;
  uid?: string;
  appVersion?: string;
  platform?: string;
  type: DesktopCrashReportType;
  message: string;
  stack?: string;
  log?: string;
  occurredAt: Date;
  createTime: Date;
};

const DesktopCrashReportSchema = new Schema({
  deviceId: {
    type: String,
    required: true
  },
  deviceName: String,
  tmbId: {
    type: Schema.Types.ObjectId,
    ref: TeamMemberCollectionName,
    required: true
  },
  uid: String,
  appVersion: String,
  platform: String,
  type: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  stack: String,
  log: String,
  occurredAt: {
    type: Date,
    required: true
  },
  createTime: {
    type: Date,
    required: true
  }
});

defineIndex(DesktopCrashReportSchema, { key: { tmbId: 1, createTime: -1 } });
defineIndex(DesktopCrashReportSchema, {
  key: { createTime: 1 },
  options: { expireAfterSeconds: DESKTOP_CRASH_REPORT_TTL_SECONDS }
});

export const MongoDesktopCrashReport = getMongoModel<DesktopCrashReportSchemaType>(
  desktopCrashReportCollectionName,
  DesktopCrashReportSchema
);

export const saveDesktopCrashReports = async ({
  deviceId,
  deviceName,
  appVersion,
  platform,
  tmbId,
  uid,
  reports,
  now = Date.now()
}: {
  deviceId: string;
  deviceName?: string;
  appVersion?: string;
  platform?: string;
  tmbId: string;
  uid?: string;
  reports: DesktopCrashReportInput[];
  now?: number;
}): Promise<number> => {
  if (reports.length === 0) return 0;

  const docs = reports.map((report) => ({
    deviceId,
    deviceName,
    appVersion,
    platform,
    tmbId,
    uid,
    ...normalizeDesktopCrashReport(report, { now }),
    createTime: new Date(now)
  }));
  await MongoDesktopCrashReport.insertMany(docs);

  return docs.length;
};

export const listDesktopCrashReports = async ({
  limit = 50
}: { limit?: number } = {}): Promise<DesktopCrashReportView[]> => {
  const docs = await MongoDesktopCrashReport.find()
    .sort({ createTime: -1 })
    .limit(Math.max(1, Math.min(limit, 200)))
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    deviceId: doc.deviceId,
    deviceName: doc.deviceName || undefined,
    tmbId: String(doc.tmbId),
    appVersion: doc.appVersion || undefined,
    platform: doc.platform || undefined,
    type: doc.type,
    message: doc.message,
    stack: doc.stack || undefined,
    log: doc.log || undefined,
    occurredAt: new Date(doc.occurredAt).getTime(),
    createdAt: new Date(doc.createTime).getTime()
  }));
};
