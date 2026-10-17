// 鲁港通 - 办事浏览器右栏面板（内置浏览器 P1）：
// 聊天页右侧内嵌浏览器画面（PC 端），用户可随时接管键鼠操作；
// 画面按云端查看器实测几何裁切，只显示浏览器页面本身（豆包式固定画面，不可拖动、不可移动）；
// 面板左缘可拖拽调宽（宽度本地记忆），网址栏可手动输入网址让云端浏览器跳转；
// 关闭面板即结束本次使用（释放云端会话）；单次时长上限由服务端控制，临近上限本地提醒
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
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
  BUILTIN_BROWSER_PANEL_DEFAULT_WIDTH,
  BUILTIN_BROWSER_PANEL_WIDTH_STORAGE_KEY,
  BUILTIN_BROWSER_REMIND_BEFORE_MINUTES
} from '@fastgpt/global/support/builtinBrowser/constant';
import { clampBuiltinBrowserPanelWidth } from '@fastgpt/global/support/builtinBrowser/panelWidth';
import type {
  BuiltinBrowserTab,
  BuiltinBrowserViewport
} from '@fastgpt/global/support/builtinBrowser/type';
import { normalizeBuiltinBrowserUrl } from '@fastgpt/global/support/builtinBrowser/url';
import {
  deleteBuiltinBrowserSession,
  deleteBuiltinBrowserTab,
  getBuiltinBrowserTabs,
  patchBuiltinBrowserNavigate,
  patchSelectBuiltinBrowserTab,
  postNewBuiltinBrowserTab,
  postOpenBuiltinBrowserSession,
  putBuiltinBrowserViewport
} from '@/web/support/builtinBrowser/api';
import { BuiltinBrowserContext, useBuiltinBrowserVisible } from './context';

const MINUTE_MS = 60 * 1000;
const COUNTDOWN_TICK_MS = 30 * 1000;
// 鲁港通 - 窗口拉伸/缩放后延迟 600ms 再同步云端视口，避免拖动过程连发请求
const VIEWPORT_FOLLOW_DEBOUNCE_MS = 600;
// 鲁港通 - 标签条轮询间隔：云端页面内自行跳转/开关标签时，前端靠轮询对齐
const TAB_REFRESH_INTERVAL_MS = 3000;
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

const BuiltinBrowserPanelBody = ({ panelWidth }: { panelWidth: number }) => {
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

  const bodyRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const urlEditingRef = useRef(false);
  const didAutoFocusRef = useRef(false);

  const { runAsync: openSession } = useRequest(postOpenBuiltinBrowserSession, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: closeSession } = useRequest(deleteBuiltinBrowserSession, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: resizeViewport } = useRequest(putBuiltinBrowserViewport, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: navigateSession, loading: isNavigating } = useRequest(
    patchBuiltinBrowserNavigate,
    { manual: true, errorToast: '' }
  );
  const { runAsync: fetchTabs } = useRequest(getBuiltinBrowserTabs, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: createTab } = useRequest(postNewBuiltinBrowserTab, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: selectTab } = useRequest(patchSelectBuiltinBrowserTab, {
    manual: true,
    errorToast: ''
  });
  const { runAsync: closeTab } = useRequest(deleteBuiltinBrowserTab, {
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

  // 鲁港通 - 开台/复用请求：携带当前面板视口，让云端画面与面板尺寸一致；面板每次打开均为新挂载（初始态即 loading），此处不再重置状态
  const requestOpenSession = useCallback(
    () =>
      openSession({ viewport: measureViewport() })
        .then((res) => {
          setSession({ resourceUrl: res.resourceUrl, expiresAt: res.expiresAt });
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
    setErrorMessage('');
    return requestOpenSession();
  }, [requestOpenSession]);

  // 鲁港通 - 打开面板即开台；已有进行中的会话时服务端直接复用（不重复建台）
  useEffect(() => {
    void requestOpenSession();
  }, [requestOpenSession]);

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
    if (urlEditingRef.current) return;
    const current = nextTabs.find((tab) => tab.current);
    setUrlInput(current && current.url !== 'about:blank' ? current.url : '');
  }, []);

  const refreshTabs = useCallback(async () => {
    try {
      const res = await fetchTabs();
      applyTabs(res.tabs);
    } catch {
      // 轮询失败静默：下一轮自动重试
    }
  }, [fetchTabs, applyTabs]);

  // 鲁港通 - 标签轮询：用户在画面内跳转/开关标签时，标签条随时间对齐云端状态
  useEffect(() => {
    if (status !== 'active') return;

    const initial = setTimeout(() => void refreshTabs(), 0);
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void refreshTabs();
    }, TAB_REFRESH_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [status, refreshTabs]);

  // 鲁港通 - 空白起始页自动聚焦网址栏，减少「打开后不知道做什么」的停顿
  useEffect(() => {
    if (status !== 'active' || didAutoFocusRef.current) return;
    const current = tabs.find((tab) => tab.current);
    if (!current) return;
    didAutoFocusRef.current = true;
    if (!current.url || current.url === 'about:blank') {
      urlInputRef.current?.focus();
    }
  }, [status, tabs]);

  // 鲁港通 - 新建标签：云端选中新空白页，前端同步标签条并聚焦网址栏
  const handleNewTab = useCallback(async () => {
    try {
      const res = await createTab();
      urlEditingRef.current = false;
      applyTabs(res.tabs);
      urlInputRef.current?.focus();
    } catch (err) {
      showTabActionFailed(err);
    }
  }, [applyTabs, createTab, showTabActionFailed]);

  const handleSelectTab = useCallback(
    async (index: number) => {
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

  // 鲁港通 - 尺寸即时跟随：窗口拉伸/缩放后防抖同步云端视口，让画面持续贴合面板
  useEffect(() => {
    if (status !== 'active') return;
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSize = { width: el.clientWidth, height: el.clientHeight };

    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width === lastSize.width && height === lastSize.height) return;
      lastSize = { width, height };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const viewport = measureViewport();
        if (viewport) void resizeViewport(viewport).catch(() => undefined);
      }, VIEWPORT_FOLLOW_DEBOUNCE_MS);
    });
    observer.observe(el);

    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [status, measureViewport, resizeViewport]);

  // 鲁港通 - 网址栏跳转：先本地归一化校验（与服务端同一工具），失败给可操作提示；
  // 云端跳转是异步的，面板画面会随远端页面刷新，前端无需重载
  const handleNavigate = useCallback(async () => {
    const target = normalizeBuiltinBrowserUrl(urlInput);
    if (!target) {
      toast({ title: t('common:builtin_browser_url_invalid'), status: 'warning' });
      return;
    }

    try {
      const res = await navigateSession(target);
      if (!res.navigated) {
        toast({ title: t('common:builtin_browser_url_open_failed'), status: 'warning' });
        return;
      }
      setUrlInput(target);
      void refreshTabs();
    } catch (err) {
      toast({
        title: t(getErrText(err, 'common:builtin_browser_url_open_failed') as any),
        status: 'warning'
      });
    }
  }, [navigateSession, refreshTabs, t, toast, urlInput]);

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
      customContent: t('common:builtin_browser_close_confirm'),
      confirmText: t('common:builtin_browser_close'),
      onConfirm: endSession
    })();
  }, [status, openConfirm, t, closeSession, builtinBrowser]);

  if (!isOpen) return null;

  const remainingMinutes =
    remainingMs === undefined ? undefined : Math.max(1, Math.ceil(remainingMs / MINUTE_MS));
  const isExpiringSoon =
    remainingMs !== undefined && remainingMs <= BUILTIN_BROWSER_REMIND_BEFORE_MINUTES * MINUTE_MS;
  const showRemaining = panelWidth >= HEADER_HIDE_REMAINING_WIDTH;

  return (
    <Flex flexDirection={'column'} h={'100%'} minH={0}>
      {/* Header */}
      <Flex
        flexShrink={0}
        alignItems={'center'}
        gap={2}
        h={'48px'}
        px={4}
        borderBottom={'1px solid'}
        borderBottomColor={'myGray.200'}
      >
        <MyIcon name={'common/globalLine'} w={'16px'} h={'16px'} color={'myGray.600'} />
        <Text fontSize={'sm'} fontWeight={500} color={'myGray.900'} whiteSpace={'nowrap'}>
          {t('common:builtin_browser')}
        </Text>
        {status === 'active' && showRemaining && remainingMinutes !== undefined && (
          <Text
            fontSize={'xs'}
            color={isExpiringSoon ? 'orange.500' : 'myGray.500'}
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

        {status === 'active' && (
          <MyTooltip label={t('common:builtin_browser_refresh')}>
            <MyIcon
              name={'common/refresh'}
              w={'16px'}
              h={'16px'}
              color={'myGray.500'}
              cursor={'pointer'}
              _hover={{ color: 'myGray.700' }}
              onClick={() => void loadSession()}
            />
          </MyTooltip>
        )}
        <MyTooltip label={t('common:builtin_browser_close')}>
          <MyIcon
            name={'close'}
            w={'16px'}
            h={'16px'}
            color={'myGray.500'}
            cursor={'pointer'}
            _hover={{ color: 'myGray.700' }}
            onClick={handleClose}
          />
        </MyTooltip>
      </Flex>

      {/* 标签条：用户标签从云端 index 1 起（0 为隐藏占位），+ 新建空白标签 */}
      <Flex
        flexShrink={0}
        alignItems={'center'}
        gap={1}
        px={2}
        py={1.5}
        borderBottom={'1px solid'}
        borderBottomColor={'myGray.200'}
        overflowX={'auto'}
        css={{ '&::-webkit-scrollbar': { height: '2px' } }}
      >
        {tabs.map((tab) => (
          <Flex
            key={tab.index}
            alignItems={'center'}
            gap={1}
            h={'28px'}
            minW={'96px'}
            maxW={'180px'}
            flexShrink={0}
            px={2}
            borderRadius={'md'}
            bg={tab.current ? 'white' : 'myGray.100'}
            border={'1px solid'}
            borderColor={tab.current ? 'primary.300' : 'transparent'}
            cursor={'pointer'}
            _hover={{ bg: tab.current ? 'white' : 'myGray.200' }}
            onClick={() => void handleSelectTab(tab.index)}
          >
            <Text
              flex={'1 1 0'}
              fontSize={'xs'}
              noOfLines={1}
              color={tab.current ? 'myGray.900' : 'myGray.600'}
            >
              {tabLabel(tab)}
            </Text>
            <MyIcon
              name={'close'}
              w={'12px'}
              h={'12px'}
              flexShrink={0}
              color={'myGray.400'}
              _hover={{ color: 'myGray.700' }}
              aria-label={t('common:builtin_browser_close_tab')}
              onClick={(e) => {
                e.stopPropagation();
                void handleCloseTab(tab.index);
              }}
            />
          </Flex>
        ))}
        <MyTooltip label={t('common:builtin_browser_new_tab')}>
          <Flex
            alignItems={'center'}
            justifyContent={'center'}
            w={'28px'}
            h={'28px'}
            flexShrink={0}
            borderRadius={'md'}
            color={status === 'active' ? 'myGray.500' : 'myGray.300'}
            cursor={status === 'active' ? 'pointer' : 'not-allowed'}
            _hover={status === 'active' ? { bg: 'myGray.100', color: 'myGray.700' } : undefined}
            onClick={() => {
              if (status === 'active') void handleNewTab();
            }}
          >
            <MyIcon name={'common/addLight'} w={'14px'} h={'14px'} />
          </Flex>
        </MyTooltip>
      </Flex>

      {/* 网址栏：输入后回车让云端浏览器跳转；非使用中禁用（保持布局稳定，画面区域尺寸不随状态变化） */}
      <Flex
        flexShrink={0}
        alignItems={'center'}
        px={3}
        py={2}
        borderBottom={'1px solid'}
        borderBottomColor={'myGray.200'}
      >
        <Input
          ref={urlInputRef}
          size={'sm'}
          fontSize={'sm'}
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
          isDisabled={status !== 'active' || isNavigating}
          bg={'myGray.100'}
          borderColor={'transparent'}
          _hover={{ bg: 'myGray.100' }}
          _focusVisible={{ bg: 'white', borderColor: 'primary.500' }}
          _placeholder={{ color: 'myGray.500' }}
        />
      </Flex>

      {/* Body：裁切容器，只显示云端浏览器页面本身（裁掉查看器工具栏与窗口外框） */}
      <Box
        ref={bodyRef}
        flex={'1 0 0'}
        minH={0}
        position={'relative'}
        overflow={'hidden'}
        bg={'white'}
      >
        {status === 'loading' && (
          <Flex
            h={'100%'}
            flexDirection={'column'}
            alignItems={'center'}
            justifyContent={'center'}
            gap={3}
          >
            <MyIcon name={'common/loading'} w={'24px'} h={'24px'} color={'primary.500'} />
            <Text fontSize={'sm'} color={'myGray.500'}>
              {t('common:builtin_browser_loading')}
            </Text>
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
            <MyIcon name={'common/error'} w={'24px'} h={'24px'} color={'red.500'} />
            <Text fontSize={'sm'} color={'myGray.600'} textAlign={'center'}>
              {errorMessage}
            </Text>
            <Button size={'sm'} variant={'primary'} onClick={() => void loadSession()}>
              {t('common:builtin_browser_retry')}
            </Button>
          </Flex>
        )}

        {status === 'active' && session && (
          <iframe
            key={session.resourceUrl}
            src={session.resourceUrl}
            title={t('common:builtin_browser')}
            style={{
              position: 'absolute',
              left: -BUILTIN_BROWSER_CROP_LEFT_PX,
              top: -BUILTIN_BROWSER_CROP_TOP_PX,
              width: `calc(100% + ${BUILTIN_BROWSER_CROP_LEFT_PX}px)`,
              height: `calc(100% + ${BUILTIN_BROWSER_CROP_TOP_PX}px)`,
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
          boxShadow: 'none',
          bg: 'white',
          borderLeft: '1px solid',
          borderLeftColor: 'myGray.200',
          borderRadius: [0, '0 16px 16px 0']
        }}
      >
        <BuiltinBrowserPanelBody panelWidth={panelWidth} />
      </PageContainer>

      {/* 鲁港通 - 拖拽手柄：面板左缘 6px 条带；拖动中覆盖全面板遮罩，防云端画面抢指针事件 */}
      <Box
        position={'absolute'}
        left={0}
        top={0}
        bottom={0}
        w={'6px'}
        zIndex={20}
        cursor={'col-resize'}
        _hover={{ bg: 'primary.100' }}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      />
      {isDragging && (
        <Box position={'absolute'} inset={0} zIndex={30} cursor={'col-resize'} bg={'transparent'} />
      )}
    </Flex>
  );
};

export default BuiltinBrowserPanel;
