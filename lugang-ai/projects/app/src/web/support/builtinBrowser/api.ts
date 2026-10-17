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
  ResizeBuiltinBrowserSessionResponse,
  SelectBuiltinBrowserTabResponse
} from '@fastgpt/global/support/builtinBrowser/type';

export const postOpenBuiltinBrowserSession = (data?: OpenBuiltinBrowserSessionRequest) =>
  POST<OpenBuiltinBrowserSessionResponse>('/proApi/builtin-browser/session', data);

export const putBuiltinBrowserViewport = (viewport: BuiltinBrowserViewport) =>
  PUT<ResizeBuiltinBrowserSessionResponse>('/proApi/builtin-browser/session', { viewport });

export const patchBuiltinBrowserNavigate = (url: string) =>
  PATCH<NavigateBuiltinBrowserSessionResponse>('/proApi/builtin-browser/session', { url });

export const getBuiltinBrowserSessionStatus = () =>
  GET<GetBuiltinBrowserSessionStatusResponse>('/proApi/builtin-browser/session');

export const deleteBuiltinBrowserSession = () =>
  DELETE<CloseBuiltinBrowserSessionResponse>('/proApi/builtin-browser/session');

export const getBuiltinBrowserTabs = () =>
  GET<GetBuiltinBrowserTabsResponse>('/proApi/builtin-browser/tabs');

export const postNewBuiltinBrowserTab = () =>
  POST<NewBuiltinBrowserTabResponse>('/proApi/builtin-browser/tabs');

export const patchSelectBuiltinBrowserTab = (index: number) =>
  PATCH<SelectBuiltinBrowserTabResponse>('/proApi/builtin-browser/tabs', { index });

export const deleteBuiltinBrowserTab = (index: number) =>
  DELETE<CloseBuiltinBrowserTabResponse>('/proApi/builtin-browser/tabs', { index });
