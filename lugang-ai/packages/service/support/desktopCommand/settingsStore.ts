// 鲁港通 - 桌面 AI 操控开关持久化：desktop_ai_settings 单文档，保存后请求即读。
import { defineIndex, connectionMongo, getMongoModel } from '../../common/mongo';
import {
  DESKTOP_SWITCH_KEY,
  desktopSwitchToState,
  type DesktopSwitchRecord
} from './settings';
import type {
  DesktopSwitchMode,
  DesktopSwitchState
} from '@fastgpt/global/support/desktopCommand/type';

const { Schema } = connectionMongo;

export const desktopAiSettingsCollectionName = 'desktop_ai_settings';

type DesktopAiSettingsSchemaType = {
  key: string;
  mode: DesktopSwitchMode;
  accounts: string[];
  updatedAt: Date;
  updatedBy: string;
};

const DesktopAiSettingsSchema = new Schema<DesktopAiSettingsSchemaType>(
  {
    key: {
      type: String,
      required: true
    },
    mode: {
      type: String,
      enum: ['off', 'all', 'list'],
      required: true
    },
    accounts: {
      type: [String],
      default: []
    },
    updatedAt: {
      type: Date,
      default: () => new Date()
    },
    updatedBy: {
      type: String,
      default: ''
    }
  },
  { versionKey: false }
);

defineIndex(DesktopAiSettingsSchema, { key: { key: 1 }, options: { unique: true } });

/** 全局只有一条开关文档，用固定 key 读写。 */
export const MongoDesktopAiSettings = getMongoModel<DesktopAiSettingsSchemaType>(
  desktopAiSettingsCollectionName,
  DesktopAiSettingsSchema
);

export const readDesktopSwitch = async (): Promise<DesktopSwitchRecord | undefined> => {
  const doc = await MongoDesktopAiSettings.findOne({ key: DESKTOP_SWITCH_KEY })
    .select({ mode: 1, accounts: 1, updatedAt: 1, updatedBy: 1 })
    .lean();

  if (!doc) return undefined;

  return {
    mode: doc.mode,
    accounts: Array.isArray(doc.accounts) ? doc.accounts : [],
    updatedAt: doc.updatedAt,
    updatedBy: doc.updatedBy || undefined
  };
};

/** 管理页展示用：有数据库配置展示数据库配置，否则展示环境变量的实际生效值。 */
export const readDesktopSwitchState = async (envRaw?: string): Promise<DesktopSwitchState> => {
  let record: DesktopSwitchRecord | undefined;
  try {
    record = await readDesktopSwitch();
  } catch {
    record = undefined;
  }
  return desktopSwitchToState({ record, envRaw });
};

export const saveDesktopSwitch = async ({
  mode,
  accounts,
  updatedBy
}: {
  mode: DesktopSwitchMode;
  accounts: string[];
  updatedBy: string;
}): Promise<DesktopSwitchRecord> => {
  const updatedAt = new Date();

  await MongoDesktopAiSettings.updateOne(
    { key: DESKTOP_SWITCH_KEY },
    { $set: { mode, accounts, updatedAt, updatedBy } },
    { upsert: true }
  );

  return { mode, accounts, updatedAt, updatedBy };
};
