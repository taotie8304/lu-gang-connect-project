// 鲁港通 - 智能体记忆列表与总开关状态
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import type { UserMemoryListResponseType } from '@fastgpt/global/support/memory/type';
import { listUserMemories } from '@fastgpt/service/support/memory/controller';

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<UserMemoryListResponseType> {
  const { teamId, tmbId } = await authCert({ req, authToken: true });

  return listUserMemories({ teamId, tmbId });
}

export default NextAPI(handler);
