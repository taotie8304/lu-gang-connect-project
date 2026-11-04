// 鲁港通 - 候选记忆忽略
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { ignoreMemoryCandidate } from '@fastgpt/service/support/memory/controller';

const BodySchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i)
});

async function handler(req: ApiRequestProps, _res: ApiResponseType) {
  const { teamId, tmbId } = await authCert({ req, authToken: true });

  const { id } = BodySchema.parse(req.body);

  await ignoreMemoryCandidate({ teamId, tmbId, id });
}

export default NextAPI(handler);
