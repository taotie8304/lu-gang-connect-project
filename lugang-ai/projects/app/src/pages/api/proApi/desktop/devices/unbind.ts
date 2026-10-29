// 鲁港通 - 解绑本人桌面设备：解除后设备令牌立即失效，桌面端下次会话会自动重新注册
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
  const { tmbId } = await authCert({ req, authToken: true });

  return { revoked: await revokeDesktopDevice({ deviceId: body.deviceId, tmbId }) };
}

export default NextAPI(handler);
