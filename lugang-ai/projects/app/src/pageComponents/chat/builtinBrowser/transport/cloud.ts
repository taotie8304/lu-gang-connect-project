// 鲁港通 - 云端传输适配器：原办事浏览器接口的薄包装，行为保持不变
import {
  deleteBuiltinBrowserSession,
  deleteBuiltinBrowserTab,
  getBuiltinBrowserTabs,
  patchBuiltinBrowserNavigate,
  patchSelectBuiltinBrowserTab,
  postNewBuiltinBrowserTab,
  postOpenBuiltinBrowserSession,
  postReloadBuiltinBrowserSession,
  putBuiltinBrowserViewport
} from '@/web/support/builtinBrowser/api';
import type { BuiltinBrowserTransport } from './type';

export const createCloudTransport = (): BuiltinBrowserTransport => ({
  kind: 'cloud',
  usesNativeView: false,
  open: async (viewport) => {
    const res = await postOpenBuiltinBrowserSession({ viewport });
    return { resourceUrl: res.resourceUrl, expiresAt: res.expiresAt };
  },
  close: async () => {
    await deleteBuiltinBrowserSession();
  },
  reload: async () => {
    const res = await postReloadBuiltinBrowserSession();
    return res.reloaded;
  },
  navigate: async (url) => {
    const res = await patchBuiltinBrowserNavigate(url);
    return res.navigated;
  },
  resize: async (viewport) => {
    // 鲁港通 - 真实接口签名直接接收视口对象，内部再包成 { viewport } 请求体
    const res = await putBuiltinBrowserViewport(viewport);
    return res.resized;
  },
  listTabs: async () => {
    const res = await getBuiltinBrowserTabs();
    return res.tabs;
  },
  createTab: async () => {
    const res = await postNewBuiltinBrowserTab();
    return res.tabs;
  },
  switchTab: async (index) => {
    const res = await patchSelectBuiltinBrowserTab(index);
    return { selected: res.selected, tabs: res.tabs };
  },
  closeTab: async (index) => {
    const res = await deleteBuiltinBrowserTab(index);
    return { closed: res.closed, tabs: res.tabs };
  }
});
