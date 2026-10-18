// 鲁港通 - 办事浏览器面板上下文（内置浏览器 P1）：
// 网页端仅灰度名单可见；桌面客户端登录用户均可见，并在离开聊天页时释放本地浏览器
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode
} from 'react';
import { useUserStore } from '@/web/support/user/useUserStore';
import { getBuiltinBrowserSessionStatus } from '@/web/support/builtinBrowser/api';
import { isPhoneUserAgent } from './device';
import { isDesktopBridgeAvailable } from './desktopBridge';
import { canUseBuiltinBrowser } from './visibility';

type BuiltinBrowserContextType = {
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
};

export const BuiltinBrowserContext = createContext<BuiltinBrowserContextType | null>(null);

const noopSubscribe = () => () => {};

// 鲁港通 - 桌面桥可用性在客户端生命周期内不变，用同步外部 store 保证 SSR/hydration 稳定
export const useIsDesktopBridge = () =>
  useSyncExternalStore(noopSubscribe, () => isDesktopBridgeAvailable(), () => false);

export const useBuiltinBrowserVisible = () => {
  const isPhone = useSyncExternalStore(
    noopSubscribe,
    () => isPhoneUserAgent(navigator.userAgent),
    () => false
  );
  const isDesktop = useIsDesktopBridge();
  const username = useUserStore((s) => s.userInfo?.username);

  return canUseBuiltinBrowser({ isPhone, username, isDesktop });
};

export const BuiltinBrowserProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isVisible = useBuiltinBrowserVisible();
  const isDesktop = useIsDesktopBridge();

  const openPanel = useCallback(() => setIsOpen(true), []);
  const closePanel = useCallback(() => setIsOpen(false), []);

  // 鲁港通 - 刷新/重进页面时恢复面板：桌面读本地视图状态，网页读云端会话状态
  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;
    const restore = async () => {
      try {
        if (isDesktop) {
          const state = await window.lugangDesktop?.getState();
          if (!cancelled && state?.panelOpen) setIsOpen(true);
          return;
        }
        const res = await getBuiltinBrowserSessionStatus();
        if (!cancelled && res.active) setIsOpen(true);
      } catch {
        // 鲁港通 - 查询失败静默：用户点入口按钮时会重新打开
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [isVisible, isDesktop]);

  // 鲁港通 - 离开聊天页销毁本地浏览器视图（云端会话由服务端巡检回收）
  useEffect(() => {
    if (!isDesktop) return;
    return () => {
      void window.lugangDesktop?.closePanel().catch(() => undefined);
    };
  }, [isDesktop]);

  const value = useMemo(
    () => ({ isOpen, openPanel, closePanel }),
    [isOpen, openPanel, closePanel]
  );

  return <BuiltinBrowserContext.Provider value={value}>{children}</BuiltinBrowserContext.Provider>;
};
