// 鲁港通 - AI 操控开关（仅 root）：读取当前生效配置，保存后下一次提问立即生效
import type { ApiRequestProps } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import type { DesktopSwitchState } from '@fastgpt/global/support/desktopCommand/type';
import { buildDesktopSwitchConfig } from '@fastgpt/service/support/desktopCommand/settings';
import {
  readDesktopSwitchState,
  saveDesktopSwitch
} from '@fastgpt/service/support/desktopCommand/settingsStore';

const bodySchema = z.object({
  mode: z.enum(['off', 'all', 'list']),
  accounts: z.array(z.string().trim().min(1).max(120)).max(100).optional()
});

async function handler(req: ApiRequestProps): Promise<DesktopSwitchState> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    throw new Error('请求方法不支持');
  }

  const { userId, isRoot } = await authCert({ req, authToken: true });
  if (!isRoot) {
    throw new Error('仅管理员可以调整 AI 操控开关');
  }

  if (req.method === 'GET') {
    return readDesktopSwitchState();
  }

  const { body } = parseApiInput({ req, bodySchema });
  const config = buildDesktopSwitchConfig(body);
  await saveDesktopSwitch({ ...config, updatedBy: userId });

  return readDesktopSwitchState();
}

export default NextAPI(handler);
