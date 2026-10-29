// 鲁港通 - 管理员强制解绑桌面设备（仅 root）：设备令牌立即失效
import type { ApiRequestProps } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import { revokeDesktopDevice } from '@fastgpt/service/support/desktopCommand/store';
import type { UnbindDesktopDeviceResponse } from '@fastgpt/global/support/desktopCommand/type';

const bodySchema = z.object({
  deviceId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, '设备标识格式不正确')
});

async function handler(req: ApiRequestProps): Promise<UnbindDesktopDeviceResponse> {
  if (req.method !== 'POST') {
    throw new Error('请求方法不支持');
  }

  const { body } = parseApiInput({ req, bodySchema });
  const { isRoot } = await authCert({ req, authToken: true });
  if (!isRoot) {
    throw new Error('仅管理员可以解绑桌面设备');
  }

  return { revoked: await revokeDesktopDevice({ deviceId: body.deviceId }) };
}

export default NextAPI(handler);
