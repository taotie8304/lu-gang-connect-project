// 鲁港通 - 候选记忆确认（写入正式记忆）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import type { UserMemoryItemType } from '@fastgpt/global/support/memory/type';
import { adoptMemoryCandidate } from '@fastgpt/service/support/memory/controller';

const BodySchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i),
  content: z.string().optional()
});

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<UserMemoryItemType> {
  const { teamId, tmbId } = await authCert({ req, authToken: true });

  const { id, content } = BodySchema.parse(req.body);

  return adoptMemoryCandidate({ teamId, tmbId, id, content });
}

export default NextAPI(handler);
