// 鲁港通 - 办事浏览器接口（内置浏览器 P1）：POST 开台 / GET 查询 / PUT 视口跟随 / PATCH 网址跳转 / DELETE 关台；
// 灰度门槛（管理员 + 内测名单）在服务端强制校验
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import {
  assertBuiltinBrowserUser,
  closeSession,
  ensureBuiltinBrowserSweeper,
  getSessionStatus,
  navigateSession,
  openSession,
  resizeSession
} from '@fastgpt/service/support/builtinBrowser/controller';
import type {
  BuiltinBrowserViewport,
  CloseBuiltinBrowserSessionResponse,
  GetBuiltinBrowserSessionStatusResponse,
  NavigateBuiltinBrowserSessionResponse,
  OpenBuiltinBrowserSessionResponse,
  ResizeBuiltinBrowserSessionResponse
} from '@fastgpt/global/support/builtinBrowser/type';

/** 宽松解析面板视口：仅接受两个有限数字；不合法即视为未提供（服务端按默认尺寸） */
const parseViewport = (input: unknown): BuiltinBrowserViewport | undefined => {
  if (!input || typeof input !== 'object') return undefined;
  const { width, height } = input as { width?: unknown; height?: unknown };
  if (typeof width !== 'number' || typeof height !== 'number') return undefined;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  return { width, height };
};

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<
  | OpenBuiltinBrowserSessionResponse
  | GetBuiltinBrowserSessionStatusResponse
  | ResizeBuiltinBrowserSessionResponse
  | NavigateBuiltinBrowserSessionResponse
  | CloseBuiltinBrowserSessionResponse
> {
  const { teamId, tmbId, userId, isRoot } = await authCert({ req, authToken: true });

  await assertBuiltinBrowserUser({ userId, isRoot });
  ensureBuiltinBrowserSweeper();

  if (req.method === 'POST') {
    return openSession({ teamId, tmbId, viewport: parseViewport(req.body?.viewport) });
  }
  if (req.method === 'PUT') {
    const viewport = parseViewport(req.body?.viewport);
    if (!viewport) return { resized: false };
    return resizeSession({ tmbId, viewport });
  }
  if (req.method === 'PATCH') {
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    return navigateSession({ tmbId, url });
  }
  if (req.method === 'DELETE') {
    return closeSession({ tmbId });
  }
  return getSessionStatus({ tmbId });
}

export default NextAPI(handler);
