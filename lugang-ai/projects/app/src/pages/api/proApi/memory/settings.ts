// 鲁港通 - 智能体记忆总开关 + 自动提取开关
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import {
  setUserMemoryAutoExtractEnabled,
  setUserMemoryEnabled
} from '@fastgpt/service/support/memory/controller';

const BodySchema = z
  .object({
    enabled: z.boolean().optional(),
    autoExtractEnabled: z.boolean().optional()
  })
  .refine((data) => data.enabled !== undefined || data.autoExtractEnabled !== undefined, {
    message: '请至少提供一个开关设置'
  });

async function handler(req: ApiRequestProps, _res: ApiResponseType) {
  const { teamId, tmbId } = await authCert({ req, authToken: true });

  const { enabled, autoExtractEnabled } = BodySchema.parse(req.body);

  if (enabled !== undefined) {
    await setUserMemoryEnabled({ teamId, tmbId, enabled });
  }
  if (autoExtractEnabled !== undefined) {
    await setUserMemoryAutoExtractEnabled({ teamId, tmbId, enabled: autoExtractEnabled });
  }
}

export default NextAPI(handler);
