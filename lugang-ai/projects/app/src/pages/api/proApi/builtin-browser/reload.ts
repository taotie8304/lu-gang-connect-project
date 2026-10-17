// 鲁港通 - 办事浏览器网页原地刷新接口（A3）：POST 在当前标签重新打开同一网址，不重建查看器
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import {
  assertBuiltinBrowserUser,
  ensureBuiltinBrowserSweeper,
  reloadSession
} from '@fastgpt/service/support/builtinBrowser/controller';
import type { ReloadBuiltinBrowserSessionResponse } from '@fastgpt/global/support/builtinBrowser/type';

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<ReloadBuiltinBrowserSessionResponse> {
  const { tmbId, userId, isRoot } = await authCert({ req, authToken: true });

  await assertBuiltinBrowserUser({ userId, isRoot });
  ensureBuiltinBrowserSweeper();

  if (req.method !== 'POST') {
    return { reloaded: false };
  }
  return reloadSession({ tmbId });
}

export default NextAPI(handler);
