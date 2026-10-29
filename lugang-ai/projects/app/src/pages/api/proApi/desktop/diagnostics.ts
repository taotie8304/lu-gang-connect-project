// 鲁港通 - 桌面崩溃上报（设备令牌鉴权）：客户端已脱敏，服务端再次截断长度后入库
import type { ApiRequestProps } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import { authenticateDesktopDevice } from '@fastgpt/service/support/desktopCommand/store';
import { saveDesktopCrashReports } from '@fastgpt/service/support/desktopCommand/crashReportStore';
import {
  DESKTOP_CRASH_MAX_REPORTS_PER_UPLOAD,
  DESKTOP_CRASH_MESSAGE_MAX_CHARS,
  DESKTOP_CRASH_STACK_MAX_CHARS,
  DESKTOP_CRASH_LOG_MAX_CHARS
} from '@fastgpt/service/support/desktopCommand/crashReport';
import type { SubmitDesktopCrashReportsResponse } from '@fastgpt/global/support/desktopCommand/type';

const reportSchema = z.object({
  type: z.enum(['uncaught-exception', 'unhandled-rejection', 'renderer-crash', 'manual']),
  // 入库前统一截断；这里只拦截明显异常的载荷
  message: z.string().trim().min(1).max(DESKTOP_CRASH_MESSAGE_MAX_CHARS * 4),
  stack: z.string().max(DESKTOP_CRASH_STACK_MAX_CHARS * 3).optional(),
  log: z.string().max(DESKTOP_CRASH_LOG_MAX_CHARS * 4).optional(),
  occurredAt: z.number().int().nonnegative()
});

const bodySchema = z.object({
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, '设备标识格式不正确'),
  deviceName: z.string().trim().min(1).max(64).optional(),
  appVersion: z.string().trim().min(1).max(32).optional(),
  platform: z.string().trim().min(1).max(64).optional(),
  reports: z
    .array(reportSchema)
    .min(1)
    .max(DESKTOP_CRASH_MAX_REPORTS_PER_UPLOAD, '单次最多上报 3 条崩溃记录')
});

async function handler(req: ApiRequestProps): Promise<SubmitDesktopCrashReportsResponse> {
  if (req.method !== 'POST') {
    throw new Error('请求方法不支持');
  }

  const { body } = parseApiInput({ req, bodySchema });
  const session = await authenticateDesktopDevice({
    deviceId: body.deviceId,
    authorization: req.headers.authorization
  });

  const accepted = await saveDesktopCrashReports({
    deviceId: body.deviceId,
    deviceName: body.deviceName,
    appVersion: body.appVersion,
    platform: body.platform,
    tmbId: session.tmbId,
    uid: session.userId,
    reports: body.reports
  });

  return { accepted };
}

export default NextAPI(handler);
