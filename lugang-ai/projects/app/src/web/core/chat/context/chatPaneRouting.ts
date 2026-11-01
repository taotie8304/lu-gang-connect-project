// 鲁港通 - 聊天面板落点判定：必须用地址栏实时 appId 做幂等比较
// 浅路由不会刷新 SSR props，沿用旧 props 会判定失败并无限 replace（触发 NProgress 常驻与话题无法加载）
import { ChatSidebarPaneEnum } from '@/pageComponents/chat/constants';

export type ChatPaneRedirectInput = {
  isPlus: boolean;
  isRoot: boolean;
  /** 普通用户允许落地的默认助手应用 ID；为空表示不做限制 */
  defaultAppId: string;
  pane: string | undefined;
  /** 地址栏实时 appId */
  queryAppId: string | undefined;
};

export type ChatPaneRedirect = {
  pane: ChatSidebarPaneEnum;
  appId: string;
};

const isSidebarPane = (pane: string): pane is ChatSidebarPaneEnum =>
  (Object.values(ChatSidebarPaneEnum) as string[]).includes(pane);

export const resolveChatPaneRedirect = ({
  isPlus,
  isRoot,
  defaultAppId,
  pane,
  queryAppId
}: ChatPaneRedirectInput): ChatPaneRedirect | null => {
  const restrictedDefaultAppId = !isPlus && !isRoot ? defaultAppId : '';

  if (!pane || !isSidebarPane(pane)) {
    if (restrictedDefaultAppId) {
      return {
        pane: ChatSidebarPaneEnum.RECENTLY_USED_APPS,
        appId: queryAppId || restrictedDefaultAppId
      };
    }
    return { pane: isPlus ? ChatSidebarPaneEnum.HOME : ChatSidebarPaneEnum.ALL_APPS, appId: '' };
  }

  if (isPlus) return null;

  if (restrictedDefaultAppId) {
    // 已落在默认面板且应用已就绪时不再跳转，否则浅路由每次都会重新触发
    if (pane !== ChatSidebarPaneEnum.RECENTLY_USED_APPS || !queryAppId) {
      return {
        pane: ChatSidebarPaneEnum.RECENTLY_USED_APPS,
        appId: queryAppId || restrictedDefaultAppId
      };
    }
    return null;
  }

  if (![ChatSidebarPaneEnum.ALL_APPS, ChatSidebarPaneEnum.RECENTLY_USED_APPS].includes(pane)) {
    return { pane: ChatSidebarPaneEnum.ALL_APPS, appId: '' };
  }

  return null;
};
