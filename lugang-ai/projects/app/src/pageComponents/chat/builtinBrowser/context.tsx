// 鲁港通 - 办事浏览器面板上下文（内置浏览器 P1）：
// 仅聊天页挂载本上下文；入口按钮与右侧面板经它联动，无上下文的页面按钮自动隐藏
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
import { BUILTIN_BROWSER_ALLOWED_USERNAMES } from '@fastgpt/global/support/builtinBrowser/constant';
import { getBuiltinBrowserSessionStatus } from '@/web/support/builtinBrowser/api';
import { isPhoneUserAgent } from './device';

type BuiltinBrowserContextType = {
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
};

export const BuiltinBrowserContext = createContext<BuiltinBrowserContextType | null>(null);

const noopSubscribe = () => () => {};

// 鲁港通 - 可见性：非手机端 + 灰度名单（与后端校验一致，名单外用户完全不可见）。
// 手机（含未来手机 App 内嵌页）不开放；iPad/平板与 PC/Mac 桌面（网页与客户端）可用；
// useSyncExternalStore 保证 SSR/hydration 稳定（服务端快照为 false，客户端就绪后再判定）
export const useBuiltinBrowserVisible = () => {
  const isPhone = useSyncExternalStore(
    noopSubscribe,
    () => isPhoneUserAgent(navigator.userAgent),
    () => false
  );
  const username = useUserStore((s) => s.userInfo?.username);

  return !isPhone && !!username && BUILTIN_BROWSER_ALLOWED_USERNAMES.includes(username);
};

export const BuiltinBrowserProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isVisible = useBuiltinBrowserVisible();

  const openPanel = useCallback(() => setIsOpen(true), []);
  const closePanel = useCallback(() => setIsOpen(false), []);

  // 鲁港通 - 刷新/重进页面时若仍有进行中的会话，自动恢复面板（避免使用中的会话在界面不可见）
  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;
    getBuiltinBrowserSessionStatus()
      .then((res) => {
        if (!cancelled && res.active) setIsOpen(true);
      })
      .catch(() => {
        // 查询失败静默：用户点入口按钮时服务端会复用/重开
      });

    return () => {
      cancelled = true;
    };
  }, [isVisible]);

  const value = useMemo(
    () => ({ isOpen, openPanel, closePanel }),
    [isOpen, openPanel, closePanel]
  );

  return <BuiltinBrowserContext.Provider value={value}>{children}</BuiltinBrowserContext.Provider>;
};
