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
import {
  isDesktopBridgeAvailable,
  type DesktopAiState,
  type DesktopBrowserState,
  type DesktopLibraryKind
} from './desktopBridge';
import { shouldAutoOpenPanel } from './panelSync';
import { canUseBuiltinBrowser } from './visibility';
import {
  consumeScenarioPrompt as consumeScenarioPromptState,
  initialScenarioPromptState,
  queueScenarioPrompt as queueScenarioPromptState
} from './scenario/queue';
import type { ScenarioFocus, ScenarioId, ScenarioPrompt } from './scenario/types';

// 鲁港通 - 继续修改的文件上下文：只带展示字段，实际路径留在主进程
export type LibraryFileContext = { name: string; kind: DesktopLibraryKind };

type BuiltinBrowserContextType = {
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  /** 鲁港通 - 打开右栏并切到资料库；nonce 递增让面板每次都收到显式切换 */
  openLibrary: () => void;
  libraryNonce: number;
  /** 鲁港通 - 打开请求是否还没被面板消费（面板未挂载时也保留，挂载即切库） */
  libraryRequestPending: boolean;
  consumeLibraryRequest: () => void;
  libraryFile: LibraryFileContext | null;
  setLibraryFile: (file: LibraryFileContext | null) => void;
  /** 鲁港通 - P2 场景模板：待发送的指令、面板聚焦请求与入口 */
  scenarioPrompt: ScenarioPrompt | null;
  scenarioFocus: ScenarioFocus | null;
  openScenario: (id?: ScenarioId) => void;
  consumeScenarioFocus: () => void;
  queueScenarioPrompt: (text: string) => void;
  consumeScenarioPrompt: () => void;
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
  const [libraryRequest, setLibraryRequest] = useState({ nonce: 0, pending: false });
  const [libraryFile, setLibraryFileState] = useState<LibraryFileContext | null>(null);
  const [scenarioPromptState, setScenarioPromptState] = useState(initialScenarioPromptState);
  const [scenarioFocus, setScenarioFocus] = useState<ScenarioFocus | null>(null);
  const isVisible = useBuiltinBrowserVisible();
  const isDesktop = useIsDesktopBridge();

  const openPanel = useCallback(() => setIsOpen(true), []);
  const closePanel = useCallback(() => setIsOpen(false), []);
  // 鲁港通 - 资料库入口：展开右栏并登记一次未消费的切库请求
  const openLibrary = useCallback(() => {
    setIsOpen(true);
    setLibraryRequest((value) => ({ nonce: value.nonce + 1, pending: true }));
  }, []);
  const consumeLibraryRequest = useCallback(() => {
    setLibraryRequest((value) => (value.pending ? { ...value, pending: false } : value));
  }, []);
  const setLibraryFile = useCallback((file: LibraryFileContext | null) => {
    setLibraryFileState(file);
  }, []);
  // 鲁港通 - 场景入口：展开面板并登记一次聚焦请求，面板消费后滚动到场景区
  const openScenario = useCallback((id?: ScenarioId) => {
    setIsOpen(true);
    setScenarioFocus((prev) => ({ nonce: (prev?.nonce ?? 0) + 1, id }));
  }, []);
  const consumeScenarioFocus = useCallback(() => setScenarioFocus(null), []);
  const queueScenarioPrompt = useCallback((text: string) => {
    setScenarioPromptState((prev) => queueScenarioPromptState(prev, text));
  }, []);
  const consumeScenarioPrompt = useCallback(() => {
    setScenarioPromptState((prev) => consumeScenarioPromptState(prev));
  }, []);

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

  // 鲁港通 - 订阅原生面板与 AI 状态：AI 自动打开面板时网页外壳同步铺开
  useEffect(() => {
    if (!isVisible || !isDesktop) return;
    const bridge = window.lugangDesktop;
    if (!bridge) return;

    let cancelled = false;
    const sync = (input: { browser?: DesktopBrowserState; ai?: DesktopAiState }) => {
      if (cancelled) return;
      setIsOpen((prev) => shouldAutoOpenPanel({ isOpen: prev, ...input }) || prev);
    };

    const unsubscribeBrowser = bridge.onStateChange((state) => sync({ browser: state }));
    const unsubscribeAi = bridge.ai.onStateChange((state) => sync({ ai: state }));
    void bridge.ai
      .getState()
      .then((state) => sync({ ai: state }))
      .catch(() => undefined);

    return () => {
      cancelled = true;
      unsubscribeBrowser();
      unsubscribeAi();
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
    () => ({
      isOpen,
      openPanel,
      closePanel,
      openLibrary,
      libraryNonce: libraryRequest.nonce,
      libraryRequestPending: libraryRequest.pending,
      consumeLibraryRequest,
      libraryFile,
      setLibraryFile,
      scenarioPrompt: scenarioPromptState.prompt,
      scenarioFocus,
      openScenario,
      consumeScenarioFocus,
      queueScenarioPrompt,
      consumeScenarioPrompt
    }),
    [
      isOpen,
      openPanel,
      closePanel,
      openLibrary,
      libraryRequest,
      consumeLibraryRequest,
      libraryFile,
      setLibraryFile,
      scenarioPromptState,
      scenarioFocus,
      openScenario,
      consumeScenarioFocus,
      queueScenarioPrompt,
      consumeScenarioPrompt
    ]
  );

  return <BuiltinBrowserContext.Provider value={value}>{children}</BuiltinBrowserContext.Provider>;
};
