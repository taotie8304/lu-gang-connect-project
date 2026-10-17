// 鲁港通 - 办事浏览器标签页接口（内置浏览器 P2）：GET 列表 / POST 新建 / PATCH 切换 / DELETE 关闭；
// 标签索引 0 为服务端隐藏占位标签，接口只接受用户标签（index ≥ 1）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import {
  assertBuiltinBrowserUser,
  closeTabSession,
  ensureBuiltinBrowserSweeper,
  getTabsSession,
  newTabSession,
  selectTabSession
} from '@fastgpt/service/support/builtinBrowser/controller';
import type {
  CloseBuiltinBrowserTabResponse,
  GetBuiltinBrowserTabsResponse,
  NewBuiltinBrowserTabResponse,
  SelectBuiltinBrowserTabResponse
} from '@fastgpt/global/support/builtinBrowser/type';

/** 宽松解析标签索引：数字或数字字符串，非法值交给控制器拒绝 */
const parseTabIndex = (input: unknown) => {
  const raw = Array.isArray(input) ? input[0] : input;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isInteger(value) ? value : 0;
};

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<
  | GetBuiltinBrowserTabsResponse
  | NewBuiltinBrowserTabResponse
  | SelectBuiltinBrowserTabResponse
  | CloseBuiltinBrowserTabResponse
> {
  const { tmbId, userId, isRoot } = await authCert({ req, authToken: true });

  await assertBuiltinBrowserUser({ userId, isRoot });
  ensureBuiltinBrowserSweeper();

  if (req.method === 'POST') {
    return newTabSession({ tmbId });
  }
  if (req.method === 'PATCH') {
    return selectTabSession({ tmbId, index: parseTabIndex(req.body?.index) });
  }
  if (req.method === 'DELETE') {
    return closeTabSession({ tmbId, index: parseTabIndex(req.query?.index) });
  }
  return getTabsSession({ tmbId });
}

export default NextAPI(handler);
