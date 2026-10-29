// 鲁港通 - 我的桌面设备列表：只返回本人绑定的设备，不包含令牌信息
import type { ApiRequestProps } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { listDesktopDevices } from '@fastgpt/service/support/desktopCommand/store';
import type { ListDesktopDevicesResponse } from '@fastgpt/global/support/desktopCommand/type';

async function handler(req: ApiRequestProps): Promise<ListDesktopDevicesResponse> {
  if (req.method !== 'GET') {
    throw new Error('请求方法不支持');
  }

  const { tmbId } = await authCert({ req, authToken: true });

  return { devices: await listDesktopDevices({ tmbId }) };
}

export default NextAPI(handler);
