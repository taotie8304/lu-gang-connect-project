// 鲁港通 - 智能体记忆启停（单条）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import type { UserMemoryItemType } from '@fastgpt/global/support/memory/type';
import { updateUserMemoryEnabled } from '@fastgpt/service/support/memory/controller';

const BodySchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i),
  enabled: z.boolean()
});

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<UserMemoryItemType> {
  const { teamId, tmbId } = await authCert({ req, authToken: true });

  const { id, enabled } = BodySchema.parse(req.body);

  return updateUserMemoryEnabled({ teamId, tmbId, id, enabled });
}

export default NextAPI(handler);
