// 鲁港通 - 办事浏览器右栏面板（内置浏览器 P1）：
// 聊天页右侧内嵌浏览器画面（PC 端），用户可随时接管键鼠操作；
// 画面按云端查看器实测几何裁切，只显示浏览器页面本身（豆包式固定画面，不可拖动、不可移动）；
// 面板左缘可拖拽调宽（宽度本地记忆），网址栏可手动输入网址让云端浏览器跳转；
// 关闭面板即结束本次使用（释放云端会话）；单次时长上限由服务端控制，临近上限本地提醒
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Box, Button, Flex, Input, Text } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import PageContainer from '@/components/PageContainer';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import { getErrText } from '@fastgpt/global/common/error/utils';
import {
  BUILTIN_BROWSER_CROP_LEFT_PX,
  BUILTIN_BROWSER_CROP_TOP_PX,
  BUILTIN_BROWSER_MAX_TABS,
  BUILTIN_BROWSER_PANEL_DEFAULT_WIDTH,
  BUILTIN_BROWSER_PANEL_RESIZE_HIT_PX,
  BUILTIN_BROWSER_PANEL_WIDTH_STORAGE_KEY,
  BUILTIN_BROWSER_REMIND_BEFORE_MINUTES
} from '@fastgpt/global/support/builtinBrowser/constant';
import { clampBuiltinBrowserPanelWidth } from '@fastgpt/global/support/builtinBrowser/panelWidth';
import type {
  BuiltinBrowserTab,
  BuiltinBrowserViewport
} from '@fastgpt/global/support/builtinBrowser/type';
import { normalizeBuiltinBrowserUrl } from '@fastgpt/global/support/builtinBrowser/url';
import { createBuiltinBrowserTransport } from './transport';
import { usePageOverlayOpen } from './usePageOverlayOpen';
import { BuiltinBrowserContext, useBuiltinBrowserVisible } from './context';
import { createTabRefreshScheduler } from './polling';
import { resolveBuiltinBrowserAiBadge } from './aiStatus';
import type {
  DesktopAiState,
  DesktopDocumentSnapshot,
  DesktopDocumentSummary
} from './desktopBridge';
import { resolveActiveDocToken, resolveDocPanelView } from './documentTabs';
import DocumentPreviewPanel, { DocumentFormatChip } from './documentPreview';
import { LG } from '@/pageComponents/chat/lugangTheme';

const MINUTE_MS = 60 * 1000;
const COUNTDOWN_TICK_MS = 30 * 1000;
// 鲁港通 - 窗口拉伸/缩放后延迟 600ms 再同步云端视口，避免拖动过程连发请求
const VIEWPORT_FOLLOW_DEBOUNCE_MS = 600;
// 鲁港通 - 开台超过 5 秒追加「首次准备较慢」提示，避免用户误以为卡死
const LOADING_SLOW_HINT_MS = 5 * 1000;
// 鲁港通 - 面板窄于该宽度时头部隐藏剩余时间文案（英文/韩文更长，防挤压标题与按钮）
const HEADER_HIDE_REMAINING_WIDTH = 420;

// 鲁港通 - 面板宽度本地记忆：读取时非法值回落默认，并按当前窗口宽度收敛
const readStoredPanelWidth = () => {
  if (typeof window === 'undefined') return BUILTIN_BROWSER_PANEL_DEFAULT_WIDTH;
  try {
    const stored = Number.parseInt(
      window.localStorage.getItem(BUILTIN_BROWSER_PANEL_WIDTH_STORAGE_KEY) ?? '',
      10
    );
    return clampBuiltinBrowserPanelWidth(
      Number.isFinite(stored) ? stored : BUILTIN_BROWSER_PANEL_DEFAULT_WIDTH,
      window.innerWidth
    );
  } catch {
    return clampBuiltinBrowserPanelWidth(BUILTIN_BROWSER_PANEL_DEFAULT_WIDTH, window.innerWidth);
  }
};

type BuiltinBrowserSessionState = {
  resourceUrl: string;
  expiresAt: string;
};

const BuiltinBrowserPanelBody = ({
  panelWidth,
  isResizing
}: {
  panelWidth: number;
  isResizing: boolean;
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { openConfirm, ConfirmModal } = useConfirm({ type: 'common' });
  const builtinBrowser = useContext(BuiltinBrowserContext);

  const [status, setStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [session, setSession] = useState<BuiltinBrowserSessionState>();
  const [errorMessage, setErrorMessage] = useState('');
  const [remainingMs, setRemainingMs] = useState<number>();
  const [urlInput, setUrlInput] = useState('');
  const [tabs, setTabs] = useState<BuiltinBrowserTab[]>([]);
  const [loadingSlow, setLoadingSlow] = useState(false);
  const [aiState, setAiState] = useState<DesktopAiState>();
  const [isStoppingAi, setIsStoppingAi] = useState(false);
  const [docTabs, setDocTabs] = useState<DesktopDocumentSummary[]>([]);
  const [activeDocToken, setActiveDocToken] = useState<string | null>(null);
  // 鲁港通 - 快照带 token 缓存：切换文件时旧快照自然失效，无需在 effect 里清空
  const [docSnapshotCache, setDocSnapshotCache] = useState<{
    token: string;
    snapshot: DesktopDocumentSnapshot;
  } | null>(null);
  const [docBusy, setDocBusy] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const urlEditingRef = useRef(false);
  // 鲁港通 - 开台期间输入的网址先排队，会话就绪后自动打开
  const pendingNavigateRef = useRef<string>();
  const isResizingRef = useRef(isResizing);
  const freezeRef = useRef<{ width: number; height: number; panelWidth: number } | null>(null);
  const [frozenFrame, setFrozenFrame] = useState<{
    width: number;
    height: number;
    panelWidth: number;
  } | null>(null);
  const tabsSchedulerRef = useRef<ReturnType<typeof createTabRefreshScheduler>>();

  // 鲁港通 - 桌面桥可用时走本地浏览器，否则保持云端 AgentBay
  const transport = useMemo(() => createBuiltinBrowserTransport(), []);
  const isNative = transport.usesNativeView;
  const hasPageOverlay = usePageOverlayOpen();
  const tabsFull = tabs.length >= BUILTIN_BROWSER_MAX_TABS;
  // 鲁港通 - 文件预览桥只在新版桌面客户端存在，老客户端据此隐藏本地文件入口
  const documents = useMemo(
    () => (typeof window === 'undefined' ? undefined : window.lugangDesktop?.documents),
    []
  );
  const currentTabUrl = tabs.find((tab) => tab.current)?.url;
  const panelView = resolveDocPanelView({ activeDocToken, status, currentTabUrl });

  const { runAsync: openSession } = useRequest(transport.open, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: closeSession } = useRequest(transport.close, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: resizeViewport } = useRequest(transport.resize, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: navigateSession, loading: isNavigating } = useRequest(transport.navigate, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: fetchTabs } = useRequest(transport.listTabs, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: createTab } = useRequest(transport.createTab, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: selectTab } = useRequest(transport.switchTab, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: closeTab } = useRequest(transport.closeTab, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: reloadPage, loading: isReloading } = useRequest(transport.reload, {
    manual: true,
    errorToast: ''
  });

  const isOpen = builtinBrowser?.isOpen ?? false;

  // 鲁港通 - 实测面板内容区尺寸作为云端视口（面板未就绪时返回 undefined，服务端按默认尺寸）
  const measureViewport = useCallback((): BuiltinBrowserViewport | undefined => {
    const el = bodyRef.current;
    if (!el || !el.clientWidth || !el.clientHeight) return undefined;
    return { width: el.clientWidth, height: el.clientHeight };
  }, []);

  // 鲁港通 - 开台/复用请求：云端携带面板视口；本地仅打开原生面板
  const requestOpenSession = useCallback(
    () =>
      openSession(measureViewport())
        .then((res) => {
          if (res.resourceUrl && res.expiresAt) {
            setSession({ resourceUrl: res.resourceUrl, expiresAt: res.expiresAt });
          }
          setStatus('active');
        })
        .catch((err) => {
          setStatus('error');
          setErrorMessage(t(getErrText(err, 'common:builtin_browser_open_failed') as any));
        }),
    [openSession, measureViewport, t]
  );

  // 鲁港通 - 刷新/重试入口（事件处理器）：先回到加载态再重新请求
  const loadSession = useCallback(() => {
    setStatus('loading');
    setLoadingSlow(false);
    setErrorMessage('');
    return requestOpenSession();
  }, [requestOpenSession]);

  // 鲁港通 - 打开面板即开台；已有进行中的会话时服务端直接复用（不重复建台）
  useEffect(() => {
    void requestOpenSession();
  }, [requestOpenSession]);

  // 鲁港通 - 把右栏当前文件标签同步给主进程，AI 读取时优先读这份文件
  useEffect(() => {
    if (!documents?.setActive) return;
    documents.setActive(activeDocToken);
    return () => {
      documents.setActive?.(null);
    };
  }, [documents, activeDocToken]);

  const showTabActionFailed = useCallback(
    (err?: unknown) => {
      toast({
        title: err
          ? t(getErrText(err, 'common:builtin_browser_tab_action_failed') as any)
          : t('common:builtin_browser_tab_action_failed'),
        status: 'warning'
      });
    },
    [t, toast]
  );

  // 鲁港通 - 标签标题：优先页面标题，空白页给可读占位，无标题时退回域名
  const tabLabel = useCallback(
    (tab: BuiltinBrowserTab) => {
      if (tab.title) return tab.title;
      if (!tab.url || tab.url === 'about:blank') {
        return t('common:builtin_browser_tab_untitled');
      }
      try {
        return new URL(tab.url).hostname;
      } catch {
        return tab.url;
      }
    },
    [t]
  );

  const applyTabs = useCallback((nextTabs: BuiltinBrowserTab[]) => {
    setTabs(nextTabs);
    // 鲁港通 - 用户正在输入或首跳排队中：不覆盖网址栏，避免排队的目标被轮询清掉
    if (urlEditingRef.current || pendingNavigateRef.current) return;
    const current = nextTabs.find((tab) => tab.current);
    setUrlInput(current && current.url !== 'about:blank' ? current.url : '');
  }, []);

  const refreshTabs = useCallback(async (): Promise<boolean> => {
    try {
      applyTabs(await fetchTabs());
      return true;
    } catch {
      // 轮询失败由调度器退避重试
      return false;
    }
  }, [fetchTabs, applyTabs]);

  // 鲁港通 - 标签轮询：单飞 + 失败退避 + 页面隐藏暂停，避免慢调用堆叠占满连接池拖死整页
  useEffect(() => {
    if (status !== 'active' || transport.subscribe) return;

    const scheduler = createTabRefreshScheduler({
      refresh: refreshTabs,
      isPaused: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
      onSlow: (elapsedMs) => {
        console.warn(`[builtin-browser] slow tabs refresh ${elapsedMs}ms`);
      }
    });
    tabsSchedulerRef.current = scheduler;
    scheduler.start();

    // 页面回到前台时立即对齐一次，不必等下一个轮询周期
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void scheduler.trigger();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      scheduler.stop();
      if (tabsSchedulerRef.current === scheduler) {
        tabsSchedulerRef.current = undefined;
      }
    };
  }, [status, refreshTabs, transport]);

  // 鲁港通 - 本地浏览器由主进程推送状态：订阅后先拉一次，保证首屏标签可用
  useEffect(() => {
    if (status !== 'active' || !transport.subscribe) return;
    const unsubscribe = transport.subscribe((nextTabs) => applyTabs(nextTabs));
    // 鲁港通 - 首屏标签补齐延后一拍，避免在 effect 内同步触发状态更新
    const timer = setTimeout(() => void refreshTabs(), 0);
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [status, transport, applyTabs, refreshTabs]);

  // 鲁港通 - 桌面模式订阅 AI 工作状态：面板头部据此显示「AI 正在操作」与停止按钮
  useEffect(() => {
    if (!isNative || typeof window === 'undefined') return;
    const ai = window.lugangDesktop?.ai;
    if (!ai) return;

    let cancelled = false;
    void ai
      .getState()
      .then((state) => {
        if (!cancelled) setAiState(state);
      })
      .catch(() => undefined);
    const unsubscribe = ai.onStateChange((state) => setAiState(state));

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isNative]);

  // 鲁港通 - 打开面板补一次设备同步：应用启动时网络未就绪导致注册失败，重开面板即可恢复接收指令
  useEffect(() => {
    if (!isNative || typeof window === 'undefined') return;
    const session = window.lugangDesktop?.session;
    void session?.sync().catch(() => undefined);
  }, [isNative]);

  // 鲁港通 - 列表推送同时维护激活文件：仍在列表则保持，否则接管最近一个待确认的文件
  const applyDocTabs = useCallback((list: DesktopDocumentSummary[]) => {
    setDocTabs(list);
    setActiveDocToken((current) => resolveActiveDocToken(list, current));
  }, []);

  // 鲁港通 - 文件标签：订阅主进程的会话摘要推送，挂载后先拉一次
  useEffect(() => {
    if (!documents) return;
    let cancelled = false;
    void documents
      .list()
      .then((list) => {
        if (!cancelled) applyDocTabs(list);
      })
      .catch(() => undefined);
    const unsubscribe = documents.onChanged(applyDocTabs);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [documents, applyDocTabs]);

  const activeDocSummary = useMemo(
    () => docTabs.find((item) => item.token === activeDocToken),
    [docTabs, activeDocToken]
  );
  const activeDocState = activeDocSummary?.state;
  const docSnapshot =
    docSnapshotCache?.token === activeDocToken ? docSnapshotCache.snapshot : null;

  // 鲁港通 - 拉取激活文件的完整快照；待确认会话先认领，避免 2 秒后回退旧确认窗
  useEffect(() => {
    if (!documents || !activeDocToken) return;
    const token = activeDocToken;
    let cancelled = false;
    void (async () => {
      try {
        const snapshot =
          activeDocState === 'pending'
            ? await documents.claim(token)
            : await documents.get(token);
        if (cancelled) return;
        setDocSnapshotCache(snapshot ? { token, snapshot } : null);
      } catch {
        if (!cancelled) setDocSnapshotCache(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documents, activeDocToken, activeDocState]);

  // 鲁港通 - 面板一打开就聚焦网址栏：开台等待期间即可输入网址，就绪后自动打开
  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  // 鲁港通 - 空白落地页出现时也聚焦网址输入框，用户可直接输入
  useEffect(() => {
    if (panelView === 'landing') urlInputRef.current?.focus();
  }, [panelView]);

  // 鲁港通 - 开台超过 5 秒追加分步提示，让用户知道仍在准备而非卡死
  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setLoadingSlow(true), LOADING_SLOW_HINT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // 鲁港通 - 新建标签：云端选中新空白页，前端同步标签条并聚焦网址栏
  const handleNewTab = useCallback(async () => {
    if (tabsFull) return;
    setActiveDocToken(null);
    try {
      applyTabs(await createTab());
      urlEditingRef.current = false;
      urlInputRef.current?.focus();
    } catch (err) {
      showTabActionFailed(err);
    }
  }, [applyTabs, createTab, showTabActionFailed, tabsFull]);

  const handleSelectTab = useCallback(
    async (index: number) => {
      setActiveDocToken(null);
      try {
        const res = await selectTab(index);
        applyTabs(res.tabs);
        if (!res.selected) {
          showTabActionFailed();
        }
      } catch (err) {
        showTabActionFailed(err);
      }
    },
    [applyTabs, selectTab, showTabActionFailed]
  );

  const handleCloseTab = useCallback(
    async (index: number) => {
      try {
        const res = await closeTab(index);
        applyTabs(res.tabs);
        if (!res.closed) {
          showTabActionFailed();
        }
      } catch (err) {
        showTabActionFailed(err);
      }
    },
    [applyTabs, closeTab, showTabActionFailed]
  );

  // 鲁港通 - 文件标签：关闭后立即移出标签条，未完成的确认按放弃处理
  const handleCloseDocTab = useCallback(
    async (token: string) => {
      if (!documents) return;
      try {
        await documents.close(token);
      } catch {
        // 会话可能已结束，关闭是幂等的
      }
      setDocTabs((prev) => prev.filter((item) => item.token !== token));
      setActiveDocToken((current) => (current === token ? null : current));
    },
    [documents]
  );

  // 鲁港通 - 选择本地文件：主进程弹原生选择框，文件全程只在本机解析、不上传
  const handlePickLocalDoc = useCallback(async () => {
    if (!documents || docBusy) return;
    setDocBusy(true);
    try {
      const snapshot = await documents.openLocal();
      if (!snapshot) return;
      applyDocTabs(await documents.list());
      setActiveDocToken(snapshot.token);
      setDocSnapshotCache({ token: snapshot.token, snapshot });
    } catch (err) {
      toast({
        title: t(getErrText(err, 'common:builtin_browser_doc_pick_failed') as any),
        status: 'warning'
      });
    } finally {
      setDocBusy(false);
    }
  }, [documents, docBusy, applyDocTabs, t, toast]);

  const handleDecideDoc = useCallback(
    async (index: number, decision: 'apply' | 'skip') => {
      if (!documents || !activeDocToken || docBusy) return;
      setDocBusy(true);
      try {
        const snapshot = await documents.decide(activeDocToken, index, decision);
        if (snapshot) setDocSnapshotCache({ token: activeDocToken, snapshot });
      } catch (err) {
        toast({
          title: t(getErrText(err, 'common:builtin_browser_doc_action_failed') as any),
          status: 'warning'
        });
      } finally {
        setDocBusy(false);
      }
    },
    [documents, activeDocToken, docBusy, t, toast]
  );

  const handleApplyAllDoc = useCallback(async () => {
    if (!documents || !activeDocToken || docBusy) return;
    setDocBusy(true);
    try {
      const snapshot = await documents.applyAll(activeDocToken);
      if (snapshot) setDocSnapshotCache({ token: activeDocToken, snapshot });
    } catch (err) {
      toast({
        title: t(getErrText(err, 'common:builtin_browser_doc_action_failed') as any),
        status: 'warning'
      });
    } finally {
      setDocBusy(false);
    }
  }, [documents, activeDocToken, docBusy, t, toast]);

  const handleOpenCopyDoc = useCallback(async () => {
    if (!documents || !activeDocToken) return;
    try {
      const opened = await documents.openCopy(activeDocToken);
      if (!opened) {
        toast({ title: t('common:builtin_browser_doc_open_copy_failed'), status: 'warning' });
      }
    } catch (err) {
      toast({
        title: t(getErrText(err, 'common:builtin_browser_doc_open_copy_failed') as any),
        status: 'warning'
      });
    }
  }, [documents, activeDocToken, t, toast]);

  // 鲁港通 - PDF 回退：交回系统默认程序打开原文件，老客户端没有此能力时给出提示
  const handleOpenExternalDoc = useCallback(async () => {
    if (!documents || !activeDocToken) return;
    try {
      const opened = await documents.openExternal?.(activeDocToken);
      if (!opened) {
        toast({ title: t('common:builtin_browser_doc_pdf_open_failed'), status: 'warning' });
      }
    } catch (err) {
      toast({
        title: t(getErrText(err, 'common:builtin_browser_doc_pdf_open_failed') as any),
        status: 'warning'
      });
    }
  }, [documents, activeDocToken, t, toast]);

  const expiresAtMs = session ? new Date(session.expiresAt).getTime() : undefined;

  // 鲁港通 - 本地倒计时展示剩余时长；到点自动收起面板（云端会话由服务端巡检回收）
  useEffect(() => {
    if (status !== 'active' || !expiresAtMs) return;

    const tick = () => {
      const left = expiresAtMs - Date.now();
      setRemainingMs(Math.max(0, left));
      if (left <= 0) {
        builtinBrowser?.closePanel();
        toast({
          title: t('common:builtin_browser_expired'),
          status: 'warning'
        });
      }
    };

    tick();
    const timer = setInterval(tick, COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, [status, expiresAtMs, builtinBrowser, t, toast]);

  // 鲁港通 - 本地浏览器：把面板 Body 的 CSS 矩形同步给主进程，主进程换算 DIP 后贴合视图
  useEffect(() => {
    if (status !== 'active' || !transport.usesNativeView) return;
    const el = bodyRef.current;
    if (!el) return;

    let frame: number | undefined;
    const sync = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        transport.syncBounds?.({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        });
      });
    };

    const observer = new ResizeObserver(sync);
    observer.observe(el);
    window.addEventListener('resize', sync);
    sync();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', sync);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [status, transport]);

  // 鲁港通 - 拖拽/模态层/面板收起/落地页与文件预览时隐藏原生视图，避免遮挡应用 UI
  useEffect(() => {
    if (!transport.usesNativeView) return;
    transport.setViewVisible?.(
      status === 'active' && panelView === 'browser' && !isResizing && !hasPageOverlay
    );
  }, [transport, status, panelView, isResizing, hasPageOverlay]);

  useEffect(() => {
    if (!transport.usesNativeView) return;
    return () => {
      transport.setViewVisible?.(false);
    };
  }, [transport]);

  // 鲁港通 - 尺寸即时跟随：窗口拉伸/缩放后防抖同步云端视口，让画面持续贴合面板
  useEffect(() => {
    if (status !== 'active' || transport.usesNativeView) return;
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSize = { width: el.clientWidth, height: el.clientHeight };

    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width === lastSize.width && height === lastSize.height) return;
      lastSize = { width, height };
      // 鲁港通 - 拖拽调宽/冻结期间不连发云端 resize：松手后由冻结逻辑按最终尺寸统一贴合
      if (isResizingRef.current || freezeRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // 兜底复查：拖动中即使首个尺寸事件早于冻结状态落定，也不在拖动期间请求云端
        if (isResizingRef.current || freezeRef.current) return;
        const viewport = measureViewport();
        if (viewport) void resizeViewport(viewport).catch(() => undefined);
      }, VIEWPORT_FOLLOW_DEBOUNCE_MS);
    });
    observer.observe(el);

    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [status, measureViewport, resizeViewport, transport.usesNativeView]);

  // 鲁港通 - 拖拽调宽期间冻结画面：保留拖拽前的画面像素尺寸并横向拉伸填充面板，
  // 云端画面尺寸不变，查看器不会露出深色底；松手后按最终尺寸贴合云端，完成再解除冻结
  useEffect(() => {
    if (transport.usesNativeView) return;
    isResizingRef.current = isResizing;
    if (isResizing) {
      const el = bodyRef.current;
      if (!freezeRef.current && el && el.clientWidth && el.clientHeight) {
        const frame = { width: el.clientWidth, height: el.clientHeight, panelWidth };
        freezeRef.current = frame;
        setFrozenFrame(frame);
      }
      return;
    }
    if (!freezeRef.current) return;

    let cancelled = false;
    const viewport = measureViewport();
    const sizeChanged =
      !viewport ||
      viewport.width !== freezeRef.current.width ||
      viewport.height !== freezeRef.current.height;

    void (async () => {
      // 点击手柄未拖动时尺寸未变：无需再请求云端
      if (sizeChanged && viewport) {
        await resizeViewport(viewport).catch(() => undefined);
      }
      if (cancelled) return;
      freezeRef.current = null;
      setFrozenFrame(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [isResizing, panelWidth, measureViewport, resizeViewport, transport.usesNativeView]);

  // 鲁港通 - 重新贴合画面：画面与面板出现错位/深色底时的手动自愈入口
  const handleRefit = useCallback(async () => {
    const viewport = measureViewport();
    if (!viewport) return;
    try {
      const resized = await resizeViewport(viewport);
      if (!resized) {
        toast({ title: t('common:builtin_browser_refit_failed'), status: 'warning' });
      }
    } catch (err) {
      toast({
        title: t(getErrText(err, 'common:builtin_browser_refit_failed') as any),
        status: 'warning'
      });
    }
  }, [measureViewport, resizeViewport, t, toast]);

  // 鲁港通 - 网址跳转共用逻辑：当前会话直接跳转，排队首跳就绪后也走这里；
  // 云端跳转是异步的，面板画面会随远端页面刷新，前端无需重载
  const navigateTo = useCallback(
    async (target: string) => {
      try {
        const navigated = await navigateSession(target);
        if (!navigated) {
          toast({ title: t('common:builtin_browser_url_open_failed'), status: 'warning' });
          return;
        }
        setUrlInput(target);
        void tabsSchedulerRef.current?.trigger();
      } catch (err) {
        toast({
          title: t(getErrText(err, 'common:builtin_browser_url_open_failed') as any),
          status: 'warning'
        });
      }
    },
    [navigateSession, t, toast]
  );

  // 鲁港通 - 开台期间排队的网址：会话就绪后自动打开，用户不必等加载完再输入一次
  useEffect(() => {
    if (status !== 'active') return;
    const pending = pendingNavigateRef.current;
    if (!pending) return;
    void navigateTo(pending).finally(() => {
      if (pendingNavigateRef.current === pending) {
        pendingNavigateRef.current = undefined;
      }
    });
  }, [status, navigateTo]);

  // 鲁港通 - 网址栏跳转：先本地归一化校验（与服务端同一工具），失败给可操作提示；
  // 加载中回车则先排队，浏览器就绪后自动打开
  const handleNavigate = useCallback(async () => {
    const target = normalizeBuiltinBrowserUrl(urlInput);
    if (!target) {
      toast({ title: t('common:builtin_browser_url_invalid'), status: 'warning' });
      return;
    }
    if (status !== 'active') {
      pendingNavigateRef.current = target;
      setUrlInput(target);
      toast({ title: t('common:builtin_browser_url_queued'), status: 'info' });
      return;
    }
    await navigateTo(target);
  }, [status, urlInput, navigateTo, t, toast]);

  // 鲁港通 - 刷新网页：只重新加载当前页面，不重连查看器；失败时兜底重连一次会话
  const handleReload = useCallback(async () => {
    if (isReloading) return;
    try {
      const reloaded = await reloadPage();
      if (!reloaded) {
        toast({ title: t('common:builtin_browser_reload_failed'), status: 'warning' });
        // 鲁港通 - 云端会话可能已被回收：复用开台入口恢复画面；本地由错误页提供重试
        if (!transport.usesNativeView) void loadSession();
        return;
      }
      void tabsSchedulerRef.current?.trigger();
    } catch (err) {
      toast({
        title: t(getErrText(err, 'common:builtin_browser_reload_failed') as any),
        status: 'warning'
      });
    }
  }, [isReloading, reloadPage, loadSession, t, toast, transport.usesNativeView]);

  // 鲁港通 - 停止 AI：主进程先终止在途动作并立即回传停止结果，用户不必等当前指令跑完
  const handleStopAi = useCallback(async () => {
    if (isStoppingAi) return;
    const ai = window.lugangDesktop?.ai;
    if (!ai) return;

    setIsStoppingAi(true);
    try {
      setAiState(await ai.stop());
    } catch (err) {
      toast({
        title: t(getErrText(err, 'common:builtin_browser_ai_stop_failed') as any),
        status: 'warning'
      });
    } finally {
      setIsStoppingAi(false);
    }
  }, [isStoppingAi, t, toast]);

  // 鲁港通 - 关闭面板 = 结束本次使用：确认后释放云端会话，防误关与误占用
  const handleClose = useCallback(() => {
    const endSession = async () => {
      try {
        await closeSession();
      } catch {
        // 关台接口幂等；失败时由服务端巡检兜底回收，不阻塞用户关闭面板
      }
      builtinBrowser?.closePanel();
    };

    if (status !== 'active') {
      void endSession();
      return;
    }

    openConfirm({
      customContent: t(
        isNative
          ? 'common:builtin_browser_close_confirm_local'
          : 'common:builtin_browser_close_confirm'
      ),
      confirmText: t('common:builtin_browser_close'),
      onConfirm: endSession
    })();
  }, [status, openConfirm, t, closeSession, builtinBrowser, isNative]);

  if (!isOpen) return null;

  const remainingMinutes =
    remainingMs === undefined ? undefined : Math.max(1, Math.ceil(remainingMs / MINUTE_MS));
  const isExpiringSoon =
    remainingMs !== undefined && remainingMs <= BUILTIN_BROWSER_REMIND_BEFORE_MINUTES * MINUTE_MS;
  const showRemaining = panelWidth >= HEADER_HIDE_REMAINING_WIDTH;
  // 鲁港通 - 窄面板只留状态圆点，给停止按钮和标题让位（悬停仍可看到完整状态）
  const showAiBadgeLabel = panelWidth >= HEADER_HIDE_REMAINING_WIDTH;
  const frozenScaleX =
    frozenFrame && frozenFrame.panelWidth > 0 ? panelWidth / frozenFrame.panelWidth : 1;
  const aiBadge =
    isNative && status === 'active' ? resolveBuiltinBrowserAiBadge(aiState) : undefined;

  return (
    <Flex flexDirection={'column'} h={'100%'} minH={0}>
      {/* Header */}
      <Flex
        flexShrink={0}
        alignItems={'center'}
        gap={'8px'}
        h={'46px'}
        pl={'12px'}
        pr={'10px'}
        borderBottom={'1px solid'}
        borderBottomColor={LG.lineSoft}
        bgGradient={'linear(to-b, #FFFFFF, #F4F8FE)'}
      >
        <MyIcon name={'common/globalLine'} w={'14px'} h={'14px'} color={LG.mountain} />
        <Text
          fontSize={'12px'}
          fontWeight={600}
          color={LG.ink}
          whiteSpace={'nowrap'}
          letterSpacing={'0.01em'}
        >
          {t('common:builtin_browser')}
        </Text>
        {isNative && status === 'active' && !aiBadge && (
          <Text
            h={'17px'}
            px={'6px'}
            display={'inline-flex'}
            alignItems={'center'}
            borderRadius={'4px'}
            bg={'rgba(111,157,208,0.12)'}
            border={'1px solid'}
            borderColor={'rgba(111,157,208,0.26)'}
            color={LG.mountain}
            fontSize={'9px'}
            letterSpacing={'0.06em'}
            whiteSpace={'nowrap'}
          >
            {t('common:builtin_browser_local')}
          </Text>
        )}
        {!isNative && status === 'active' && showRemaining && remainingMinutes !== undefined && (
          <Text
            fontSize={'10px'}
            color={isExpiringSoon ? '#C4823A' : LG.muted}
            whiteSpace={'nowrap'}
          >
            {t(
              isExpiringSoon
                ? 'common:builtin_browser_expiring'
                : 'common:builtin_browser_remaining',
              { minutes: remainingMinutes }
            )}
          </Text>
        )}
        {aiBadge && (
          <MyTooltip label={aiBadge.message || t(aiBadge.labelKey as any)}>
            <Flex
              alignItems={'center'}
              gap={'4px'}
              h={'17px'}
              px={'6px'}
              borderRadius={'4px'}
              bg={aiBadge.running ? 'blue.50' : 'orange.50'}
              color={aiBadge.running ? 'blue.600' : 'orange.600'}
              whiteSpace={'nowrap'}
            >
              <Box
                w={'5px'}
                h={'5px'}
                borderRadius={'full'}
                bg={aiBadge.running ? 'blue.500' : 'orange.500'}
              />
              {showAiBadgeLabel && (
                <Text fontSize={'9px'} letterSpacing={'0.04em'}>
                  {t(aiBadge.labelKey as any)}
                </Text>
              )}
            </Flex>
          </MyTooltip>
        )}
        <Box flex={'1 1 0'} />

        {/* 鲁港通 - AI 运行中给出显眼的停止入口，点击立即终止本次自动操作 */}
        {aiBadge?.running && (
          <Button
            size={'xs'}
            h={'22px'}
            px={2}
            fontSize={'10px'}
            borderRadius={'6px'}
            colorScheme={'red'}
            isLoading={isStoppingAi}
            loadingText={t('common:builtin_browser_ai_stopping')}
            onClick={() => void handleStopAi()}
          >
            {t('common:builtin_browser_ai_stop')}
          </Button>
        )}

        {!isNative && status === 'active' && (
          <MyTooltip label={t('common:builtin_browser_refit')}>
            <MyIcon
              name={'core/modules/fitView'}
              w={'15px'}
              h={'15px'}
              color={LG.muted}
              cursor={'pointer'}
              _hover={{ color: LG.mountain }}
              onClick={() => void handleRefit()}
            />
          </MyTooltip>
        )}
        {status === 'active' && panelView === 'browser' && (
          <MyTooltip label={t('common:builtin_browser_refresh')}>
            <MyIcon
              name={'common/refresh'}
              w={'15px'}
              h={'15px'}
              color={LG.muted}
              cursor={isReloading ? 'not-allowed' : 'pointer'}
              opacity={isReloading ? 0.5 : 1}
              _hover={isReloading ? undefined : { color: LG.mountain }}
              onClick={() => void handleReload()}
            />
          </MyTooltip>
        )}
        <MyTooltip label={t('common:builtin_browser_close')}>
          <MyIcon
            name={'close'}
            w={'15px'}
            h={'15px'}
            color={LG.muted}
            cursor={'pointer'}
            _hover={{ color: LG.mountain }}
            onClick={handleClose}
          />
        </MyTooltip>
      </Flex>

      {/* 标签条：用户标签从云端 index 1 起（0 为隐藏占位），+ 新建空白标签 */}
      <Flex
        flexShrink={0}
        alignItems={'center'}
        gap={'4px'}
        px={2}
        py={'5px'}
        bg={'rgba(244,248,254,0.6)'}
        borderBottom={'1px solid'}
        borderBottomColor={LG.lineSoft}
        overflowX={'auto'}
        css={{ '&::-webkit-scrollbar': { height: '2px' } }}
      >
        {tabs.map((tab) => (
          <Flex
            key={tab.index}
            alignItems={'center'}
            gap={1}
            h={'24px'}
            minW={'88px'}
            maxW={'180px'}
            flexShrink={0}
            px={'8px'}
            borderRadius={'6px'}
            bg={tab.current && !activeDocToken ? 'white' : 'transparent'}
            border={'1px solid'}
            borderColor={tab.current && !activeDocToken ? LG.line : 'transparent'}
            cursor={'pointer'}
            _hover={{ bg: 'white', borderColor: LG.line }}
            onClick={() => void handleSelectTab(tab.index)}
          >
            <Text
              flex={'1 1 0'}
              fontSize={'10px'}
              noOfLines={1}
              color={tab.current && !activeDocToken ? LG.ink : LG.muted}
            >
              {tabLabel(tab)}
            </Text>
            <MyIcon
              name={'close'}
              w={'11px'}
              h={'11px'}
              flexShrink={0}
              color={LG.mutedSoft}
              _hover={{ color: LG.mountain }}
              aria-label={t('common:builtin_browser_close_tab')}
              onClick={(e) => {
                e.stopPropagation();
                void handleCloseTab(tab.index);
              }}
            />
          </Flex>
        ))}
        {/* 鲁港通 - 文件标签与网页标签同条并存：点开看文档预览，关闭只结束该文件会话 */}
        {docTabs.map((doc) => {
          const isActiveDoc = doc.token === activeDocToken;
          return (
            <Flex
              key={doc.token}
              alignItems={'center'}
              gap={1}
              h={'24px'}
              minW={'88px'}
              maxW={'180px'}
              flexShrink={0}
              px={'6px'}
              borderRadius={'6px'}
              bg={isActiveDoc ? 'white' : 'transparent'}
              border={'1px solid'}
              borderColor={isActiveDoc ? LG.line : 'transparent'}
              cursor={'pointer'}
              _hover={{ bg: 'white', borderColor: LG.line }}
              onClick={() => setActiveDocToken(doc.token)}
            >
              <DocumentFormatChip format={doc.format} size={13} />
              <Text
                flex={'1 1 0'}
                fontSize={'10px'}
                noOfLines={1}
                color={isActiveDoc ? LG.ink : LG.muted}
              >
                {doc.fileName}
              </Text>
              <MyIcon
                name={'close'}
                w={'11px'}
                h={'11px'}
                flexShrink={0}
                color={LG.mutedSoft}
                _hover={{ color: LG.mountain }}
                aria-label={t('common:builtin_browser_doc_close_tab')}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleCloseDocTab(doc.token);
                }}
              />
            </Flex>
          );
        })}
        <MyTooltip label={t('common:builtin_browser_new_tab')}>
          <Flex
            alignItems={'center'}
            justifyContent={'center'}
            w={'24px'}
            h={'24px'}
            flexShrink={0}
            borderRadius={'6px'}
            color={status === 'active' && !tabsFull ? LG.muted : LG.mutedSoft}
            cursor={status === 'active' && !tabsFull ? 'pointer' : 'not-allowed'}
            _hover={
              status === 'active' && !tabsFull
                ? { bg: 'rgba(54,101,150,0.06)', color: LG.mountain }
                : undefined
            }
            onClick={() => {
              if (status === 'active' && !tabsFull) void handleNewTab();
            }}
          >
            <MyIcon name={'common/addLight'} w={'13px'} h={'13px'} />
          </Flex>
        </MyTooltip>
      </Flex>

      {/* 网址栏：输入后回车让云端浏览器跳转；开台等待期间也可输入，就绪后自动打开 */}
      {panelView === 'browser' && (
        <Flex
          flexShrink={0}
          alignItems={'center'}
          px={'10px'}
          py={'5px'}
          bg={'#F5F9FE'}
          borderBottom={'1px solid'}
          borderBottomColor={LG.lineSoft}
        >
          <Input
            ref={urlInputRef}
            size={'sm'}
            h={'27px'}
            fontSize={'11px'}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onFocus={() => {
              urlEditingRef.current = true;
            }}
            onBlur={() => {
              urlEditingRef.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
              void handleNavigate();
            }}
            placeholder={t('common:builtin_browser_url_placeholder')}
            isDisabled={status === 'error' || isNavigating}
            bg={'white'}
            border={'1px solid'}
            borderColor={LG.line}
            borderRadius={'7px'}
            color={'#4A5F75'}
            _hover={{ borderColor: 'rgba(111,157,208,0.4)' }}
            _focusVisible={{
              bg: 'white',
              borderColor: LG.lineStrong,
              boxShadow: '0 0 0 3px rgba(111,157,208,0.12)'
            }}
            _placeholder={{ color: '#9DAFC2' }}
          />
        </Flex>
      )}

      {/* Body：裁切容器，只显示云端浏览器页面本身（裁掉查看器工具栏与窗口外框） */}
      <Box
        ref={bodyRef}
        flex={'1 0 0'}
        minH={0}
        position={'relative'}
        overflow={'hidden'}
        bg={'white'}
      >
        {panelView === 'doc' &&
          (docSnapshot ? (
            <DocumentPreviewPanel
              snapshot={docSnapshot}
              busy={docBusy}
              onDecide={(index, decision) => void handleDecideDoc(index, decision)}
              onApplyAll={() => void handleApplyAllDoc()}
              onOpenCopy={() => void handleOpenCopyDoc()}
              readBytes={documents?.read}
              onOpenExternal={
                documents?.openExternal ? () => void handleOpenExternalDoc() : undefined
              }
            />
          ) : (
            <Flex
              h={'100%'}
              flexDirection={'column'}
              alignItems={'center'}
              justifyContent={'center'}
              gap={3}
            >
              <MyIcon name={'common/loading'} w={'22px'} h={'22px'} color={LG.lake} />
              <Text fontSize={'12px'} color={LG.muted}>
                {t('common:builtin_browser_doc_loading')}
              </Text>
            </Flex>
          ))}

        {/* 鲁港通 - 落地页两层入口：打开互联网网址，或选择本机文档预览修改 */}
        {panelView === 'landing' && (
          <Flex
            h={'100%'}
            flexDirection={'column'}
            alignItems={'center'}
            justifyContent={'center'}
            gap={'12px'}
            px={6}
            py={8}
            overflowY={'auto'}
          >
            <Flex alignItems={'center'} gap={'6px'} mb={'1'}>
              <MyIcon name={'common/globalLine'} w={'16px'} h={'16px'} color={LG.mountain} />
              <Text fontSize={'13px'} fontWeight={600} color={LG.ink}>
                {t('common:builtin_browser_doc_landing_title')}
              </Text>
            </Flex>

            <Box
              w={'100%'}
              maxW={'380px'}
              px={'14px'}
              py={'12px'}
              bg={'white'}
              border={'1px solid'}
              borderColor={LG.line}
              borderRadius={'10px'}
              boxShadow={'0 6px 22px rgba(78,128,178,0.06)'}
            >
              <Text fontSize={'11px'} fontWeight={600} color={LG.text} mb={'6px'}>
                {t('common:builtin_browser_doc_landing_url_label')}
              </Text>
              <Flex gap={'6px'}>
                <Input
                  ref={urlInputRef}
                  size={'sm'}
                  h={'29px'}
                  fontSize={'11px'}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onFocus={() => {
                    urlEditingRef.current = true;
                  }}
                  onBlur={() => {
                    urlEditingRef.current = false;
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                    void handleNavigate();
                  }}
                  placeholder={t('common:builtin_browser_url_placeholder')}
                  isDisabled={status === 'error' || isNavigating}
                  bg={'white'}
                  border={'1px solid'}
                  borderColor={LG.line}
                  borderRadius={'7px'}
                  color={'#4A5F75'}
                  _hover={{ borderColor: 'rgba(111,157,208,0.4)' }}
                  _focusVisible={{
                    bg: 'white',
                    borderColor: LG.lineStrong,
                    boxShadow: '0 0 0 3px rgba(111,157,208,0.12)'
                  }}
                  _placeholder={{ color: '#9DAFC2' }}
                />
                <Button
                  size={'sm'}
                  h={'29px'}
                  px={'14px'}
                  fontSize={'11px'}
                  borderRadius={'7px'}
                  bg={'linear-gradient(140deg, #8FB4DC, #4F80B4)'}
                  color={'white'}
                  _hover={{ opacity: 0.9 }}
                  isLoading={isNavigating}
                  onClick={() => void handleNavigate()}
                >
                  {t('common:builtin_browser_doc_open')}
                </Button>
              </Flex>
            </Box>

            {documents && (
              <Box
                w={'100%'}
                maxW={'380px'}
                px={'14px'}
                py={'12px'}
                bg={'white'}
                border={'1px solid'}
                borderColor={LG.line}
                borderRadius={'10px'}
                boxShadow={'0 6px 22px rgba(78,128,178,0.06)'}
              >
                <Text fontSize={'11px'} fontWeight={600} color={LG.text} mb={'6px'}>
                  {t('common:builtin_browser_doc_landing_file_label')}
                </Text>
                <Button
                  w={'100%'}
                  size={'sm'}
                  h={'29px'}
                  fontSize={'11px'}
                  borderRadius={'7px'}
                  variant={'outline'}
                  color={LG.mountain}
                  borderColor={'rgba(111,157,208,0.4)'}
                  _hover={{ bg: 'rgba(111,157,208,0.08)' }}
                  isLoading={docBusy}
                  onClick={() => void handlePickLocalDoc()}
                >
                  {t('common:builtin_browser_doc_landing_file_action')}
                </Button>
                <Text mt={'6px'} fontSize={'10px'} color={LG.mutedSoft}>
                  {t('common:builtin_browser_doc_landing_file_hint')}
                </Text>
              </Box>
            )}
          </Flex>
        )}

        {panelView === 'browser' && (
          <>
        {status === 'loading' && (
          <Flex
            h={'100%'}
            flexDirection={'column'}
            alignItems={'center'}
            justifyContent={'center'}
            gap={3}
          >
            <MyIcon name={'common/loading'} w={'22px'} h={'22px'} color={LG.lake} />
            <Text fontSize={'12px'} color={LG.muted}>
              {t('common:builtin_browser_loading')}
            </Text>
            {loadingSlow && (
              <Text fontSize={'11px'} color={LG.mutedSoft} textAlign={'center'} px={6}>
                {t('common:builtin_browser_loading_slow')}
              </Text>
            )}
          </Flex>
        )}

        {status === 'error' && (
          <Flex
            h={'100%'}
            flexDirection={'column'}
            alignItems={'center'}
            justifyContent={'center'}
            gap={3}
            px={6}
          >
            <MyIcon name={'common/error'} w={'22px'} h={'22px'} color={'red.500'} />
            <Text fontSize={'12px'} color={LG.text} textAlign={'center'}>
              {errorMessage}
            </Text>
            <Button size={'sm'} variant={'primary'} onClick={() => void loadSession()}>
              {t('common:builtin_browser_retry')}
            </Button>
          </Flex>
        )}

        {!isNative && status === 'active' && session && (
          <iframe
            key={session.resourceUrl}
            src={session.resourceUrl}
            title={t('common:builtin_browser')}
            style={{
              position: 'absolute',
              // 鲁港通 - 冻结期按拖拽前像素尺寸渲染并横向缩放，画面铺满新宽度且不触发查看器重排
              left: frozenFrame
                ? -BUILTIN_BROWSER_CROP_LEFT_PX * frozenScaleX
                : -BUILTIN_BROWSER_CROP_LEFT_PX,
              top: -BUILTIN_BROWSER_CROP_TOP_PX,
              width: frozenFrame
                ? frozenFrame.width + BUILTIN_BROWSER_CROP_LEFT_PX
                : `calc(100% + ${BUILTIN_BROWSER_CROP_LEFT_PX}px)`,
              height: frozenFrame
                ? frozenFrame.height + BUILTIN_BROWSER_CROP_TOP_PX
                : `calc(100% + ${BUILTIN_BROWSER_CROP_TOP_PX}px)`,
              transform: frozenFrame ? `scaleX(${frozenScaleX})` : undefined,
              transformOrigin: 'left top',
              border: 'none',
              display: 'block'
            }}
            sandbox={
              'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-presentation allow-storage-access-by-user-activation'
            }
            referrerPolicy={'no-referrer'}
            allow={'clipboard-read; clipboard-write'}
          />
        )}

        {isNative && status === 'active' && (
          <Flex
            h={'100%'}
            alignItems={'center'}
            justifyContent={'center'}
            bg={'white'}
            color={LG.muted}
          >
            {isResizing && (
              <Text fontSize={'12px'}>{t('common:builtin_browser_resizing')}</Text>
            )}
          </Flex>
        )}
          </>
        )}
      </Box>

      <ConfirmModal />
    </Flex>
  );
};

const BuiltinBrowserPanel = () => {
  const isVisible = useBuiltinBrowserVisible();
  const builtinBrowser = useContext(BuiltinBrowserContext);

  const [panelWidth, setPanelWidth] = useState(readStoredPanelWidth);
  const widthRef = useRef(panelWidth);
  const dragRef = useRef<{ startX: number; startWidth: number } | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);

  // 鲁港通 - 左缘拖拽调宽：pointer capture 保证指针跨到画面/聊天区仍持续接收事件
  const handleDragStart = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: widthRef.current };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handleDragMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = clampBuiltinBrowserPanelWidth(
      drag.startWidth + (drag.startX - e.clientX),
      window.innerWidth
    );
    widthRef.current = next;
    setPanelWidth(next);
  }, []);

  const handleDragEnd = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = undefined;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    try {
      window.localStorage.setItem(
        BUILTIN_BROWSER_PANEL_WIDTH_STORAGE_KEY,
        String(widthRef.current)
      );
    } catch {
      // 隐私模式等场景无法写入：宽度仅本次会话生效
    }
  }, []);

  // 鲁港通 - 窗口宽度变化时收敛面板宽度（上限 = 窗口宽 − 保留区，对齐 Qoder 右栏）
  useEffect(() => {
    const handleWindowResize = () => {
      setPanelWidth((prev) => {
        const next = clampBuiltinBrowserPanelWidth(prev, window.innerWidth);
        widthRef.current = next;
        return next;
      });
    };

    handleWindowResize();
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // 鲁港通 - 拖动期间全局禁用选中并保持调整光标，防画面区域出现文字选择抖动
  useEffect(() => {
    if (!isDragging) return;

    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
    };
  }, [isDragging]);

  if (!isVisible || !builtinBrowser?.isOpen) return null;

  return (
    <Flex
      flex={`0 0 ${panelWidth}px`}
      w={`${panelWidth}px`}
      maxW={`${panelWidth}px`}
      h={'100%'}
      minH={0}
      position={'relative'}
    >
      <PageContainer
        flex={'1 1 auto'}
        pr={0}
        insertProps={{
          borderWidth: 0,
          boxShadow: '-12px 0 28px rgba(78,128,178,0.08)',
          bg: '#FCFEFF',
          borderLeft: '1px solid',
          borderLeftColor: LG.line,
          borderRadius: [0, '0 16px 16px 0'],
          // 鲁港通 - 左侧留出拖拽 gutter：原生 WebContentsView 从 body 起算，手柄才不会被盖住
          pl: `${BUILTIN_BROWSER_PANEL_RESIZE_HIT_PX}px`
        }}
      >
        <BuiltinBrowserPanelBody panelWidth={panelWidth} isResizing={isDragging} />
      </PageContainer>

      {/* 鲁港通 - 拖拽手柄：面板左缘 16px 条带（含视觉握把）；拖动中覆盖全面板遮罩，防云端画面抢指针事件 */}
      <Box
        position={'absolute'}
        left={0}
        top={0}
        bottom={0}
        w={`${BUILTIN_BROWSER_PANEL_RESIZE_HIT_PX}px`}
        zIndex={20}
        cursor={'col-resize'}
        style={{ touchAction: 'none' }}
        _hover={{ bg: 'rgba(231,241,251,0.6)' }}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <Box
          position={'absolute'}
          left={'50%'}
          top={'50%'}
          transform={'translate(-50%, -50%)'}
          w={'3px'}
          h={'34px'}
          borderRadius={'2px'}
          bg={'rgba(54,101,150,0.24)'}
        />
      </Box>
      {isDragging && (
        <Box position={'absolute'} inset={0} zIndex={30} cursor={'col-resize'} bg={'transparent'} />
      )}
    </Flex>
  );
};

export default BuiltinBrowserPanel;
