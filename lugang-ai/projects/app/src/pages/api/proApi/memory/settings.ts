// 鲁港通 - 智能体记忆总开关
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { setUserMemoryEnabled } from '@fastgpt/service/support/memory/controller';

const BodySchema = z.object({
  enabled: z.boolean()
});

async function handler(req: ApiRequestProps, _res: ApiResponseType) {
  const { teamId, tmbId } = await authCert({ req, authToken: true });

  const { enabled } = BodySchema.parse(req.body);

  await setUserMemoryEnabled({ teamId, tmbId, enabled });
}

export default NextAPI(handler);
