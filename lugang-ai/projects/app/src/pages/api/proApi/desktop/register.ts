// 鲁港通 - 桌面客户端设备注册（阶段一）：登录态换取一次性设备令牌，服务端只保存哈希
import type { ApiRequestProps } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import { registerDesktopDevice } from '@fastgpt/service/support/desktopCommand/store';
import type { RegisterDesktopDeviceResponse } from '@fastgpt/global/support/desktopCommand/type';

const bodySchema = z.object({
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, '设备标识格式不正确'),
  deviceName: z.string().trim().min(1).max(64).optional(),
  appVersion: z.string().trim().min(1).max(32).optional()
});

async function handler(req: ApiRequestProps): Promise<RegisterDesktopDeviceResponse> {
  if (req.method !== 'POST') {
    throw new Error('请求方法不支持');
  }

  const { body } = parseApiInput({ req, bodySchema });
  const { tmbId, userId, teamId } = await authCert({ req, authToken: true });

  return registerDesktopDevice({ ...body, tmbId, userId, teamId });
}

export default NextAPI(handler);
