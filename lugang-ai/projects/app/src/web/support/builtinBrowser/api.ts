// 鲁港通 - 办事浏览器前端接口（内置浏览器 P1）
import { DELETE, GET, POST, PUT } from '@/web/common/api/request';
import type {
  BuiltinBrowserViewport,
  CloseBuiltinBrowserSessionResponse,
  GetBuiltinBrowserSessionStatusResponse,
  OpenBuiltinBrowserSessionRequest,
  OpenBuiltinBrowserSessionResponse,
  ResizeBuiltinBrowserSessionResponse
} from '@fastgpt/global/support/builtinBrowser/type';

export const postOpenBuiltinBrowserSession = (data?: OpenBuiltinBrowserSessionRequest) =>
  POST<OpenBuiltinBrowserSessionResponse>('/proApi/builtin-browser/session', data);

export const putBuiltinBrowserViewport = (viewport: BuiltinBrowserViewport) =>
  PUT<ResizeBuiltinBrowserSessionResponse>('/proApi/builtin-browser/session', { viewport });

export const getBuiltinBrowserSessionStatus = () =>
  GET<GetBuiltinBrowserSessionStatusResponse>('/proApi/builtin-browser/session');

export const deleteBuiltinBrowserSession = () =>
  DELETE<CloseBuiltinBrowserSessionResponse>('/proApi/builtin-browser/session');
