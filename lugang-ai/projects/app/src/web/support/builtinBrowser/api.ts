// 鲁港通 - 办事浏览器前端接口（内置浏览器 P1）
import { DELETE, GET, PATCH, POST, PUT } from '@/web/common/api/request';
import type {
  BuiltinBrowserViewport,
  CloseBuiltinBrowserSessionResponse,
  CloseBuiltinBrowserTabResponse,
  GetBuiltinBrowserSessionStatusResponse,
  GetBuiltinBrowserTabsResponse,
  NavigateBuiltinBrowserSessionResponse,
  NewBuiltinBrowserTabResponse,
  OpenBuiltinBrowserSessionRequest,
  OpenBuiltinBrowserSessionResponse,
  ReloadBuiltinBrowserSessionResponse,
  ResizeBuiltinBrowserSessionResponse,
  SelectBuiltinBrowserTabResponse
} from '@fastgpt/global/support/builtinBrowser/type';

// 鲁港通 - 云端调用超时：轮询与操作请求不让 Axios 默认 60 秒长时间挂起
const TABS_POLL_TIMEOUT_MS = 10 * 1000;
const CLOUD_ACTION_TIMEOUT_MS = 15 * 1000;

export const postOpenBuiltinBrowserSession = (data?: OpenBuiltinBrowserSessionRequest) =>
  POST<OpenBuiltinBrowserSessionResponse>('/proApi/builtin-browser/session', data);

export const putBuiltinBrowserViewport = (viewport: BuiltinBrowserViewport) =>
  PUT<ResizeBuiltinBrowserSessionResponse>(
    '/proApi/builtin-browser/session',
    { viewport },
    { timeout: CLOUD_ACTION_TIMEOUT_MS }
  );

export const patchBuiltinBrowserNavigate = (url: string) =>
  PATCH<NavigateBuiltinBrowserSessionResponse>(
    '/proApi/builtin-browser/session',
    { url },
    { timeout: CLOUD_ACTION_TIMEOUT_MS }
  );

export const getBuiltinBrowserSessionStatus = () =>
  GET<GetBuiltinBrowserSessionStatusResponse>('/proApi/builtin-browser/session');

export const postReloadBuiltinBrowserSession = () =>
  POST<ReloadBuiltinBrowserSessionResponse>(
    '/proApi/builtin-browser/reload',
    {},
    { timeout: CLOUD_ACTION_TIMEOUT_MS }
  );

export const deleteBuiltinBrowserSession = () =>
  DELETE<CloseBuiltinBrowserSessionResponse>('/proApi/builtin-browser/session');

export const getBuiltinBrowserTabs = () =>
  GET<GetBuiltinBrowserTabsResponse>(
    '/proApi/builtin-browser/tabs',
    {},
    { timeout: TABS_POLL_TIMEOUT_MS }
  );

export const postNewBuiltinBrowserTab = () =>
  POST<NewBuiltinBrowserTabResponse>(
    '/proApi/builtin-browser/tabs',
    {},
    { timeout: CLOUD_ACTION_TIMEOUT_MS }
  );

export const patchSelectBuiltinBrowserTab = (index: number) =>
  PATCH<SelectBuiltinBrowserTabResponse>(
    '/proApi/builtin-browser/tabs',
    { index },
    { timeout: CLOUD_ACTION_TIMEOUT_MS }
  );

export const deleteBuiltinBrowserTab = (index: number) =>
  DELETE<CloseBuiltinBrowserTabResponse>(
    '/proApi/builtin-browser/tabs',
    { index },
    { timeout: CLOUD_ACTION_TIMEOUT_MS }
  );
