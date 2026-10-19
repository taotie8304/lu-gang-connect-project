// 鲁港通 - 桌面客户端设备注销（阶段一）：用设备自身令牌撤销，避免与退出登录清 Cookie 竞态
import type { ApiRequestProps } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import {
  authenticateDesktopDevice,
  revokeDesktopDevice
} from '@fastgpt/service/support/desktopCommand/store';
import type { RevokeDesktopDeviceResponse } from '@fastgpt/global/support/desktopCommand/type';

const bodySchema = z.object({
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, '设备标识格式不正确')
});

async function handler(req: ApiRequestProps): Promise<RevokeDesktopDeviceResponse> {
  if (req.method !== 'POST') {
    throw new Error('请求方法不支持');
  }

  const { body } = parseApiInput({ req, bodySchema });
  const session = await authenticateDesktopDevice({
    deviceId: body.deviceId,
    authorization: req.headers.authorization
  });

  const revoked = await revokeDesktopDevice({ deviceId: body.deviceId, tmbId: session.tmbId });

  return { revoked };
}

export default NextAPI(handler);
