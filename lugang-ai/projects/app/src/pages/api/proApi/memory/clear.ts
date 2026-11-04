// 鲁港通 - 智能体记忆清空
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { clearUserMemories } from '@fastgpt/service/support/memory/controller';

async function handler(req: ApiRequestProps, _res: ApiResponseType) {
  const { teamId, tmbId } = await authCert({ req, authToken: true });

  await clearUserMemories({ teamId, tmbId });
}

export default NextAPI(handler);
