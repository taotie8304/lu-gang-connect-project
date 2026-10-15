// 鲁港通 - 办事浏览器右栏面板（内置浏览器 P1）：
// 聊天页右侧内嵌浏览器画面（PC 端），用户可随时接管键鼠操作；
// 关闭面板即结束本次使用（释放云端会话）；单次时长上限由服务端控制，临近上限本地提醒
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import PageContainer from '@/components/PageContainer';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import { getErrText } from '@fastgpt/global/common/error/utils';
import { BUILTIN_BROWSER_REMIND_BEFORE_MINUTES } from '@fastgpt/global/support/builtinBrowser/constant';
import type { BuiltinBrowserViewport } from '@fastgpt/global/support/builtinBrowser/type';
import {
  deleteBuiltinBrowserSession,
  postOpenBuiltinBrowserSession,
  putBuiltinBrowserViewport
} from '@/web/support/builtinBrowser/api';
import { BuiltinBrowserContext, useBuiltinBrowserVisible } from './context';

const PANEL_WIDTH = '480px';
const MINUTE_MS = 60 * 1000;
const COUNTDOWN_TICK_MS = 30 * 1000;
// 鲁港通 - 窗口拉伸/缩放后延迟 600ms 再同步云端视口，避免拖动过程连发请求
const VIEWPORT_FOLLOW_DEBOUNCE_MS = 600;

type BuiltinBrowserSessionState = {
  resourceUrl: string;
  expiresAt: string;
};

const BuiltinBrowserPanelBody = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { openConfirm, ConfirmModal } = useConfirm({ type: 'common' });
  const builtinBrowser = useContext(BuiltinBrowserContext);

  const [status, setStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [session, setSession] = useState<BuiltinBrowserSessionState>();
  const [errorMessage, setErrorMessage] = useState('');
  const [remainingMs, setRemainingMs] = useState<number>();

  const bodyRef = useRef<HTMLDivElement>(null);

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
    });
  }, [status, openConfirm, t, closeSession, builtinBrowser]);

  if (!isOpen) return null;

  const remainingMinutes =
    remainingMs === undefined ? undefined : Math.max(1, Math.ceil(remainingMs / MINUTE_MS));
  const isExpiringSoon =
    remainingMs !== undefined && remainingMs <= BUILTIN_BROWSER_REMIND_BEFORE_MINUTES * MINUTE_MS;

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
        {status === 'active' && remainingMinutes !== undefined && (
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

      {/* Body */}
      <Box ref={bodyRef} flex={'1 0 0'} minH={0} position={'relative'} bg={'white'}>
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
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
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

  if (!isVisible || !builtinBrowser?.isOpen) return null;

  return (
    <PageContainer
      flex={`0 0 ${PANEL_WIDTH}`}
      w={PANEL_WIDTH}
      maxW={PANEL_WIDTH}
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
      <BuiltinBrowserPanelBody />
    </PageContainer>
  );
};

export default BuiltinBrowserPanel;
