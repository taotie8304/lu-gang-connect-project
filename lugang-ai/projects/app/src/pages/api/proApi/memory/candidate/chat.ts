// 鲁港通 - 某次对话的待确认候选记忆（对话轻提示使用）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { z } from 'zod';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import type { UserMemoryCandidateType } from '@fastgpt/global/support/memory/type';
import { listPendingMemoryCandidatesByChat } from '@fastgpt/service/support/memory/controller';

const BodySchema = z.object({
  chatId: z.string().min(1).max(100)
});

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<{ list: UserMemoryCandidateType[] }> {
  const { teamId, tmbId } = await authCert({ req, authToken: true });

  const { chatId } = BodySchema.parse(req.body);

  const list = await listPendingMemoryCandidatesByChat({ teamId, tmbId, chatId });

  return { list };
}

export default NextAPI(handler);
