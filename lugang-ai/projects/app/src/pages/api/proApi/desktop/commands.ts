// 鲁港通 - 桌面客户端指令长轮询（阶段一）：设备令牌鉴权，最长挂起 25 秒；每次请求刷新在线心跳
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import {
  authenticateDesktopDevice,
  waitForDesktopCommand
} from '@fastgpt/service/support/desktopCommand/store';
import {
  DESKTOP_LONG_POLL_DEFAULT_MS,
  DESKTOP_LONG_POLL_MAX_MS
} from '@fastgpt/service/support/desktopCommand/constant';
import type { GetDesktopCommandsResponse } from '@fastgpt/global/support/desktopCommand/type';

const querySchema = z.object({
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, '设备标识格式不正确'),
  timeoutMs: z.coerce
    .number()
    .int()
    .min(0)
    .max(DESKTOP_LONG_POLL_MAX_MS)
    .default(DESKTOP_LONG_POLL_DEFAULT_MS)
});

async function handler(
  req: ApiRequestProps,
  res: ApiResponseType
): Promise<GetDesktopCommandsResponse> {
  if (req.method !== 'GET') {
    throw new Error('请求方法不支持');
  }

  const { deviceId, timeoutMs } = parseApiInput({ req, querySchema }).query;
  await authenticateDesktopDevice({
    deviceId,
    authorization: req.headers.authorization
  });

  const command = await waitForDesktopCommand({ deviceId, timeoutMs });
  res.setHeader('Cache-Control', 'no-store');

  return { command: command ?? null };
}

export default NextAPI(handler);
