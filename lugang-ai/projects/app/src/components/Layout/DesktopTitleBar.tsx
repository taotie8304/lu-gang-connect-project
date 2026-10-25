/**
 * 鲁港通 - 桌面客户端自绘标题栏
 * 只在支持窗口控制的新客户端渲染（老客户端仍是系统原生标题栏）：
 * 左侧品牌与侧栏折叠，右侧最小化 / 最大化还原 / 关闭，整条可拖动窗口。
 */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import type { DesktopWindowControls } from '@/pageComponents/chat/builtinBrowser/desktopBridge';
import {
  DESKTOP_TITLE_BAR_HEIGHT,
  getDesktopSidebarControl,
  getDesktopWindowControls,
  subscribeDesktopSidebar,
  subscribeDesktopTitleBar
} from '@/web/common/system/desktopShell';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import styles from './DesktopTitleBar.module.scss';

const getServerSidebarControl = () => undefined;
const getServerWindowControls = () => undefined;

const MinimizeIcon = () => (
  <Box as="svg" w="10px" h="10px" viewBox="0 0 10 10" aria-hidden>
    <path d="M2 5h6" stroke="currentColor" strokeWidth="1" />
  </Box>
);

const MaximizeIcon = () => (
  <Box as="svg" w="10px" h="10px" viewBox="0 0 10 10" aria-hidden>
    <rect x="2.5" y="2.5" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1" />
  </Box>
);

const RestoreIcon = () => (
  <Box as="svg" w="10px" h="10px" viewBox="0 0 10 10" aria-hidden>
    <rect
      x="2"
      y="3.5"
      width="4.5"
      height="4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    />
    <path d="M3.5 3.5V2h4.5v4.5H6.5" fill="none" stroke="currentColor" strokeWidth="1" />
  </Box>
);

const CloseIcon = () => (
  <Box as="svg" w="10px" h="10px" viewBox="0 0 10 10" aria-hidden>
    <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.2" />
  </Box>
);

const SidebarIcon = () => (
  <Box as="svg" w="14px" h="14px" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
    <path d="M9 4v16" stroke="currentColor" strokeWidth="1.6" />
  </Box>
);

type Theme = {
  barBg: string;
  borderColor: string;
  sealBg: string;
  brandColor: string;
  taglineColor: string;
  actionColor: string;
  actionHoverBg: string;
};

const LIGHT_THEME: Theme = {
  barBg: 'rgba(251,253,255,0.92)',
  borderColor: 'rgba(54,101,150,0.1)',
  sealBg: 'linear-gradient(145deg, #A3C3E6, #6F9DD0)',
  brandColor: '#1F3142',
  taglineColor: '#4F80B4',
  actionColor: '#4B6478',
  actionHoverBg: 'rgba(111,157,208,0.14)'
};

// 鲁港通 - 登录页是深色水墨底，标题栏换成同色系深底，避免顶部出现一条亮边
const DARK_THEME: Theme = {
  barBg: 'rgba(6,18,31,0.9)',
  borderColor: 'rgba(200,169,106,0.28)',
  sealBg: 'linear-gradient(145deg, #D9C08A, #B29155)',
  brandColor: '#F7F3E8',
  taglineColor: '#C8A96A',
  actionColor: '#D9D3C4',
  actionHoverBg: 'rgba(255,255,255,0.1)'
};

const WindowButton = ({
  label,
  theme,
  danger,
  onClick,
  children
}: {
  label: string;
  theme: Theme;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Flex
    as="button"
    type="button"
    className={styles.action}
    w="46px"
    h="full"
    flexShrink={0}
    alignItems="center"
    justifyContent="center"
    border={0}
    bg="transparent"
    color={theme.actionColor}
    cursor="pointer"
    title={label}
    aria-label={label}
    _hover={{ bg: danger ? '#C0483F' : theme.actionHoverBg, color: danger ? '#FFFFFF' : undefined }}
    onClick={onClick}
  >
    {children}
  </Flex>
);

const DesktopTitleBar = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const brand = useSystemStore((s) => s.feConfigs?.systemTitle) || '鲁港通';
  // 鲁港通 - 窗口能力在页面生命周期内不变：服务端快照为空，水合后自动切到真实值
  const controls = useSyncExternalStore<DesktopWindowControls | undefined>(
    subscribeDesktopTitleBar,
    getDesktopWindowControls,
    getServerWindowControls
  );
  const sidebar = useSyncExternalStore(
    subscribeDesktopSidebar,
    getDesktopSidebarControl,
    getServerSidebarControl
  );
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!controls) return;
    let alive = true;
    void controls
      .isMaximized()
      .then((value) => {
        if (alive) setMaximized(value);
      })
      .catch(() => undefined);
    const unsubscribe = controls.onMaximizeChange((value) => {
      if (alive) setMaximized(value);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [controls]);

  // 鲁港通 - 浏览器与老客户端没有窗口能力：不渲染自绘标题栏，保留系统原生标题栏
  if (!controls) return null;

  // 鲁港通 - 登录页自身已有品牌区，标题栏只保留窗口按钮与拖动区，避免两处品牌上下相邻
  const isLogin = router.pathname.startsWith('/login');
  const theme = isLogin ? DARK_THEME : LIGHT_THEME;
  const sidebarLabel = sidebar?.collapsed
    ? t('common:desktop_sidebar_expand')
    : t('common:desktop_sidebar_collapse');
  const maximizeLabel = maximized
    ? t('common:desktop_window_restore')
    : t('common:desktop_window_maximize');

  return (
    <Flex
      className={styles.bar}
      position="fixed"
      top={0}
      left={0}
      right={0}
      h={`${DESKTOP_TITLE_BAR_HEIGHT}px`}
      zIndex={1200}
      alignItems="center"
      bg={theme.barBg}
      borderBottom="1px solid"
      borderColor={theme.borderColor}
      backdropFilter="blur(12px)"
      userSelect="none"
    >
      {!isLogin && (
        <Flex alignItems="center" gap="10px" pl="14px" pr="10px" minW={0}>
          {sidebar && (
            <Flex
              as="button"
              type="button"
              className={styles.action}
              w="24px"
              h="24px"
              flexShrink={0}
              alignItems="center"
              justifyContent="center"
              border={0}
              borderRadius="6px"
              bg="transparent"
              color={theme.actionColor}
              cursor="pointer"
              title={sidebarLabel}
              aria-label={sidebarLabel}
              _hover={{ bg: theme.actionHoverBg }}
              onClick={() => sidebar.toggle()}
            >
              <SidebarIcon />
            </Flex>
          )}

          <Flex alignItems="center" gap="8px" flexShrink={0}>
            <Flex
              w="18px"
              h="18px"
              flexShrink={0}
              borderRadius="5px"
              bg={theme.sealBg}
              color="#FFFFFF"
              alignItems="center"
              justifyContent="center"
              fontSize="10px"
              fontWeight={700}
              fontFamily={'"STKaiti","KaiTi","PingFang SC",serif'}
            >
              鲁
            </Flex>
            <Text
              fontSize="12px"
              fontWeight={600}
              letterSpacing="0.18em"
              color={theme.brandColor}
              whiteSpace="nowrap"
            >
              {brand}
            </Text>
            <Text
              fontSize="9.5px"
              letterSpacing="0.28em"
              color={theme.taglineColor}
              whiteSpace="nowrap"
              display={{ base: 'none', md: 'block' }}
            >
              智联鲁港
            </Text>
          </Flex>
        </Flex>
      )}

      <Box flex="1 0 0" />

      <Flex alignItems="stretch" h="full">
        <WindowButton
          label={t('common:desktop_window_minimize')}
          theme={theme}
          onClick={() => controls.minimize()}
        >
          <MinimizeIcon />
        </WindowButton>
        <WindowButton label={maximizeLabel} theme={theme} onClick={() => controls.toggleMaximize()}>
          {maximized ? <RestoreIcon /> : <MaximizeIcon />}
        </WindowButton>
        <WindowButton
          label={t('common:desktop_window_close')}
          theme={theme}
          danger
          onClick={() => controls.close()}
        >
          <CloseIcon />
        </WindowButton>
      </Flex>
    </Flex>
  );
};

export default React.memo(DesktopTitleBar);
