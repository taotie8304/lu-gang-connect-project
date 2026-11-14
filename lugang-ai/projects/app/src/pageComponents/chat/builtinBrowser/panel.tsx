// 鲁港通 - 办事浏览器右栏面板（内置浏览器 P1）：
// 聊天页右侧内嵌浏览器画面（PC 端），用户可随时接管键鼠操作；
// 画面按云端查看器实测几何裁切，只显示浏览器页面本身（豆包式固定画面，不可拖动、不可移动）；
// 面板左缘可拖拽调宽（宽度本地记忆），网址栏可手动输入网址让云端浏览器跳转；
// 关闭面板即结束本次使用（释放云端会话）；单次时长上限由服务端控制，临近上限本地提醒
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Input,
  Modal,
  ModalContent,
  ModalOverlay,
  Text
} from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import PageContainer from '@/components/PageContainer';
import MyIcon from '@fastgpt/web/components/common/Icon';
import type { IconNameType } from '@fastgpt/web/components/common/Icon/type';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import { getErrText } from '@fastgpt/global/common/error/utils';
import {
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
import AiTimeline from './aiTimeline';
import { eventBus, EventNameEnum } from '@/web/common/utils/eventbus';
import type {
  DesktopAiState,
  DesktopBrowserNavState,
  DesktopClearBrowsingDataOptions,
  DesktopDocumentSnapshot,
  DesktopDocumentSummary,
  DesktopDownloadItem,
  DesktopFindResult,
  DesktopLibraryItem
} from './desktopBridge';
import { resolveActiveDocToken, resolveDocPanelView, shouldHandleLibraryRequest } from './documentTabs';
import DocumentPreviewPanel, { DocumentFormatChip } from './documentPreview';
import LibraryPanel, { LibraryDocToolbar } from './libraryPanel';
import type { LibraryItemActions, LibraryPreview } from './libraryPanel';
import { libraryImageMime } from './libraryList';
import ScenarioSection from './scenario/ScenarioSection';
import { LG } from '@/pageComponents/chat/lugangTheme';

const MINUTE_MS = 60 * 1000;
const COUNTDOWN_TICK_MS = 30 * 1000;
// 鲁港通 - 窗口拉伸/缩放后延迟 600ms 再同步云端视口，避免拖动过程连发请求
const VIEWPORT_FOLLOW_DEBOUNCE_MS = 600;
// 鲁港通 - 开台超过 5 秒追加「首次准备较慢」提示，避免用户误以为卡死
const LOADING_SLOW_HINT_MS = 5 * 1000;
// 鲁港通 - 面板窄于该宽度时头部隐藏剩余时间文案（英文/韩文更长，防挤压标题与按钮）
const HEADER_HIDE_REMAINING_WIDTH = 420;
// 鲁港通 - 窄面板里 AI 状态条只留圆点与图标按钮，文字靠悬停提示
const AI_STRIP_NARROW_WIDTH = 340;
// 鲁港通 - 查找输入防抖：中文输入法组合期结束后再查，避免逐字抖动
const FIND_DEBOUNCE_MS = 250;
const ZOOM_LEVELS = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200];
const DEFAULT_NAV_STATE: DesktopBrowserNavState = {
  canGoBack: false,
  canGoForward: false,
  zoomPercent: 100,
  siteAiMode: 'allow'
};

const stepZoomPercent = (current: number, direction: 'in' | 'out') => {
  const value = ZOOM_LEVELS.includes(current) ? current : 100;
  if (direction === 'in') {
    return ZOOM_LEVELS.find((level) => level > value) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  }
  return [...ZOOM_LEVELS].reverse().find((level) => level < value) ?? ZOOM_LEVELS[0];
};

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
};

// 鲁港通 - 工具栏小图标按钮：后退/前进禁用时变淡且不可点
const ToolbarIcon = ({
  name,
  label,
  disabled,
  onClick
}: {
  name: IconNameType;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <MyTooltip label={label}>
    <Flex
      alignItems={'center'}
      justifyContent={'center'}
      w={'24px'}
      h={'24px'}
      flexShrink={0}
      borderRadius={'5px'}
      color={LG.muted}
      opacity={disabled ? 0.32 : 1}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      _hover={disabled ? undefined : { bg: 'rgba(54,101,150,0.08)', color: LG.mountain }}
      onClick={disabled ? undefined : onClick}
    >
      <MyIcon name={name} w={'13px'} h={'13px'} />
    </Flex>
  </MyTooltip>
);

// 鲁港通 - AI 状态条按钮：窄面板只留图标，悬停给出文字提示
const AiStripAction = ({
  label,
  icon,
  tone = 'ghost',
  narrow,
  loading,
  onClick
}: {
  label: string;
  icon: IconNameType;
  tone?: 'ghost' | 'danger' | 'primary';
  narrow: boolean;
  loading?: boolean;
  onClick: () => void;
}) => {
  const button = (
    <Button
      size={'xs'}
      h={'24px'}
      minW={0}
      w={narrow ? '24px' : undefined}
      px={narrow ? 0 : '8px'}
      fontSize={'12px'}
      fontWeight={500}
      borderRadius={'6px'}
      border={'1px solid'}
      borderColor={
        tone === 'danger'
          ? 'rgba(200,90,80,0.32)'
          : tone === 'primary'
            ? 'transparent'
            : LG.line
      }
      bg={
        tone === 'danger'
          ? '#FFF9F8'
          : tone === 'primary'
            ? 'linear-gradient(140deg, #8FB4DC, #4F80B4)'
            : 'white'
      }
      color={tone === 'danger' ? '#B4544E' : tone === 'primary' ? 'white' : '#4A5F75'}
      whiteSpace={'nowrap'}
      isLoading={loading}
      onClick={onClick}
    >
      {narrow ? (
        <MyIcon name={icon} w={'13px'} h={'13px'} />
      ) : (
        <Flex alignItems={'center'} gap={'4px'}>
          <MyIcon name={icon} w={'13px'} h={'13px'} />
          <Text as={'span'} fontSize={'12px'}>
            {label}
          </Text>
        </Flex>
      )}
    </Button>
  );
  return narrow ? <MyTooltip label={label}>{button}</MyTooltip> : button;
};

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
  const [aiBusy, setAiBusy] = useState<'takeover' | 'resume' | 'stop'>();
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [docTabs, setDocTabs] = useState<DesktopDocumentSummary[]>([]);
  const [activeDocToken, setActiveDocToken] = useState<string | null>(null);
  // 鲁港通 - 快照带 token 缓存：切换文件时旧快照自然失效，无需在 effect 里清空
  const [docSnapshotCache, setDocSnapshotCache] = useState<{
    token: string;
    snapshot: DesktopDocumentSnapshot;
  } | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  // 鲁港通 - 个人资料库：常驻标签与列表状态；打开文件后记录来自资料库的条目以便显示工具条
  const [libraryItems, setLibraryItems] = useState<DesktopLibraryItem[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryPreview, setLibraryPreview] = useState<LibraryPreview | null>(null);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryDocItemId, setLibraryDocItemId] = useState<string | null>(null);
  // 鲁港通 - P0 原生浏览器状态：导航、查找、下载与清理弹窗
  const [navState, setNavState] = useState<DesktopBrowserNavState>(DEFAULT_NAV_STATE);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findComposing, setFindComposing] = useState(false);
  const [findResult, setFindResult] = useState<DesktopFindResult>();
  const [downloads, setDownloads] = useState<DesktopDownloadItem[]>([]);
  const [clearOpen, setClearOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [clearOptions, setClearOptions] = useState<DesktopClearBrowsingDataOptions>({
    cookies: true,
    cache: true,
    permissions: true
  });
  const [clearing, setClearing] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const scenarioSectionRef = useRef<HTMLDivElement>(null);
  const consumedScenarioNonceRef = useRef(0);
  const findInputRef = useRef<HTMLInputElement>(null);
  const urlEditingRef = useRef(false);
  // 鲁港通 - 开台期间输入的网址先排队，会话就绪后自动打开
  const pendingNavigateRef = useRef<string>();
  const isResizingRef = useRef(isResizing);
  // 鲁港通 - 拖拽调宽期间冻结云端视口：松手后按最终尺寸统一贴合，避免连发 resize
  const freezeRef = useRef<{ width: number; height: number; panelWidth: number } | null>(null);
  const tabsSchedulerRef = useRef<ReturnType<typeof createTabRefreshScheduler>>();

  // 鲁港通 - 桌面桥可用时走本地浏览器，否则保持云端 AgentBay
  const transport = useMemo(() => createBuiltinBrowserTransport(), []);
  const isNative = transport.usesNativeView;
  // 鲁港通 - 网页版云端浏览器只读：不渲染画面与手动浏览控件，只展示进度与当前页
  const cloudReadOnly = !isNative;
  // 鲁港通 - 0.10.0 起桌面端提供原生导航/查找/缩放/下载能力，老客户端保持原样
  const controls = transport.controls;
  const hasPageOverlay = usePageOverlayOpen();
  const tabsFull = tabs.length >= BUILTIN_BROWSER_MAX_TABS;
  // 鲁港通 - 文件预览桥只在新版桌面客户端存在，老客户端据此隐藏本地文件入口
  const documents = useMemo(
    () => (typeof window === 'undefined' ? undefined : window.lugangDesktop?.documents),
    []
  );
  // 鲁港通 - 资料库桥只在 0.14.0 起的桌面客户端存在，老客户端不显示入口与标签
  const library = useMemo(
    () => (typeof window === 'undefined' ? undefined : window.lugangDesktop?.library),
    []
  );
  const currentTab = tabs.find((tab) => tab.current);
  const currentTabUrl = currentTab?.url;
  const panelView = resolveDocPanelView({ activeDocToken, status, currentTabUrl, libraryOpen });

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

  // 鲁港通 - 锁定标签的关闭入口统一给出同一句可操作提示
  const notifyLockedTab = useCallback(() => {
    toast({ title: t('common:builtin_browser_ai_locked_tab'), status: 'info' });
  }, [t, toast]);

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

  // 鲁港通 - 桌面模式订阅 AI 工作状态：面板顶部状态条与时间线据此实时更新
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

  // 鲁港通 - 新会话开始时时间线被清空，折叠态复位
  useEffect(() => {
    if (!aiState?.steps.length) setTimelineOpen(false);
  }, [aiState?.steps.length]);

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

  // 鲁港通 - 资料库：订阅主进程索引推送，挂载后先拉一次
  const applyLibraryItems = useCallback((list: DesktopLibraryItem[]) => {
    setLibraryItems(list);
  }, []);

  useEffect(() => {
    if (!library) return;
    let cancelled = false;
    void library
      .list()
      .then((list) => {
        if (!cancelled) applyLibraryItems(list);
      })
      .catch(() => undefined);
    const unsubscribe = library.onChanged(applyLibraryItems);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [library, applyLibraryItems]);

  // 鲁港通 - 图片预览用 blob 地址渲染，离开预览立即释放
  const libraryImageUrlRef = useRef<string | null>(null);
  const revokeLibraryImage = useCallback(() => {
    if (!libraryImageUrlRef.current) return;
    URL.revokeObjectURL(libraryImageUrlRef.current);
    libraryImageUrlRef.current = null;
  }, []);
  useEffect(() => revokeLibraryImage, [revokeLibraryImage]);

  // 鲁港通 - 聊天输入框的资料库入口：消费未处理的打开请求（含面板挂载前发出的）
  const libraryNonce = builtinBrowser?.libraryNonce ?? 0;
  const libraryRequestPending = builtinBrowser?.libraryRequestPending ?? false;
  const consumeLibraryRequest = builtinBrowser?.consumeLibraryRequest;
  const handledLibraryNonceRef = useRef(0);
  useEffect(() => {
    if (
      !shouldHandleLibraryRequest({
        nonce: libraryNonce,
        pending: libraryRequestPending,
        handledNonce: handledLibraryNonceRef.current
      })
    ) {
      return;
    }
    handledLibraryNonceRef.current = libraryNonce;
    setActiveDocToken(null);
    revokeLibraryImage();
    setLibraryPreview(null);
    setLibraryOpen(true);
    consumeLibraryRequest?.();
  }, [libraryNonce, libraryRequestPending, consumeLibraryRequest, revokeLibraryImage]);

  const activeDocSummary = useMemo(
    () => docTabs.find((item) => item.token === activeDocToken),
    [docTabs, activeDocToken]
  );
  // 鲁港通 - 当前活动文件来自资料库时显示工具条；切到别的文件标签后按文件名失配自动隐藏
  const libraryDocItem = useMemo(() => {
    if (!libraryDocItemId) return null;
    const item = libraryItems.find((row) => row.id === libraryDocItemId);
    if (!item || item.missing) return null;
    if (activeDocSummary && activeDocSummary.fileName !== item.name) return null;
    return item;
  }, [libraryDocItemId, libraryItems, activeDocSummary]);
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

  // 鲁港通 - 场景入口请求：每次 nonce 只消费一次，滚动到场景区后清除请求
  useEffect(() => {
    const focus = builtinBrowser?.scenarioFocus;
    if (!focus || focus.nonce === consumedScenarioNonceRef.current) return;
    consumedScenarioNonceRef.current = focus.nonce;
    requestAnimationFrame(() => {
      scenarioSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    builtinBrowser?.consumeScenarioFocus();
  }, [builtinBrowser?.scenarioFocus, builtinBrowser]);

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
    setLibraryOpen(false);
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
      setLibraryOpen(false);
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
      // 鲁港通 - 锁定标签在 UI 层先拦一次，主进程 closeTab 仍会硬拦截兜底
      if (tabs.some((tab) => tab.index === index && tab.locked)) {
        notifyLockedTab();
        return;
      }
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
    [applyTabs, closeTab, showTabActionFailed, tabs, notifyLockedTab]
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
      // 鲁港通 - 关闭的是资料库来源的文件时一并收起工具条关联
      const closing = docTabs.find((item) => item.token === token);
      if (closing && libraryDocItem && closing.fileName === libraryDocItem.name) {
        setLibraryDocItemId(null);
      }
    },
    [documents, docTabs, libraryDocItem]
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

  // 鲁港通 - 打开资料库条目：文档走右栏文件会话，图片走面板内预览，缺失/不支持给出对应页面
  const handleOpenLibraryItem = useCallback(
    async (item: DesktopLibraryItem, options?: { continueEdit?: boolean }) => {
      if (!library || libraryBusy) return;
      setLibraryBusy(true);
      try {
        const result = await library.open(item.id);
        if (!result) {
          toast({
            title: t('common:builtin_browser_library_open_failed' as any),
            status: 'warning'
          });
          return;
        }
        if (result.type === 'document') {
          if (documents) {
            try {
              applyDocTabs(await documents.list());
            } catch {
              // 标签条由主进程推送补齐，列表失败不阻塞文件打开
            }
          }
          revokeLibraryImage();
          setLibraryPreview(null);
          setLibraryOpen(false);
          setLibraryDocItemId(item.id);
          setActiveDocToken(result.snapshot.token);
          setDocSnapshotCache({ token: result.snapshot.token, snapshot: result.snapshot });
          if (options?.continueEdit) {
            builtinBrowser?.setLibraryFile({ name: item.name, kind: item.kind });
            toast({
              title: t('common:builtin_browser_library_continue_ready' as any),
              status: 'success'
            });
          }
          return;
        }
        if (result.type === 'image') {
          revokeLibraryImage();
          // 鲁港通 - 复制到独立的 ArrayBuffer，避免跨进程字节视图与 Blob 类型不兼容
          const bytes = new Uint8Array(result.data.byteLength);
          bytes.set(result.data);
          const url = URL.createObjectURL(
            new Blob([bytes.buffer], { type: libraryImageMime(result.name) })
          );
          libraryImageUrlRef.current = url;
          setLibraryPreview({ kind: 'image', itemId: item.id, name: result.name, url });
          return;
        }
        if (result.type === 'missing') {
          setLibraryPreview({ kind: 'missing', itemId: item.id, name: item.name });
          return;
        }
        setLibraryPreview({
          kind: 'unsupported',
          itemId: item.id,
          name: item.name,
          ...(result.reason ? { reason: result.reason } : {})
        });
      } catch (err) {
        toast({
          title: t(getErrText(err, 'common:builtin_browser_library_open_failed') as any),
          status: 'warning'
        });
      } finally {
        setLibraryBusy(false);
      }
    },
    [
      library,
      libraryBusy,
      documents,
      applyDocTabs,
      revokeLibraryImage,
      builtinBrowser,
      t,
      toast
    ]
  );

  // 鲁港通 - 导入本机文件：取消时静默返回，成功后由索引推送把新记录排到最前
  const handleImportLibrary = useCallback(async () => {
    if (!library || libraryBusy) return;
    setLibraryBusy(true);
    try {
      await library.importLocal();
    } catch (err) {
      toast({
        title: t(getErrText(err, 'common:builtin_browser_library_import_failed') as any),
        status: 'warning'
      });
    } finally {
      setLibraryBusy(false);
    }
  }, [library, libraryBusy, t, toast]);

  const handleToggleLibraryStar = useCallback(
    async (item: DesktopLibraryItem) => {
      if (!library) return;
      try {
        const updated = await library.star(item.id, !item.starred);
        if (!updated) {
          toast({
            title: t('common:builtin_browser_library_action_failed' as any),
            status: 'warning'
          });
          return;
        }
        setLibraryItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      } catch (err) {
        toast({
          title: t(getErrText(err, 'common:builtin_browser_library_action_failed') as any),
          status: 'warning'
        });
      }
    },
    [library, t, toast]
  );

  const handleRevealLibrary = useCallback(
    async (item: DesktopLibraryItem) => {
      if (!library) return;
      try {
        const revealed = await library.reveal(item.id);
        if (!revealed) {
          toast({
            title: t('common:builtin_browser_library_reveal_failed' as any),
            status: 'warning'
          });
        }
      } catch (err) {
        toast({
          title: t(getErrText(err, 'common:builtin_browser_library_reveal_failed') as any),
          status: 'warning'
        });
      }
    },
    [library, t, toast]
  );

  const handleOpenExternalLibrary = useCallback(
    async (item: DesktopLibraryItem) => {
      if (!library) return;
      try {
        const opened = await library.openExternal(item.id);
        if (!opened) {
          toast({
            title: t('common:builtin_browser_library_open_external_failed' as any),
            status: 'warning'
          });
        }
      } catch (err) {
        toast({
          title: t(getErrText(err, 'common:builtin_browser_library_open_external_failed') as any),
          status: 'warning'
        });
      }
    },
    [library, t, toast]
  );

  // 鲁港通 - 重新定位：用户取消选择或文件不可读时静默返回，缺口仍在缺失横幅上可见
  const handleRelocateLibrary = useCallback(
    async (item: DesktopLibraryItem) => {
      if (!library) return;
      try {
        const updated = await library.relocate(item.id);
        if (!updated) return;
        setLibraryItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
        setLibraryPreview((prev) => (prev?.itemId === updated.id ? null : prev));
      } catch {
        // 主进程已记录日志，缺失状态保持原样
      }
    },
    [library]
  );

  // 鲁港通 - 只删索引记录，原文件保持原位
  const handleRemoveLibrary = useCallback(
    async (item: DesktopLibraryItem) => {
      if (!library) return;
      try {
        const removed = await library.remove(item.id);
        if (!removed) {
          toast({
            title: t('common:builtin_browser_library_action_failed' as any),
            status: 'warning'
          });
          return;
        }
        setLibraryPreview((prev) => (prev?.itemId === item.id ? null : prev));
        setLibraryDocItemId((prev) => (prev === item.id ? null : prev));
        toast({ title: t('common:builtin_browser_library_remove_done' as any), status: 'success' });
      } catch (err) {
        toast({
          title: t(getErrText(err, 'common:builtin_browser_library_action_failed') as any),
          status: 'warning'
        });
      }
    },
    [library, t, toast]
  );

  // 鲁港通 - 删除到回收站会动文件，必须二次确认
  const handleTrashLibrary = useCallback(
    (item: DesktopLibraryItem) => {
      if (!library) return;
      openConfirm({
        customContent: t('common:builtin_browser_library_trash_confirm' as any, {
          name: item.name
        }),
        confirmText: t('common:builtin_browser_library_trash_confirm_ok' as any),
        onConfirm: async () => {
          try {
            const trashed = await library.trash(item.id);
            if (!trashed) {
              toast({
                title: t('common:builtin_browser_library_trash_failed' as any),
                status: 'warning'
              });
              return;
            }
            setLibraryPreview((prev) => (prev?.itemId === item.id ? null : prev));
            setLibraryDocItemId((prev) => (prev === item.id ? null : prev));
            toast({
              title: t('common:builtin_browser_library_trash_done' as any),
              status: 'success'
            });
          } catch {
            toast({
              title: t('common:builtin_browser_library_trash_failed' as any),
              status: 'warning'
            });
          }
        }
      })();
    },
    [library, openConfirm, t, toast]
  );

  const handleCloseLibraryPreview = useCallback(() => {
    revokeLibraryImage();
    setLibraryPreview(null);
  }, [revokeLibraryImage]);

  // 鲁港通 - 打开所在文件夹：取第一个未缺失条目所在的目录
  const handleRevealLibraryFolder = useCallback(() => {
    const target = libraryItems.find((item) => !item.missing);
    if (!target) {
      toast({
        title: t('common:builtin_browser_library_reveal_failed' as any),
        status: 'warning'
      });
      return;
    }
    void handleRevealLibrary(target);
  }, [libraryItems, handleRevealLibrary, t, toast]);

  const handleBackToLibrary = useCallback(() => {
    revokeLibraryImage();
    setLibraryPreview(null);
    setLibraryDocItemId(null);
    setActiveDocToken(null);
    setLibraryOpen(true);
  }, [revokeLibraryImage]);

  const libraryActions = useMemo<LibraryItemActions>(
    () => ({
      open: (item) => void handleOpenLibraryItem(item),
      continueEdit: (item) => void handleOpenLibraryItem(item, { continueEdit: true }),
      toggleStar: (item) => void handleToggleLibraryStar(item),
      reveal: (item) => void handleRevealLibrary(item),
      openExternal: (item) => void handleOpenExternalLibrary(item),
      trash: (item) => handleTrashLibrary(item),
      remove: (item) => void handleRemoveLibrary(item),
      relocate: (item) => void handleRelocateLibrary(item)
    }),
    [
      handleOpenLibraryItem,
      handleToggleLibraryStar,
      handleRevealLibrary,
      handleOpenExternalLibrary,
      handleTrashLibrary,
      handleRemoveLibrary,
      handleRelocateLibrary
    ]
  );

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
        freezeRef.current = { width: el.clientWidth, height: el.clientHeight, panelWidth };
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
    })();

    return () => {
      cancelled = true;
    };
  }, [isResizing, panelWidth, measureViewport, resizeViewport, transport.usesNativeView]);

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

  // 鲁港通 - 原生导航状态：后退/前进可用态与当前站点缩放比例
  useEffect(() => {
    if (!controls) return;
    let cancelled = false;
    // 鲁港通 - 0.12.0 之前的客户端不带站点 AI 权限字段，按默认「允许操作」归一化，避免误显示徽标
    const applyNav = (next: DesktopBrowserNavState) =>
      setNavState({ ...next, siteAiMode: next.siteAiMode ?? 'allow' });
    void controls
      .getNav()
      .then((next) => {
        if (!cancelled) applyNav(next);
      })
      .catch(() => undefined);
    const unsubscribe = controls.onNavChange(applyNav);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [controls]);

  // 鲁港通 - 换到已记忆缩放的站点时轻提示一次，避免用户误以为页面异常
  useEffect(() => {
    if (!controls) return;
    return controls.onZoomRestore(({ percent }) => {
      toast({
        title: t('common:builtin_browser_zoom_restored', { percent }),
        status: 'info',
        duration: 2500
      });
    });
  }, [controls, t, toast]);

  // 鲁港通 - 站点 AI 权限切换后轻提示一次，避免用户不知道设置已生效
  useEffect(() => {
    const siteAi = window.lugangDesktop?.siteAi;
    if (!siteAi) return;
    const keyByMode = {
      allow: 'common:builtin_browser_site_ai_set_allow',
      read_only: 'common:builtin_browser_site_ai_set_read_only',
      blocked: 'common:builtin_browser_site_ai_set_blocked'
    } as const;
    return siteAi.onChanged(({ mode }) => {
      toast({
        title: t(keyByMode[mode]),
        status: mode === 'blocked' ? 'warning' : 'info',
        duration: 2500
      });
    });
  }, [t, toast]);

  const handleSiteAiMenu = useCallback(() => {
    void window.lugangDesktop?.siteAi?.openMenu().catch(() => undefined);
  }, []);

  const handleGoBack = useCallback(() => {
    if (!controls || !navState.canGoBack) return;
    void controls.goBack().catch(() => undefined);
  }, [controls, navState.canGoBack]);

  const handleGoForward = useCallback(() => {
    if (!controls || !navState.canGoForward) return;
    void controls.goForward().catch(() => undefined);
  }, [controls, navState.canGoForward]);

  const handleZoomStep = useCallback(
    (direction: 'in' | 'out') => {
      if (!controls) return;
      void controls
        .setZoom(stepZoomPercent(navState.zoomPercent, direction))
        .then((percent) => setNavState((prev) => ({ ...prev, zoomPercent: percent })))
        .catch(() => {
          toast({ title: t('common:builtin_browser_zoom_failed'), status: 'warning' });
        });
    },
    [controls, navState.zoomPercent, t, toast]
  );

  const handleZoomReset = useCallback(() => {
    if (!controls) return;
    void controls
      .resetZoom()
      .then((percent) => setNavState((prev) => ({ ...prev, zoomPercent: percent })))
      .catch(() => {
        toast({ title: t('common:builtin_browser_zoom_failed'), status: 'warning' });
      });
  }, [controls, t, toast]);

  // 鲁港通 - 页内查找：输入防抖 250ms，输入法组合期不触发；清空即移除高亮
  useEffect(() => {
    if (!controls || !findOpen || findComposing) return;
    const query = findQuery.trim();
    setFindResult(undefined);
    if (!query) {
      void controls.findStop().catch(() => undefined);
      return;
    }
    const timer = setTimeout(() => {
      void controls.findStart(query).catch(() => undefined);
    }, FIND_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [controls, findOpen, findQuery, findComposing]);

  useEffect(() => {
    if (!controls) return;
    return controls.onFindResult((result) => setFindResult(result));
  }, [controls]);

  const closeFind = useCallback(() => {
    setFindOpen(false);
    setFindResult(undefined);
    void controls?.findStop().catch(() => undefined);
  }, [controls]);

  const handleFindNext = useCallback(
    (direction: 'next' | 'previous') => {
      if (!controls) return;
      const query = findQuery.trim();
      if (!query) return;
      // 鲁港通 - 防抖尚未发起查询时回车直接开查，避免按键落在上一轮查询上
      if (!findResult) {
        void controls.findStart(query).catch(() => undefined);
        return;
      }
      void controls.findNext(direction).catch(() => undefined);
    },
    [controls, findQuery, findResult]
  );

  // 鲁港通 - 面板从网页切到文件预览时收起查找条，避免高亮留在隐藏页面上
  useEffect(() => {
    if (panelView !== 'browser' && findOpen) closeFind();
  }, [panelView, findOpen, closeFind]);

  // 鲁港通 - 下载任务条：挂载后先拉一次，之后跟随主进程推送
  useEffect(() => {
    if (!controls) return;
    let cancelled = false;
    void controls
      .listDownloads()
      .then((list) => {
        if (!cancelled) setDownloads(list);
      })
      .catch(() => undefined);
    const unsubscribe = controls.onDownloadsChange((list) => {
      if (!cancelled) setDownloads(list);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [controls]);

  const handleDownloadAction = useCallback(
    async (action: 'open' | 'folder' | 'cancel' | 'dismiss', id: string) => {
      if (!controls) return;
      try {
        if (action === 'open' || action === 'folder') {
          const ok =
            action === 'open'
              ? await controls.openDownload(id)
              : await controls.showDownloadInFolder(id);
          if (!ok) {
            toast({
              title: t('common:builtin_browser_download_open_failed'),
              status: 'warning'
            });
          }
          return;
        }
        if (action === 'cancel') await controls.cancelDownload(id);
        else await controls.dismissDownload(id);
      } catch {
        toast({
          title: t('common:builtin_browser_download_action_failed'),
          status: 'warning'
        });
      }
    },
    [controls, t, toast]
  );

  // 鲁港通 - 主进程原生菜单与网页内快捷键发来的 UI 指令
  useEffect(() => {
    if (!controls) return;
    return controls.onCommand((command) => {
      if (command === 'find') setFindOpen(true);
      else if (command === 'close-find') closeFind();
      else if (command === 'focus-url') {
        urlInputRef.current?.focus();
        urlInputRef.current?.select();
      } else if (command === 'clear-data') setClearOpen(true);
      else if (command === 'shortcuts') setShortcutsOpen(true);
      // 鲁港通 - 「⋯ → 本次操作记录」与底部时间线芯片等效
      else if (command === 'timeline') setTimelineOpen(true);
    });
  }, [controls, closeFind]);

  useEffect(() => {
    if (!findOpen) return;
    const timer = setTimeout(() => findInputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [findOpen]);

  const clearSelectedCount =
    Number(clearOptions.cookies) +
    Number(clearOptions.cache) +
    Number(clearOptions.permissions);

  const handleClearBrowsingData = useCallback(async () => {
    if (!controls || clearing || clearSelectedCount === 0) return;
    setClearing(true);
    try {
      const cleared = await controls.clearData(clearOptions);
      if (!cleared) {
        toast({ title: t('common:builtin_browser_clear_failed'), status: 'warning' });
        return;
      }
      setClearOpen(false);
      toast({ title: t('common:builtin_browser_clear_done'), status: 'success' });
    } catch {
      toast({ title: t('common:builtin_browser_clear_failed'), status: 'warning' });
    } finally {
      setClearing(false);
    }
  }, [controls, clearing, clearSelectedCount, clearOptions, t, toast]);

  // 鲁港通 - 焦点在面板 UI 时由渲染层处理快捷键；焦点在网页内由主进程处理，互不重复
  const handlePanelKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!controls || e.nativeEvent.isComposing) return;
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (key === 'escape' && !ctrl && !e.altKey) {
        if (findOpen) {
          e.preventDefault();
          e.stopPropagation();
          closeFind();
        }
        return;
      }
      if (ctrl && !e.altKey) {
        const handled = () => {
          e.preventDefault();
          e.stopPropagation();
        };
        switch (key) {
          case 'f':
            handled();
            setFindOpen(true);
            return;
          case 'l':
            handled();
            urlInputRef.current?.focus();
            urlInputRef.current?.select();
            return;
          case 't':
            handled();
            void handleNewTab();
            return;
          case 'w': {
            handled();
            if (activeDocToken) {
              void handleCloseDocTab(activeDocToken);
              return;
            }
            const current = tabs.find((tab) => tab.current);
            if (current) void handleCloseTab(current.index);
            return;
          }
          case 'r':
            handled();
            void handleReload();
            return;
          case '=':
          case '+':
            handled();
            handleZoomStep('in');
            return;
          case '-':
          case '_':
            handled();
            handleZoomStep('out');
            return;
          case '0':
            handled();
            handleZoomReset();
            return;
          case 'p':
            handled();
            void controls.print().catch(() => undefined);
            return;
          default:
            return;
        }
      }
      if (e.altKey && !ctrl && (key === 'arrowleft' || key === 'arrowright')) {
        e.preventDefault();
        e.stopPropagation();
        if (key === 'arrowleft') handleGoBack();
        else handleGoForward();
      }
    },
    [
      controls,
      tabs,
      activeDocToken,
      findOpen,
      closeFind,
      handleNewTab,
      handleCloseTab,
      handleCloseDocTab,
      handleReload,
      handleZoomStep,
      handleZoomReset,
      handleGoBack,
      handleGoForward
    ]
  );

  // 鲁港通 - 停止 AI：主进程先终止在途动作并立即回传停止结果，用户不必等当前指令跑完
  const handleStopAi = useCallback(async () => {
    if (aiBusy) return;
    const ai = window.lugangDesktop?.ai;
    if (!ai) return;

    setAiBusy('stop');
    try {
      setAiState(await ai.stop());
    } catch (err) {
      toast({
        title: t(getErrText(err, 'common:builtin_browser_ai_stop_failed') as any),
        status: 'warning'
      });
    } finally {
      setAiBusy(undefined);
    }
  }, [aiBusy, t, toast]);

  // 鲁港通 - 一键接管：只暂停 AI，页面、滚动位置与已填内容全部保留
  const handleTakeover = useCallback(async () => {
    if (aiBusy) return;
    const ai = window.lugangDesktop?.ai;
    if (!ai?.takeover) return;

    setAiBusy('takeover');
    try {
      setAiState(await ai.takeover());
    } catch (err) {
      toast({
        title: t(getErrText(err, 'common:builtin_browser_ai_takeover_failed') as any),
        status: 'warning'
      });
    } finally {
      setAiBusy(undefined);
    }
  }, [aiBusy, t, toast]);

  // 鲁港通 - 让 AI 继续：本地恢复会话后，在对话里发一条用户可见的「继续」
  const handleResumeAi = useCallback(async () => {
    if (aiBusy) return;
    const ai = window.lugangDesktop?.ai;
    if (!ai?.resume) return;

    setAiBusy('resume');
    try {
      setAiState(await ai.resume());
      eventBus.emit(EventNameEnum.sendQuestion, {
        text: t('common:builtin_browser_ai_continue_message'),
        resume: true
      });
    } catch (err) {
      toast({
        title: t(getErrText(err, 'common:builtin_browser_ai_resume_failed') as any),
        status: 'warning'
      });
    } finally {
      setAiBusy(undefined);
    }
  }, [aiBusy, t, toast]);

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
  const aiBadge =
    isNative && status === 'active' ? resolveBuiltinBrowserAiBadge(aiState) : undefined;
  // 鲁港通 - 窄面板状态条只留圆点，按钮只留图标（悬停给文字提示）
  const aiStripNarrow = panelWidth < AI_STRIP_NARROW_WIDTH;
  const aiBridge = typeof window === 'undefined' ? undefined : window.lugangDesktop?.ai;
  const canTakeoverAi = Boolean(aiBridge?.takeover);
  const canResumeAi = Boolean(aiBridge?.resume);
  const aiStoppedHint = [aiBadge?.message, t('common:builtin_browser_ai_stopped_hint')]
    .filter(Boolean)
    .join(' · ');
  const docPreviewNode = docSnapshot ? (
    <DocumentPreviewPanel
      snapshot={docSnapshot}
      busy={docBusy}
      onDecide={(index, decision) => void handleDecideDoc(index, decision)}
      onApplyAll={() => void handleApplyAllDoc()}
      onOpenCopy={() => void handleOpenCopyDoc()}
      readBytes={documents?.read}
      onOpenExternal={documents?.openExternal ? () => void handleOpenExternalDoc() : undefined}
    />
  ) : null;

  return (
    <Flex flexDirection={'column'} h={'100%'} minH={0} onKeyDownCapture={handlePanelKeyDown}>
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
        <MyIcon name={'common/globalLine'} w={'15px'} h={'15px'} color={LG.mountain} />
        <Text
          fontSize={'15px'}
          fontWeight={600}
          color={LG.ink}
          whiteSpace={'nowrap'}
          letterSpacing={'0.01em'}
        >
          {t('common:builtin_browser')}
        </Text>
        {isNative && status === 'active' && (
          <Text
            h={'22px'}
            px={'7px'}
            display={'inline-flex'}
            alignItems={'center'}
            borderRadius={'4px'}
            bg={'rgba(111,157,208,0.12)'}
            border={'1px solid'}
            borderColor={'rgba(111,157,208,0.26)'}
            color={LG.mountain}
            fontSize={'12px'}
            letterSpacing={'0.06em'}
            whiteSpace={'nowrap'}
          >
            {t('common:builtin_browser_local')}
          </Text>
        )}
        {!isNative && status === 'active' && showRemaining && remainingMinutes !== undefined && (
          <Text
            fontSize={'13px'}
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
        <Box flex={'1 1 0'} />

        {/* 鲁港通 - 新桌面端刷新在网址栏，尚无 P0 能力的老桌面端保留顶部刷新；网页版只读不提供 */}
        {isNative && !controls && status === 'active' && panelView === 'browser' && (
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

      {/* 鲁港通 - 网页版只读提示：不展示云端画面，当前页只以文本呈现 */}
      {cloudReadOnly && status === 'active' && (
        <Flex
          flexShrink={0}
          flexDirection={'column'}
          gap={'4px'}
          px={'10px'}
          py={'8px'}
          borderBottom={'1px solid'}
          borderBottomColor={LG.lineSoft}
          bgGradient={'linear(to-r, #F1F8FF, #FAFCFF)'}
        >
          <Flex alignItems={'center'} gap={'6px'}>
            <MyIcon
              name={'common/viewLight'}
              w={'13px'}
              h={'13px'}
              color={LG.mountain}
              flexShrink={0}
            />
            <Text fontSize={'13px'} fontWeight={600} color={LG.mountain} whiteSpace={'nowrap'}>
              {t('common:builtin_browser_web_readonly_title')}
            </Text>
          </Flex>
          <Text fontSize={'12.5px'} color={LG.muted} lineHeight={'1.55'}>
            {t('common:builtin_browser_web_readonly_desc')}
          </Text>
          <Flex alignItems={'center'} gap={'6px'} minW={0} mt={'2px'}>
            <Text fontSize={'12px'} color={LG.mutedSoft} whiteSpace={'nowrap'}>
              {t('common:builtin_browser_web_readonly_current_page')}
            </Text>
            <Text fontSize={'12.5px'} color={LG.text} noOfLines={1} minW={0}>
              {currentTab ? tabLabel(currentTab) : t('common:builtin_browser_tab_untitled')}
            </Text>
          </Flex>
          {currentTabUrl && currentTabUrl !== 'about:blank' && (
            <Text fontSize={'12px'} color={LG.mutedSoft} noOfLines={1} title={currentTabUrl}>
              {currentTabUrl}
            </Text>
          )}
        </Flex>
      )}

      {/* 鲁港通 - AI 状态条：运行中可接管/停止，接管后可继续/结束，停止后保留原因与操作记录入口 */}
      {aiBadge && (
        <Flex
          flexShrink={0}
          alignItems={'center'}
          gap={'6px'}
          px={'10px'}
          py={'6px'}
          borderBottom={'1px solid'}
          borderBottomColor={aiBadge.status === 'paused' ? 'rgba(183,168,136,0.3)' : LG.lineSoft}
          bgGradient={
            aiBadge.status === 'running'
              ? 'linear(to-r, #EAF3FD, #F5FAFF)'
              : aiBadge.status === 'paused'
                ? 'linear(to-r, #FBF4E4, #FFFBEF)'
                : undefined
          }
          bg={aiBadge.status === 'stopped' ? '#F7F9FC' : undefined}
        >
          <Box
            w={'6px'}
            h={'6px'}
            flexShrink={0}
            borderRadius={'full'}
            bg={aiBadge.status === 'running' ? '#4E9AE0' : '#C99A4B'}
            css={
              aiBadge.status === 'running'
                ? {
                    animation: 'lugangAiPulse 1.6s ease-in-out infinite',
                    '@keyframes lugangAiPulse': {
                      '0%, 100%': { boxShadow: '0 0 0 2px rgba(78,154,224,0.18)' },
                      '50%': { boxShadow: '0 0 0 5px rgba(78,154,224,0.07)' }
                    }
                  }
                : undefined
            }
          />
          {!aiStripNarrow && (
            <>
              <Text
                fontSize={'13px'}
                fontWeight={600}
                color={aiBadge.status === 'paused' ? '#8A6D3B' : LG.mountain}
                whiteSpace={'nowrap'}
              >
                {t(aiBadge.labelKey as any)}
              </Text>
              <Text
                flex={'1 1 0'}
                minW={0}
                fontSize={'12px'}
                color={aiBadge.status === 'stopped' ? LG.muted : '#7B93A8'}
                isTruncated
                title={aiBadge.status === 'stopped' ? aiBadge.message : undefined}
              >
                {aiBadge.status === 'running'
                  ? t('common:builtin_browser_ai_running_hint')
                  : aiBadge.status === 'paused'
                    ? t('common:builtin_browser_ai_paused_hint')
                    : aiStoppedHint}
              </Text>
            </>
          )}
          {aiStripNarrow && <Box flex={'1 1 0'} />}
          {aiBadge.status === 'running' && (
            <>
              {canTakeoverAi && (
                <AiStripAction
                  label={t('common:builtin_browser_ai_takeover')}
                  icon={'common/lineUser'}
                  narrow={aiStripNarrow}
                  loading={aiBusy === 'takeover'}
                  onClick={() => void handleTakeover()}
                />
              )}
              <AiStripAction
                label={t('common:builtin_browser_ai_stop')}
                icon={'common/lineStop'}
                tone={'danger'}
                narrow={aiStripNarrow}
                loading={aiBusy === 'stop'}
                onClick={() => void handleStopAi()}
              />
            </>
          )}
          {aiBadge.status === 'paused' && (
            <>
              {canResumeAi && (
                <AiStripAction
                  label={t('common:builtin_browser_ai_resume')}
                  icon={'common/arrowRight'}
                  tone={'primary'}
                  narrow={aiStripNarrow}
                  loading={aiBusy === 'resume'}
                  onClick={() => void handleResumeAi()}
                />
              )}
              <AiStripAction
                label={t('common:builtin_browser_ai_end')}
                icon={'common/closeLight'}
                narrow={aiStripNarrow}
                loading={aiBusy === 'stop'}
                onClick={() => void handleStopAi()}
              />
            </>
          )}
          {aiBadge.status === 'stopped' && aiBadge.canResume && canResumeAi && (
            <AiStripAction
              label={t('common:builtin_browser_ai_resume')}
              icon={'common/arrowRight'}
              tone={'primary'}
              narrow={aiStripNarrow}
              loading={aiBusy === 'resume'}
              onClick={() => void handleResumeAi()}
            />
          )}
        </Flex>
      )}

      {/* 标签条：用户标签从云端 index 1 起（0 为隐藏占位），+ 新建空白标签；网页版只读不渲染 */}
      {isNative && (
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
        {/* 鲁港通 - 资料库常驻标签：不可关闭，点击切到资料库列表 */}
        {library && (
          <Flex
            alignItems={'center'}
            gap={1}
            h={'28px'}
            minW={'94px'}
            maxW={'200px'}
            flexShrink={0}
            px={'8px'}
            borderRadius={'6px'}
            bg={panelView === 'library' ? 'white' : 'transparent'}
            border={'1px solid'}
            borderColor={panelView === 'library' ? LG.line : 'transparent'}
            cursor={'pointer'}
            _hover={{ bg: 'white', borderColor: LG.line }}
            onClick={() => {
              revokeLibraryImage();
              setLibraryPreview(null);
              setActiveDocToken(null);
              setLibraryOpen(true);
            }}
          >
            <MyIcon
              name={'common/folderFill'}
              w={'12px'}
              h={'12px'}
              flexShrink={0}
              color={panelView === 'library' ? LG.mountain : LG.mutedSoft}
            />
            <Text
              flex={'1 1 0'}
              fontSize={'13px'}
              noOfLines={1}
              color={panelView === 'library' ? LG.ink : LG.muted}
            >
              {t('common:builtin_browser_library_open' as any)}
            </Text>
          </Flex>
        )}
        {tabs.map((tab) => (
          <Flex
            key={tab.index}
            alignItems={'center'}
            gap={1}
            h={'28px'}
            minW={'94px'}
            maxW={'200px'}
            flexShrink={0}
            px={'8px'}
            borderRadius={'6px'}
            bg={tab.locked ? '#F2F8FE' : tab.current && !activeDocToken ? 'white' : 'transparent'}
            border={'1px solid'}
            borderColor={
              tab.locked ? '#D7E7F7' : tab.current && !activeDocToken ? LG.line : 'transparent'
            }
            title={tab.locked ? t('common:builtin_browser_ai_locked_tab_hint') : undefined}
            cursor={'pointer'}
            _hover={{ bg: 'white', borderColor: LG.line }}
            onClick={() => void handleSelectTab(tab.index)}
            onMouseDown={(e) => {
              if (e.button === 1) e.preventDefault();
            }}
            onAuxClick={(e) => {
              if (e.button !== 1) return;
              e.preventDefault();
              e.stopPropagation();
              void handleCloseTab(tab.index);
            }}
          >
            <Text
              flex={'1 1 0'}
              fontSize={'13px'}
              noOfLines={1}
              color={tab.current && !activeDocToken ? LG.ink : LG.muted}
            >
              {tabLabel(tab)}
            </Text>
            {/* 鲁港通 - 锁定标签不给关闭入口，改用机器徽标提示 AI 正在操作 */}
            {tab.locked ? (
              <MyTooltip label={t('common:builtin_browser_ai_locked_tab_hint')}>
                <Flex
                  alignItems={'center'}
                  justifyContent={'center'}
                  flexShrink={0}
                  cursor={'pointer'}
                  aria-label={t('common:builtin_browser_ai_locked_tab_hint')}
                  onClick={(e) => {
                    e.stopPropagation();
                    notifyLockedTab();
                  }}
                >
                  <MyIcon name={'common/robot'} w={'12px'} h={'12px'} color={LG.mountain} />
                </Flex>
              </MyTooltip>
            ) : (
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
            )}
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
              h={'28px'}
              minW={'94px'}
              maxW={'200px'}
              flexShrink={0}
              px={'6px'}
              borderRadius={'6px'}
              bg={isActiveDoc ? 'white' : 'transparent'}
              border={'1px solid'}
              borderColor={isActiveDoc ? LG.line : 'transparent'}
              cursor={'pointer'}
              _hover={{ bg: 'white', borderColor: LG.line }}
              onClick={() => {
                setLibraryOpen(false);
                setActiveDocToken(doc.token);
              }}
            >
              <DocumentFormatChip format={doc.format} size={14} />
              <Text
                flex={'1 1 0'}
                fontSize={'13px'}
                noOfLines={1}
                color={isActiveDoc ? LG.ink : LG.muted}
              >
                {doc.fileName}
              </Text>
              <MyIcon
                name={'close'}
                w={'12px'}
                h={'12px'}
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
            w={'28px'}
            h={'28px'}
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
      )}

      {/* 网址栏：左侧后退/前进/刷新，右侧缩放/查找/更多；输入后回车跳转；网页版只读不渲染 */}
      {panelView === 'browser' && isNative && (
        <Flex
          flexShrink={0}
          alignItems={'center'}
          gap={'3px'}
          px={'8px'}
          py={'5px'}
          bg={'#F5F9FE'}
          borderBottom={'1px solid'}
          borderBottomColor={LG.lineSoft}
        >
          {controls && (
            <>
              <ToolbarIcon
                name={'common/arrowLeft'}
                label={t('common:builtin_browser_back')}
                disabled={!navState.canGoBack}
                onClick={handleGoBack}
              />
              <ToolbarIcon
                name={'common/arrowRight'}
                label={t('common:builtin_browser_forward')}
                disabled={!navState.canGoForward}
                onClick={handleGoForward}
              />
              <ToolbarIcon
                name={'common/refresh'}
                label={t('common:builtin_browser_refresh')}
                disabled={isReloading}
                onClick={() => void handleReload()}
              />
            </>
          )}
          <Input
            ref={urlInputRef}
            flex={'1 1 0'}
            minW={0}
            size={'sm'}
            h={'30px'}
            fontSize={'13px'}
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
          {controls && navState.siteAiMode !== 'allow' && (
            <MyTooltip label={t('common:builtin_browser_site_ai_chip_tip')}>
              <Flex
                as={'button'}
                type={'button'}
                flexShrink={0}
                alignItems={'center'}
                gap={'3px'}
                h={'24px'}
                px={'5px'}
                borderRadius={'5px'}
                fontSize={'13px'}
                color={navState.siteAiMode === 'blocked' ? '#9E3E33' : '#8A6314'}
                bg={navState.siteAiMode === 'blocked' ? '#FBEDEA' : '#FBF3DF'}
                cursor={'pointer'}
                _hover={{ opacity: 0.82 }}
                onClick={handleSiteAiMenu}
              >
                <MyIcon
                  name={
                    navState.siteAiMode === 'blocked' ? 'common/disable' : 'common/viewLight'
                  }
                  w={'11px'}
                  h={'11px'}
                  color={navState.siteAiMode === 'blocked' ? '#9E3E33' : '#8A6314'}
                />
                {navState.siteAiMode === 'blocked'
                  ? t('common:builtin_browser_site_ai_blocked')
                  : t('common:builtin_browser_site_ai_read_only')}
              </Flex>
            </MyTooltip>
          )}
          {controls && panelWidth > 360 && (
            <MyTooltip label={t('common:builtin_browser_zoom_reset')}>
              <Text
                as={'button'}
                type={'button'}
                h={'24px'}
                minW={'42px'}
                px={'4px'}
                borderRadius={'5px'}
                fontSize={'13px'}
                color={navState.zoomPercent === 100 ? LG.muted : LG.mountain}
                bg={navState.zoomPercent === 100 ? 'transparent' : 'rgba(111,157,208,0.14)'}
                _hover={{ bg: 'rgba(54,101,150,0.08)' }}
                onClick={handleZoomReset}
              >
                {navState.zoomPercent}%
              </Text>
            </MyTooltip>
          )}
          {controls && (
            <ToolbarIcon
              name={'common/searchLight'}
              label={t('common:builtin_browser_find')}
              onClick={() => setFindOpen(true)}
            />
          )}
          {controls && (
            <ToolbarIcon
              name={'common/ellipsis'}
              label={t('common:builtin_browser_more')}
              onClick={() => void controls.openMenu().catch(() => undefined)}
            />
          )}
        </Flex>
      )}

      {/* 查找条：占布局高度，不覆盖网页；Esc 关闭并清除高亮 */}
      {panelView === 'browser' && controls && findOpen && (
        <Flex
          flexShrink={0}
          alignItems={'center'}
          gap={'4px'}
          px={'8px'}
          py={'4px'}
          bg={'#F2F7FD'}
          borderBottom={'1px solid'}
          borderBottomColor={LG.lineSoft}
        >
          <MyIcon
            name={'common/searchLight'}
            w={'12px'}
            h={'12px'}
            color={LG.mutedSoft}
            flexShrink={0}
          />
          <Input
            ref={findInputRef}
            size={'sm'}
            h={'26px'}
            fontSize={'13px'}
            flex={'1 1 0'}
            minW={0}
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onCompositionStart={() => setFindComposing(true)}
            onCompositionEnd={(e) => {
              setFindComposing(false);
              setFindQuery(e.currentTarget.value);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Enter') {
                e.preventDefault();
                handleFindNext(e.shiftKey ? 'previous' : 'next');
              } else if (e.key === 'Escape') {
                e.preventDefault();
                closeFind();
              }
            }}
            placeholder={t('common:builtin_browser_find_placeholder')}
            bg={'white'}
            border={'1px solid'}
            borderColor={LG.line}
            borderRadius={'6px'}
            color={'#4A5F75'}
            _focusVisible={{
              bg: 'white',
              borderColor: LG.lineStrong,
              boxShadow: '0 0 0 3px rgba(111,157,208,0.12)'
            }}
            _placeholder={{ color: '#9DAFC2' }}
          />
          <Text
            minW={'52px'}
            textAlign={'right'}
            fontSize={'13px'}
            whiteSpace={'nowrap'}
            color={findResult && findResult.matches === 0 ? '#C4823A' : LG.muted}
          >
            {findQuery.trim() && findResult
              ? findResult.matches > 0
                ? t('common:builtin_browser_find_count', {
                    current: findResult.activeMatchOrdinal,
                    total: findResult.matches
                  })
                : t('common:builtin_browser_find_no_result')
              : ''}
          </Text>
          <ToolbarIcon
            name={'common/leftArrowLight'}
            label={t('common:builtin_browser_find_prev')}
            disabled={!findResult || findResult.matches === 0}
            onClick={() => handleFindNext('previous')}
          />
          <ToolbarIcon
            name={'common/rightArrowLight'}
            label={t('common:builtin_browser_find_next')}
            disabled={!findResult || findResult.matches === 0}
            onClick={() => handleFindNext('next')}
          />
          <ToolbarIcon
            name={'close'}
            label={t('common:builtin_browser_find_close')}
            onClick={closeFind}
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
            libraryDocItem ? (
              // 鲁港通 - 从资料库进入的文件在预览上方显示返回/收藏/继续修改工具条
              <Flex flexDirection={'column'} h={'100%'} minH={0}>
                <LibraryDocToolbar
                  item={libraryDocItem}
                  busy={libraryBusy}
                  onBack={handleBackToLibrary}
                  actions={libraryActions}
                />
                <Box flex={'1 1 0'} minH={0}>
                  {docPreviewNode}
                </Box>
              </Flex>
            ) : (
              docPreviewNode
            )
          ) : (
            <Flex
              h={'100%'}
              flexDirection={'column'}
              alignItems={'center'}
              justifyContent={'center'}
              gap={3}
            >
              <MyIcon name={'common/loading'} w={'22px'} h={'22px'} color={LG.lake} />
              <Text fontSize={'14px'} color={LG.muted}>
                {t('common:builtin_browser_doc_loading')}
              </Text>
            </Flex>
          ))}

        {/* 鲁港通 - 资料库列表/预览：搜索筛选、缺失提示与空状态都在面板内完成 */}
        {panelView === 'library' && (
          <LibraryPanel
            items={libraryItems}
            preview={libraryPreview}
            busy={libraryBusy}
            actions={libraryActions}
            onImport={() => void handleImportLibrary()}
            onClosePreview={handleCloseLibraryPreview}
            onRevealFolder={handleRevealLibraryFolder}
          />
        )}

        {/* 鲁港通 - 落地页两层入口：打开互联网网址，或选择本机文档预览修改 */}
        {panelView === 'landing' && (
          <Flex
            h={'100%'}
            flexDirection={'column'}
            alignItems={'center'}
            justifyContent={'flex-start'}
            gap={'12px'}
            px={6}
            py={8}
            overflowY={'auto'}
          >
            {/* 鲁港通 - P2 场景模板：常用代办场景四卡，提交后由输入区自动发送指令 */}
            <ScenarioSection
              ref={scenarioSectionRef}
              focus={builtinBrowser?.scenarioFocus ?? null}
              onSubmit={(text) => builtinBrowser?.queueScenarioPrompt(text)}
            />

            <Flex alignItems={'center'} gap={'6px'} mb={'1'}>
              <MyIcon name={'common/globalLine'} w={'16px'} h={'16px'} color={LG.mountain} />
              <Text fontSize={'14.5px'} fontWeight={600} color={LG.ink}>
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
              <Text fontSize={'13px'} fontWeight={600} color={LG.text} mb={'6px'}>
                {t('common:builtin_browser_doc_landing_url_label')}
              </Text>
              <Flex gap={'6px'}>
                <Input
                  ref={urlInputRef}
                  size={'sm'}
                  h={'32px'}
                  fontSize={'13px'}
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
                  h={'32px'}
                  px={'14px'}
                  fontSize={'13px'}
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
                <Text fontSize={'13px'} fontWeight={600} color={LG.text} mb={'6px'}>
                  {t('common:builtin_browser_doc_landing_file_label')}
                </Text>
                <Button
                  w={'100%'}
                  size={'sm'}
                  h={'32px'}
                  fontSize={'13px'}
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
                <Text mt={'6px'} fontSize={'13px'} color={LG.mutedSoft}>
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
            <Text fontSize={'14px'} color={LG.muted}>
              {t('common:builtin_browser_loading')}
            </Text>
            {loadingSlow && (
              <Text fontSize={'13px'} color={LG.mutedSoft} textAlign={'center'} px={6}>
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
            <Text fontSize={'14px'} color={LG.text} textAlign={'center'}>
              {errorMessage}
            </Text>
            <Button size={'sm'} variant={'primary'} onClick={() => void loadSession()}>
              {t('common:builtin_browser_retry')}
            </Button>
          </Flex>
        )}

        {/* 鲁港通 - 网页版只读：不嵌入云端画面，避免伪装成可手动操作的浏览器 */}
        {cloudReadOnly && status === 'active' && (
          <Flex
            h={'100%'}
            flexDirection={'column'}
            alignItems={'center'}
            justifyContent={'center'}
            gap={'10px'}
            px={6}
            textAlign={'center'}
          >
            <Flex
              w={'44px'}
              h={'44px'}
              borderRadius={'full'}
              bg={'rgba(111,157,208,0.12)'}
              alignItems={'center'}
              justifyContent={'center'}
            >
              <MyIcon name={'common/globalLine'} w={'20px'} h={'20px'} color={LG.mountain} />
            </Flex>
            <Text fontSize={'14px'} fontWeight={600} color={LG.ink}>
              {t('common:builtin_browser_web_readonly_title')}
            </Text>
            <Text fontSize={'13px'} color={LG.muted} maxW={'320px'} lineHeight={'1.6'}>
              {t('common:builtin_browser_web_readonly_desc')}
            </Text>
          </Flex>
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
              <Text fontSize={'14px'}>{t('common:builtin_browser_resizing')}</Text>
            )}
          </Flex>
        )}
          </>
        )}
      </Box>

      {/* 鲁港通 - 本次操作时间线：底部折叠条，运行中实时追加，结束/停止后保留可查 */}
      {aiState && aiState.steps.length > 0 && (
        <Box
          flexShrink={0}
          borderTop={'1px solid'}
          borderTopColor={LG.lineSoft}
          bg={'#F6FAFF'}
          px={2}
          pt={1.5}
        >
          <AiTimeline
            steps={aiState.steps}
            open={timelineOpen}
            onToggle={() => setTimelineOpen((open) => !open)}
          />
        </Box>
      )}

      {/* 下载任务条：最多 5 条，保存路径不出主进程 */}
      {controls && downloads.length > 0 && (
        <Flex
          flexShrink={0}
          flexDirection={'column'}
          borderTop={'1px solid'}
          borderTopColor={LG.lineSoft}
          bg={'#F8FBFF'}
          maxH={'170px'}
          overflowY={'auto'}
        >
          {downloads.map((item) => {
            const percent =
              item.totalBytes > 0
                ? Math.min(100, Math.round((item.receivedBytes / item.totalBytes) * 100))
                : undefined;
            return (
              <Flex
                key={item.id}
                alignItems={'center'}
                gap={'6px'}
                px={'9px'}
                py={'5px'}
                borderBottom={'1px solid'}
                borderBottomColor={'rgba(231,241,251,0.7)'}
              >
                <MyIcon
                  name={'common/download'}
                  w={'13px'}
                  h={'13px'}
                  flexShrink={0}
                  color={item.status === 'progressing' ? LG.lake : LG.mutedSoft}
                />
                <Text
                  flex={'1 1 0'}
                  minW={0}
                  fontSize={'13px'}
                  noOfLines={1}
                  color={LG.text}
                  title={item.fileName}
                >
                  {item.fileName}
                </Text>
                {item.status === 'progressing' ? (
                  <>
                    <Box
                      w={'54px'}
                      h={'3px'}
                      flexShrink={0}
                      borderRadius={'2px'}
                      bg={LG.pale}
                      overflow={'hidden'}
                    >
                      <Box
                        h={'100%'}
                        w={`${percent ?? 15}%`}
                        bg={'linear-gradient(90deg, #8FB4DC, #4F80B4)'}
                      />
                    </Box>
                    <Text
                      fontSize={'13px'}
                      color={LG.muted}
                      minW={'32px'}
                      textAlign={'right'}
                      whiteSpace={'nowrap'}
                    >
                      {percent === undefined ? formatBytes(item.receivedBytes) : `${percent}%`}
                    </Text>
                    <ToolbarIcon
                      name={'close'}
                      label={t('common:builtin_browser_download_cancel')}
                      onClick={() => void handleDownloadAction('cancel', item.id)}
                    />
                  </>
                ) : item.status === 'completed' ? (
                  <>
                    <Text fontSize={'13px'} color={LG.mutedSoft} flexShrink={0}>
                      {formatBytes(item.totalBytes)}
                    </Text>
                    <Text
                      as={'button'}
                      type={'button'}
                      fontSize={'13px'}
                      color={LG.mountain}
                      whiteSpace={'nowrap'}
                      _hover={{ textDecoration: 'underline' }}
                      onClick={() => void handleDownloadAction('open', item.id)}
                    >
                      {t('common:builtin_browser_download_open')}
                    </Text>
                    <Text
                      as={'button'}
                      type={'button'}
                      fontSize={'13px'}
                      color={LG.mountain}
                      whiteSpace={'nowrap'}
                      _hover={{ textDecoration: 'underline' }}
                      onClick={() => void handleDownloadAction('folder', item.id)}
                    >
                      {t('common:builtin_browser_download_folder')}
                    </Text>
                    <ToolbarIcon
                      name={'close'}
                      label={t('common:builtin_browser_download_dismiss')}
                      onClick={() => void handleDownloadAction('dismiss', item.id)}
                    />
                  </>
                ) : (
                  <>
                    <Text fontSize={'13px'} color={'#C4823A'} flexShrink={0}>
                      {item.status === 'cancelled'
                        ? t('common:builtin_browser_download_cancelled')
                        : t('common:builtin_browser_download_failed')}
                    </Text>
                    <ToolbarIcon
                      name={'close'}
                      label={t('common:builtin_browser_download_dismiss')}
                      onClick={() => void handleDownloadAction('dismiss', item.id)}
                    />
                  </>
                )}
              </Flex>
            );
          })}
        </Flex>
      )}

      {/* 清除浏览数据：应用级模态会临时隐藏原生视图 */}
      <Modal
        isOpen={clearOpen}
        onClose={() => {
          if (!clearing) setClearOpen(false);
        }}
        isCentered
        autoFocus={false}
        size={'sm'}
      >
        <ModalOverlay bg={'rgba(20,36,54,0.28)'} zIndex={1500} />
        <ModalContent borderRadius={'12px'} p={'18px'} containerProps={{ zIndex: 1501 }}>
          <Text fontSize={'15px'} fontWeight={600} color={LG.ink}>
            {t('common:builtin_browser_clear_title')}
          </Text>
          <Text mt={'4px'} fontSize={'13px'} color={LG.muted}>
            {t('common:builtin_browser_clear_desc')}
          </Text>
          <Flex flexDirection={'column'} gap={'8px'} mt={'14px'}>
            <Checkbox
              size={'sm'}
              fontSize={'13px'}
              color={LG.text}
              isChecked={clearOptions.cookies}
              onChange={(e) =>
                setClearOptions((prev) => ({ ...prev, cookies: e.target.checked }))
              }
            >
              {t('common:builtin_browser_clear_cookies')}
            </Checkbox>
            <Checkbox
              size={'sm'}
              fontSize={'13px'}
              color={LG.text}
              isChecked={clearOptions.cache}
              onChange={(e) => setClearOptions((prev) => ({ ...prev, cache: e.target.checked }))}
            >
              {t('common:builtin_browser_clear_cache')}
            </Checkbox>
            <Checkbox
              size={'sm'}
              fontSize={'13px'}
              color={LG.text}
              isChecked={clearOptions.permissions}
              onChange={(e) =>
                setClearOptions((prev) => ({ ...prev, permissions: e.target.checked }))
              }
            >
              {t('common:builtin_browser_clear_permissions')}
            </Checkbox>
          </Flex>
          <Text mt={'10px'} fontSize={'13px'} color={LG.mutedSoft}>
            {t('common:builtin_browser_clear_hint')}
          </Text>
          <Flex justifyContent={'flex-end'} gap={'8px'} mt={'16px'}>
            <Button
              size={'sm'}
              h={'30px'}
              px={'15px'}
              fontSize={'13px'}
              borderRadius={'6px'}
              variant={'ghost'}
              color={LG.muted}
              isDisabled={clearing}
              onClick={() => setClearOpen(false)}
            >
              {t('common:Cancel')}
            </Button>
            <Button
              size={'sm'}
              h={'30px'}
              px={'15px'}
              fontSize={'13px'}
              borderRadius={'6px'}
              colorScheme={'red'}
              isDisabled={clearSelectedCount === 0}
              isLoading={clearing}
              onClick={() => void handleClearBrowsingData()}
            >
              {t('common:builtin_browser_clear_confirm')}
            </Button>
          </Flex>
        </ModalContent>
      </Modal>

      {/* 键盘快捷键：与浏览器一致的常用操作说明 */}
      <Modal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        isCentered
        autoFocus={false}
        size={'sm'}
      >
        <ModalOverlay bg={'rgba(20,36,54,0.28)'} zIndex={1500} />
        <ModalContent borderRadius={'12px'} p={'18px'} containerProps={{ zIndex: 1501 }}>
          <Text fontSize={'15px'} fontWeight={600} color={LG.ink}>
            {t('common:builtin_browser_shortcuts_title')}
          </Text>
          <Flex flexDirection={'column'} mt={'10px'}>
            {[
              [t('common:builtin_browser_shortcut_back'), 'Alt + ← / →'],
              [t('common:builtin_browser_shortcut_find'), 'Ctrl + F'],
              [t('common:builtin_browser_shortcut_tabs'), 'Ctrl + T / W'],
              [t('common:builtin_browser_shortcut_url'), 'Ctrl + L'],
              [t('common:builtin_browser_shortcut_reload'), 'Ctrl + R'],
              [t('common:builtin_browser_shortcut_zoom'), 'Ctrl + + / -'],
              [t('common:builtin_browser_shortcut_reset_zoom'), 'Ctrl + 0'],
              [t('common:builtin_browser_shortcut_print'), 'Ctrl + P'],
              [t('common:builtin_browser_shortcut_escape'), 'Esc']
            ].map(([label, keys]) => (
              <Flex
                key={label}
                justifyContent={'space-between'}
                alignItems={'center'}
                py={'4px'}
                fontSize={'13px'}
              >
                <Text color={LG.text}>{label}</Text>
                <Text color={LG.mountain} fontWeight={500} whiteSpace={'nowrap'}>
                  {keys}
                </Text>
              </Flex>
            ))}
          </Flex>
          <Flex justifyContent={'flex-end'} mt={'12px'}>
            <Button
              size={'sm'}
              h={'30px'}
              px={'15px'}
              fontSize={'13px'}
              borderRadius={'6px'}
              variant={'primary'}
              onClick={() => setShortcutsOpen(false)}
            >
              {t('common:Close')}
            </Button>
          </Flex>
        </ModalContent>
      </Modal>

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
