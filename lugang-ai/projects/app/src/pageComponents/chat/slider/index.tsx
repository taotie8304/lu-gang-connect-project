import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Box, Button, Flex, Input, Text } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useContextSelector } from 'use-context-selector';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import Avatar from '@fastgpt/web/components/common/Avatar';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { formatNumber } from '@fastgpt/global/common/math/tools';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useUserStore } from '@/web/support/user/useUserStore';
import { getUserPointsDetail } from '@/web/support/wallet/points/api';
import { ChatPageContext } from '@/web/core/chat/context/chatPageContext';
import { ChatContext } from '@/web/core/chat/context/chatContext';
import { ChatItemContext } from '@/web/core/chat/context/chatItemContext';
import UserAvatarPopover from '@/pageComponents/chat/UserAvatarPopover';
import { ChatSidebarPaneEnum } from '@/pageComponents/chat/constants';
import SidebarHistoryList from './SidebarHistoryList';
import { LG, LG_GRID_STYLE } from '@/pageComponents/chat/lugangTheme';
import {
  hasDesktopTitleBar,
  setDesktopSidebarControl,
  subscribeDesktopTitleBar
} from '@/web/common/system/desktopShell';

const getServerDesktopTitleBar = () => false;

type Props = {
  activeAppId: string;
};

// 鲁港通 - 品牌印章（预览稿：淡蓝渐变方印 + 楷体「鲁」）
const BrandSeal = ({ size = 34, onClick }: { size?: number; onClick?: () => void }) => (
  <Flex
    w={`${size}px`}
    h={`${size}px`}
    flexShrink={0}
    borderRadius={'9px'}
    bg={LG.seal}
    color={'#FFFFFF'}
    alignItems={'center'}
    justifyContent={'center'}
    fontSize={`${Math.round(size * 0.5)}px`}
    fontWeight={700}
    fontFamily={'"STKaiti","KaiTi","PingFang SC",serif'}
    boxShadow={'0 4px 12px rgba(78,128,178,0.28), inset 0 0 0 1px rgba(255,255,255,0.55)'}
    cursor={onClick ? 'pointer' : undefined}
    userSelect={'none'}
    onClick={onClick}
  >
    鲁
  </Flex>
);

const SectionLabel = ({ label }: { label: string }) => (
  <Flex alignItems={'center'} gap={'6px'} px={'8px'} pt={'8px'} pb={'5px'}>
    <Box w={'4px'} h={'4px'} borderRadius={'50%'} bg={LG.lake} flexShrink={0} />
    <Text fontSize={'10.5px'} letterSpacing={'0.16em'} color={'#788DA0'} whiteSpace={'nowrap'}>
      {label}
    </Text>
  </Flex>
);

const ChatSlider = ({ activeAppId }: Props) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { feConfigs } = useSystemStore();
  const userInfo = useUserStore((s) => s.userInfo);

  const [searchText, setSearchText] = useState('');

  const isCollapsed = useContextSelector(ChatPageContext, (v) => v.collapse === 1);
  const pane = useContextSelector(ChatPageContext, (v) => v.pane);
  const myApps = useContextSelector(ChatPageContext, (v) => v.myApps);
  const chatSettings = useContextSelector(ChatPageContext, (v) => v.chatSettings);
  const onTriggerCollapse = useContextSelector(ChatPageContext, (v) => v.onTriggerCollapse);
  const handlePaneChange = useContextSelector(ChatPageContext, (v) => v.handlePaneChange);
  const upsertRecentlyUsedAppPlaceholder = useContextSelector(
    ChatPageContext,
    (v) => v.upsertRecentlyUsedAppPlaceholder
  );

  const onChangeChatId = useContextSelector(ChatContext, (v) => v.onChangeChatId);
  const clearChatRecords = useContextSelector(ChatItemContext, (v) => v.clearChatRecords);
  const setCiteModalData = useContextSelector(ChatItemContext, (v) => v.setCiteModalData);

  // 鲁港通 - 方案 A：桌面自绘标题栏已承载品牌与折叠按钮，侧栏不再重复展示
  const desktopTitleBar = useSyncExternalStore(
    subscribeDesktopTitleBar,
    hasDesktopTitleBar,
    getServerDesktopTitleBar
  );

  useEffect(() => {
    if (!desktopTitleBar) return;
    setDesktopSidebarControl({ collapsed: isCollapsed, toggle: onTriggerCollapse });
    return () => setDesktopSidebarControl(undefined);
  }, [desktopTitleBar, isCollapsed, onTriggerCollapse]);

  const isRoot = userInfo?.username === 'root';
  const isAdmin = !!userInfo?.team?.permission.hasManagePer;
  const showHome = !!feConfigs.isPlus && (chatSettings?.enableHome ?? true);
  const showSetting = isAdmin && !!feConfigs.isPlus;
  const isSettingActive = pane === ChatSidebarPaneEnum.SETTING;

  // 鲁港通 - 侧栏余额每 60 秒刷新一次，其余入口（输入框余额标签）保持原有刷新节奏
  const { data: pointsData } = useRequest(getUserPointsDetail, {
    manual: false,
    ready: !!userInfo,
    errorToast: '',
    pollingInterval: 60000
  });
  const surplusPoints = pointsData?.surplusPoints;

  const handlers = useMemo(
    () => ({
      newChat: () => {
        clearChatRecords();
        onChangeChatId();
        setCiteModalData(undefined);
      },
      openHome: () => {
        if (showHome) {
          handlePaneChange(ChatSidebarPaneEnum.HOME);
        } else if (isRoot) {
          handlePaneChange(ChatSidebarPaneEnum.ALL_APPS);
        }
      },
      openAllApps: () => handlePaneChange(ChatSidebarPaneEnum.ALL_APPS),
      openSetting: () => handlePaneChange(ChatSidebarPaneEnum.SETTING),
      openApp: (appId: string) => {
        const app = myApps.find((item) => item.appId === appId);
        if (app) upsertRecentlyUsedAppPlaceholder(app);
        handlePaneChange(ChatSidebarPaneEnum.RECENTLY_USED_APPS, appId);
      }
    }),
    [
      clearChatRecords,
      handlePaneChange,
      isRoot,
      myApps,
      onChangeChatId,
      setCiteModalData,
      showHome,
      upsertRecentlyUsedAppPlaceholder
    ]
  );

  const isAppActive = (appId: string) =>
    pane === ChatSidebarPaneEnum.RECENTLY_USED_APPS && appId === activeAppId;

  const userAvatar = userInfo ? (
    <Avatar
      src={userInfo.avatar}
      bg={LG.seal}
      borderRadius={'8px'}
      w={'26px'}
      h={'26px'}
      flexShrink={0}
    />
  ) : null;

  // 收起态：不显示会话历史与 Credits，用户区只保留缩小头像
  if (isCollapsed) {
    return (
      <Flex
        flexDirection={'column'}
        h={'100%'}
        w={'100%'}
        bg={LG.sidebar}
        borderRight={'1px solid'}
        borderColor={LG.lineSoft}
        position={'relative'}
        overflow={'hidden'}
        userSelect={'none'}
      >
        <Box position={'absolute'} inset={0} pointerEvents={'none'} {...LG_GRID_STYLE} />

        <Flex
          position={'relative'}
          zIndex={1}
          flexDirection={'column'}
          alignItems={'center'}
          h={'100%'}
          px={'10px'}
          pt={'16px'}
          pb={'12px'}
          gap={2}
        >
          {!desktopTitleBar && (
            <MyTooltip label={t('chat:sidebar.expand')}>
              <Box onClick={onTriggerCollapse}>
                <BrandSeal />
              </Box>
            </MyTooltip>
          )}

          <MyTooltip label={t('chat:sidebar.new_chat')}>
            <Flex
              w={'40px'}
              h={'40px'}
              borderRadius={'10px'}
              alignItems={'center'}
              justifyContent={'center'}
              color={LG.mountain}
              bg={'rgba(255,255,255,0.55)'}
              border={'1px solid'}
              borderColor={LG.line}
              cursor={'pointer'}
              _hover={{ bg: '#FFFFFF' }}
              onClick={handlers.newChat}
            >
              <MyIcon name={'common/addLight'} w={'16px'} color={'currentColor'} />
            </Flex>
          </MyTooltip>

          {showHome && (
            <MyTooltip label={t('chat:sidebar.home')}>
              <Flex
                w={'40px'}
                h={'40px'}
                borderRadius={'10px'}
                alignItems={'center'}
                justifyContent={'center'}
                cursor={'pointer'}
                color={pane === ChatSidebarPaneEnum.HOME ? LG.mountain : '#5D7288'}
                bg={pane === ChatSidebarPaneEnum.HOME ? 'rgba(255,255,255,0.9)' : 'transparent'}
                _hover={{ bg: 'rgba(255,255,255,0.8)' }}
                onClick={handlers.openHome}
              >
                <MyIcon name={'core/chat/sidebar/home'} w={'20px'} h={'20px'} />
              </Flex>
            </MyTooltip>
          )}

          <Flex
            flexDirection={'column'}
            alignItems={'center'}
            gap={2}
            flex={'1 0 0'}
            w={'100%'}
            overflowY={'auto'}
            overflowX={'hidden'}
            mt={1}
          >
            {myApps.map((item) => (
              <MyTooltip key={item.appId} label={item.name}>
                <Flex
                  w={'40px'}
                  h={'40px'}
                  borderRadius={'10px'}
                  alignItems={'center'}
                  justifyContent={'center'}
                  cursor={'pointer'}
                  bg={isAppActive(item.appId) ? 'rgba(255,255,255,0.9)' : 'transparent'}
                  _hover={{ bg: 'rgba(255,255,255,0.8)' }}
                  onClick={() => handlers.openApp(item.appId)}
                >
                  <Avatar src={item.avatar} w={'22px'} h={'22px'} borderRadius={'7px'} />
                </Flex>
              </MyTooltip>
            ))}

            {isRoot && (
              <MyTooltip label={t('chat:sidebar.all_assistants')}>
                <Flex
                  w={'40px'}
                  h={'40px'}
                  borderRadius={'10px'}
                  alignItems={'center'}
                  justifyContent={'center'}
                  cursor={'pointer'}
                  color={pane === ChatSidebarPaneEnum.ALL_APPS ? LG.mountain : '#5D7288'}
                  bg={
                    pane === ChatSidebarPaneEnum.ALL_APPS ? 'rgba(255,255,255,0.9)' : 'transparent'
                  }
                  _hover={{ bg: 'rgba(255,255,255,0.8)' }}
                  onClick={handlers.openAllApps}
                >
                  <MyIcon name={'common/app'} w={'20px'} h={'20px'} />
                </Flex>
              </MyTooltip>
            )}
          </Flex>

          {userInfo && (
            <MyTooltip label={userInfo.team?.memberName || userInfo.username}>
              <Box w={'100%'}>
                <UserAvatarPopover isCollapsed placement={'right-start'}>
                  <Flex justifyContent={'center'}>{userAvatar}</Flex>
                </UserAvatarPopover>
              </Box>
            </MyTooltip>
          )}
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex
      flexDirection={'column'}
      h={'100%'}
      w={'100%'}
      bg={LG.sidebar}
      borderRight={'1px solid'}
      borderColor={LG.lineSoft}
      position={'relative'}
      overflow={'hidden'}
      userSelect={'none'}
    >
      <Box position={'absolute'} inset={0} pointerEvents={'none'} {...LG_GRID_STYLE} />

      <Flex
        position={'relative'}
        zIndex={1}
        flexDirection={'column'}
        h={'100%'}
        px={'12px'}
        pt={'16px'}
        pb={'12px'}
        gap={'12px'}
      >
        {/* 品牌区：桌面客户端由窗口标题栏承载品牌与折叠，这里不再重复 */}
        {!desktopTitleBar && (
          <Flex alignItems={'center'} gap={'10px'} px={'6px'} pt={'2px'} pb={'6px'}>
            <BrandSeal onClick={handlers.openHome} />
            <Box minW={0} flex={'1 0 0'} cursor={'pointer'} onClick={handlers.openHome}>
              <Text
                fontSize={'15px'}
                fontWeight={600}
                letterSpacing={'0.12em'}
                color={LG.ink}
                whiteSpace={'nowrap'}
              >
                鲁港通
              </Text>
              <Text
                fontSize={'9.5px'}
                letterSpacing={'0.34em'}
                color={'#4F80B4'}
                mt={'2px'}
                whiteSpace={'nowrap'}
              >
                智联鲁港
              </Text>
            </Box>
            <MyTooltip label={t('chat:sidebar.collapse')}>
              <Flex
                w={'26px'}
                h={'26px'}
                flexShrink={0}
                borderRadius={'7px'}
                border={'1px solid'}
                borderColor={'rgba(54,101,150,0.18)'}
                bg={'rgba(255,255,255,0.6)'}
                color={'#5A728A'}
                alignItems={'center'}
                justifyContent={'center'}
                cursor={'pointer'}
                _hover={{ bg: '#FFFFFF' }}
                onClick={onTriggerCollapse}
              >
                <MyIcon name={'core/chat/sidebar/fold'} w={'13px'} h={'13px'} />
              </Flex>
            </MyTooltip>
          </Flex>
        )}

        {/* 新对话 */}
        <Button
          h={'42px'}
          minH={'42px'}
          w={'100%'}
          borderRadius={'11px'}
          border={'1px solid'}
          borderColor={'rgba(111,157,208,0.4)'}
          bg={'linear-gradient(135deg, #FFFFFF, #EDF4FC)'}
          color={LG.mountain}
          fontSize={'13.5px'}
          fontWeight={400}
          letterSpacing={'0.04em'}
          leftIcon={<MyIcon name={'common/addLight'} w={'15px'} color={'currentColor'} />}
          _hover={{
            bg: 'linear-gradient(135deg, #FFFFFF, #E7F1FB)',
            borderColor: 'rgba(111,157,208,0.75)',
            boxShadow: '0 0 0 1px rgba(111,157,208,0.2), 0 8px 20px rgba(78,128,178,0.12)'
          }}
          _active={{ bg: 'linear-gradient(135deg, #FFFFFF, #E7F1FB)' }}
          onClick={handlers.newChat}
        >
          {t('chat:sidebar.new_chat')}
        </Button>

        {/* 搜索会话 */}
        <Flex
          h={'34px'}
          flexShrink={0}
          borderRadius={'9px'}
          bg={'rgba(255,255,255,0.72)'}
          border={'1px solid'}
          borderColor={LG.line}
          alignItems={'center'}
          gap={'8px'}
          px={'10px'}
        >
          <MyIcon name={'common/searchLight'} w={'13px'} color={'#8DA2B4'} flexShrink={0} />
          <Input
            variant={'unstyled'}
            h={'32px'}
            minH={'32px'}
            flex={'1 0 0'}
            fontSize={'12px'}
            color={LG.text}
            placeholder={t('chat:sidebar.search_placeholder')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            _placeholder={{ color: '#7B8D9F' }}
          />
        </Flex>

        {/* 我的助手 */}
        {(myApps.length > 0 || isRoot) && (
          <Flex flexDirection={'column'} flexShrink={0}>
            <SectionLabel label={t('chat:sidebar.my_assistants')} />
            {myApps.map((item) => (
              <Flex
                key={item.appId}
                alignItems={'center'}
                gap={'9px'}
                h={'32px'}
                minH={'32px'}
                px={'9px'}
                borderRadius={'8px'}
                fontSize={'12.5px'}
                color={isAppActive(item.appId) ? '#245173' : '#405268'}
                bg={isAppActive(item.appId) ? LG.activeItem : 'transparent'}
                boxShadow={isAppActive(item.appId) ? `inset 2px 0 0 ${LG.lake}` : 'none'}
                cursor={'pointer'}
                _hover={{ bg: 'rgba(255,255,255,0.85)', color: '#23405A' }}
                onClick={() => handlers.openApp(item.appId)}
              >
                <Avatar src={item.avatar} w={'16px'} h={'16px'} borderRadius={'5px'} />
                <Box className={'textEllipsis'} flex={'1 0 0'} minW={0}>
                  {item.name}
                </Box>
              </Flex>
            ))}
            {isRoot && (
              <Flex
                alignItems={'center'}
                gap={'9px'}
                h={'32px'}
                minH={'32px'}
                px={'9px'}
                borderRadius={'8px'}
                fontSize={'12.5px'}
                color={pane === ChatSidebarPaneEnum.ALL_APPS ? '#245173' : '#405268'}
                bg={pane === ChatSidebarPaneEnum.ALL_APPS ? LG.activeItem : 'transparent'}
                boxShadow={
                  pane === ChatSidebarPaneEnum.ALL_APPS ? `inset 2px 0 0 ${LG.lake}` : 'none'
                }
                cursor={'pointer'}
                _hover={{ bg: 'rgba(255,255,255,0.85)', color: '#23405A' }}
                onClick={handlers.openAllApps}
              >
                <MyIcon name={'common/app'} w={'14px'} color={'#7F95AB'} />
                <Box flex={'1 0 0'} minW={0} className={'textEllipsis'}>
                  {t('chat:sidebar.all_assistants')}
                </Box>
              </Flex>
            )}
          </Flex>
        )}

        {/* 会话历史 */}
        <Flex flexDirection={'column'} flex={'1 0 0'} minH={0}>
          <SectionLabel label={t('chat:sidebar.history')} />
          <SidebarHistoryList searchText={searchText} />
        </Flex>

        {/* 余额 + 用户 */}
        <Flex flexDirection={'column'} gap={'8px'} flexShrink={0}>
          {surplusPoints !== undefined && (
            <Flex
              h={'34px'}
              borderRadius={'9px'}
              bg={'rgba(255,255,255,0.75)'}
              border={'1px solid'}
              borderColor={'rgba(54,101,150,0.14)'}
              alignItems={'center'}
              gap={'8px'}
              px={'10px'}
              fontSize={'11.5px'}
              color={'#4B6478'}
            >
              <MyIcon name={'common/wallet'} w={'13px'} color={LG.lake} flexShrink={0} />
              <Text whiteSpace={'nowrap'}>{t('chat:sidebar.credits_remaining')}</Text>
              <Text fontSize={'13px'} fontWeight={600} color={LG.mountain} letterSpacing={'0.02em'}>
                {formatNumber(surplusPoints)}
              </Text>
              <Text whiteSpace={'nowrap'}>{t('chat:sidebar.credits_unit')}</Text>
              <Button
                variant={'unstyled'}
                ml={'auto'}
                fontSize={'10.5px'}
                color={LG.mountain}
                flexShrink={0}
                _hover={{ textDecoration: 'underline' }}
                onClick={() => router.push('/price')}
              >
                {t('chat:sidebar.credits_recharge')}
              </Button>
            </Flex>
          )}

          <Flex
            h={'44px'}
            borderRadius={'10px'}
            border={'1px solid'}
            borderColor={LG.line}
            bg={'rgba(255,255,255,0.72)'}
            alignItems={'center'}
            gap={'9px'}
            px={'9px'}
          >
            {userInfo ? (
              <>
                <UserAvatarPopover isCollapsed={false} placement={'top-end'}>
                  <Flex alignItems={'center'} gap={'9px'} minW={0} w={'100%'}>
                    {userAvatar}
                    <Box minW={0} flex={'1 0 0'}>
                      <Text fontSize={'11.5px'} color={'#3F5266'} className={'textEllipsis'}>
                        {userInfo.team?.memberName || userInfo.username}
                      </Text>
                      <Text
                        fontSize={'10.5px'}
                        color={'#8095A8'}
                        mt={'1px'}
                        className={'textEllipsis'}
                      >
                        {userInfo.username}
                      </Text>
                    </Box>
                  </Flex>
                </UserAvatarPopover>

                {showSetting && (
                  <MyTooltip label={t('chat:sidebar.setting')}>
                    <Flex
                      w={'26px'}
                      h={'26px'}
                      flexShrink={0}
                      borderRadius={'7px'}
                      alignItems={'center'}
                      justifyContent={'center'}
                      cursor={'pointer'}
                      color={isSettingActive ? LG.mountain : '#6F8497'}
                      bg={isSettingActive ? 'rgba(255,255,255,0.95)' : 'transparent'}
                      _hover={{ bg: 'rgba(255,255,255,0.9)' }}
                      onClick={handlers.openSetting}
                    >
                      <MyIcon name={'common/setting'} w={'14px'} color={'currentColor'} />
                    </Flex>
                  </MyTooltip>
                )}
              </>
            ) : (
              <Flex alignItems={'center'} gap={'9px'} minW={0} cursor={'pointer'}>
                <Avatar bg={LG.seal} borderRadius={'8px'} w={'26px'} h={'26px'} />
                <Text fontSize={'11.5px'} color={'#3F5266'}>
                  {t('login:Login')}
                </Text>
              </Flex>
            )}
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default React.memo(ChatSlider);
