// 鲁港通 - 智能体记忆删除（单条）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { deleteUserMemory } from '@fastgpt/service/support/memory/controller';

const BodySchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i)
});

async function handler(req: ApiRequestProps, _res: ApiResponseType) {
  const { teamId, tmbId } = await authCert({ req, authToken: true });

  const { id } = BodySchema.parse(req.body);

  await deleteUserMemory({ teamId, tmbId, id });
}

export default NextAPI(handler);
