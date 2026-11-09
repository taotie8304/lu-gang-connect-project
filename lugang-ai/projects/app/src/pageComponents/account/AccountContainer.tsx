import React, { useCallback, useMemo } from 'react';
import { Box, Flex, Spinner, Text } from '@chakra-ui/react';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useRouter } from 'next/router';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import MyIcon from '@fastgpt/web/components/common/Icon';
import ThinkingFace from '@/components/common/ThinkingFace';
import { clearToken } from '@/web/support/user/auth';
import { performLogout } from '@/web/support/user/logout';
import { useChatStore } from '@/web/core/chat/context/useChatStore';
import { isDesktopBridgeAvailable } from '@/pageComponents/chat/builtinBrowser/desktopBridge';
import { AccountFlowContext } from './AccountFlowContext';

export enum TabEnum {
  'info' = 'info',
  'usage' = 'usage',
  'bill' = 'bill',
  'inform' = 'inform',
  'setting' = 'setting',
  'thirdParty' = 'thirdParty',
  'individuation' = 'individuation',
  'apikey' = 'apikey',
  'loginout' = 'loginout',
  'team' = 'team',
  'model' = 'model',
  'customDomain' = 'customDomain',
  'myTickets' = 'myTickets',
  'memories' = 'memories'
}

const AccountContainer = ({
  children,
  isLoading
}: {
  children: React.ReactNode;
  isLoading?: boolean;
}) => {
  const { t } = useClientTranslation('account');
  const { userInfo, setUserInfo } = useUserStore();
  const { feConfigs, systemVersion } = useSystemStore();
  const { resetChatCache } = useChatStore();
  const router = useRouter();
  const isDesktop = isDesktopBridgeAvailable();

  const showThirdPartyTab =
    feConfigs?.show_openai_account === true ||
    feConfigs?.externalProviderWorkflowVariables?.some((item) => item.isOpen) === true;

  const currentTab = useMemo(() => {
    return router.pathname.split('/').pop() as TabEnum;
  }, [router.pathname]);

  const tabList = useMemo(() => {
    const tabs: { label: string; value: TabEnum }[] = [
      {
        label: t('account:personal_information'),
        value: TabEnum.info
      }
    ];
    if (feConfigs?.isPlus) {
      tabs.push({ label: t('account:team'), value: TabEnum.team });
    }
    // 鲁港通 - N4：本部署未接入商业版（isPlus=false）但已开放「用量明细」
    if (feConfigs?.isPlus || feConfigs?.show_pay) {
      tabs.push({ label: t('account:usage_records'), value: TabEnum.usage });
    }
    // 鲁港通 - N4：订单对所有团队成员可见
    if (feConfigs?.show_pay) {
      tabs.push({ label: t('account:bills_and_invoices'), value: TabEnum.bill });
    }
    tabs.push({ label: t('account:my_tickets'), value: TabEnum.myTickets });
    tabs.push({ label: t('account:memories'), value: TabEnum.memories });
    if (showThirdPartyTab) {
      tabs.push({ label: t('account:third_party'), value: TabEnum.thirdParty });
    }
    if (feConfigs.isPlus && feConfigs.customDomain?.enable) {
      tabs.push({ label: t('account:custom_domain'), value: TabEnum.customDomain });
    }
    if (feConfigs.isPlus) {
      tabs.push({ label: t('common:model.provider_title'), value: TabEnum.model });
    }
    if (userInfo?.team?.permission.hasApikeyCreatePer) {
      tabs.push({ label: t('account:api_key'), value: TabEnum.apikey });
    }
    if (feConfigs.isPlus) {
      tabs.push({ label: t('account:notifications'), value: TabEnum.inform });
    }
    tabs.push({ label: t('account:language'), value: TabEnum.setting });
    return tabs;
  }, [feConfigs, showThirdPartyTab, t, userInfo?.team?.permission.hasApikeyCreatePer]);

  const { openConfirm, ConfirmModal } = useConfirm({
    content: isDesktop ? t('common:confirm_logout_desktop') : t('account:confirm_logout')
  });

  // 鲁港通 - 走全站统一登出：清 Cookie 与聊天缓存，桌面客户端额外关内置浏览器并撤销设备注册
  const handleLogout = useCallback(() => {
    openConfirm({
      onConfirm: () => {
        performLogout({
          closeBrowserPanel: isDesktop ? () => window.lugangDesktop?.closePanel() : undefined,
          clearDesktopSession: isDesktop
            ? () => window.lugangDesktop?.session?.logout()
            : undefined,
          resetChatCache,
          clearUserInfo: () => setUserInfo(null),
          clearToken,
          redirectToLogin: () => router.replace('/login')
        });
      }
    })();
  }, [isDesktop, openConfirm, resetChatCache, router, setUserInfo]);

  const setCurrentTab = useCallback(
    (tab: string) => {
      router.replace('/account/' + tab);
    },
    [router]
  );

  return (
    <Flex
      direction={'column'}
      minH={'100%'}
      w={'100%'}
      bg={'#F2F6FC'}
      bgImage={
        'radial-gradient(900px 420px at 12% -8%, rgba(95,148,255,.10), transparent 62%), radial-gradient(760px 380px at 92% 0%, rgba(120,200,255,.10), transparent 60%)'
      }
      bgRepeat={'no-repeat'}
    >
      <Box
        w={'100%'}
        maxW={'1280px'}
        mx={'auto'}
        px={['12px', '18px']}
        pt={['12px', '22px']}
        pb={['24px', '40px']}
        flex={'1 0 auto'}
      >
        <Box
          bg={'linear-gradient(180deg,#FBFDFF 0%,#F7FAFF 100%)'}
          border={'1px solid'}
          borderColor={'#E7EEF9'}
          borderRadius={['18px', '22px']}
          boxShadow={'0 18px 50px rgba(36,80,181,.08)'}
          overflow={'hidden'}
        >
          {/* 鲁港通 - 账号中心顶栏：品牌位 + 返回对话 */}
          <Flex
            h={['56px', '64px']}
            px={['14px', '26px']}
            align={'center'}
            justify={'space-between'}
            bg={'rgba(255,255,255,.82)'}
            backdropFilter={'blur(10px)'}
            borderBottom={'1px solid'}
            borderColor={'#EEF3FC'}
          >
            <Flex align={'center'} gap={'10px'} minW={0}>
              {/* 鲁港通 - 品牌位统一使用企业 icon（思考小圆脸），不用史莱姆动漫形象 */}
              <ThinkingFace size={32} />
              <Text fontSize={'15px'} fontWeight={600} letterSpacing={'0.3px'} color={'#182234'}>
                鲁港通
              </Text>
              <Box display={['none', 'block']} w={'1px'} h={'14px'} bg={'#E7EEF9'} mx={'2px'} />
              <Text display={['none', 'block']} fontSize={'13px'} color={'#66758F'}>
                {t('account:account_center')}
              </Text>
            </Flex>
            <Flex
              as={'button'}
              type={'button'}
              alignItems={'center'}
              gap={'6px'}
              h={['30px', '34px']}
              px={['11px', '14px']}
              borderRadius={'999px'}
              border={'1px solid'}
              borderColor={'#E7EEF9'}
              bg={'#fff'}
              color={'#66758F'}
              fontSize={['11.5px', '12.5px']}
              transition={'0.18s'}
              flexShrink={0}
              _hover={{ color: '#2450B5', borderColor: '#CBDCFB', bg: '#F2F6FF' }}
              onClick={() => router.push('/chat')}
            >
              {t('account:back_to_chat')}
              <MyIcon name={'core/chat/chevronRight'} w={'13px'} color={'currentColor'} />
            </Flex>
          </Flex>

          <Box px={['13px', '26px']} pt={['14px', '20px']} pb={['10px', '14px']}>
            {/* 鲁港通 - 胶囊页签：移动端横滚，桌面端右侧固定退出登录 */}
            <Flex
              alignItems={'center'}
              gap={'4px'}
              flexWrap={['nowrap', 'wrap']}
              bg={'#fff'}
              border={'1px solid'}
              borderColor={'#E7EEF9'}
              borderRadius={['14px', '999px']}
              p={['4px', '5px']}
              boxShadow={'0 10px 26px rgba(28,63,128,.06)'}
              overflowX={['auto', 'visible']}
              css={{ '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}
            >
              {tabList.map((item) => {
                const isActive = currentTab === item.value;
                return (
                  <Flex
                    as={'button'}
                    type={'button'}
                    key={item.value}
                    alignItems={'center'}
                    flex={['0 0 auto', 'initial']}
                    h={['32px', '34px']}
                    px={['12px', '15px']}
                    borderRadius={'999px'}
                    fontSize={['12px', '13px']}
                    whiteSpace={'nowrap'}
                    color={isActive ? '#fff' : '#66758F'}
                    bg={isActive ? '#3370FF' : 'transparent'}
                    boxShadow={isActive ? '0 6px 16px rgba(51,112,255,.26)' : 'none'}
                    transition={'0.18s'}
                    _hover={isActive ? undefined : { color: '#3C4A63', bg: '#F2F6FF' }}
                    onClick={() => setCurrentTab(item.value)}
                  >
                    {item.label}
                  </Flex>
                );
              })}
              <Box flex={'1'} display={['none', 'block']} />
              <Flex
                as={'button'}
                type={'button'}
                display={['none', 'flex']}
                alignItems={'center'}
                h={'34px'}
                px={'12px'}
                borderRadius={'999px'}
                fontSize={'12.5px'}
                color={'#8C99AE'}
                transition={'0.18s'}
                _hover={{ color: '#D4553F', bg: 'rgba(212,85,63,.06)' }}
                onClick={handleLogout}
              >
                {t('account:logout')}
              </Flex>
            </Flex>

            <AccountFlowContext.Provider value={true}>
              <Box mt={['14px', '20px']}>
                {isLoading ? (
                  <Flex align={'center'} justify={'center'} py={16}>
                    <Spinner size={'lg'} color={'#3370FF'} />
                  </Flex>
                ) : (
                  children
                )}
              </Box>
            </AccountFlowContext.Provider>

            <Flex alignItems={'center'} gap={'6px'} mt={['16px', '18px']}>
              <Box
                w={'7px'}
                h={'7px'}
                borderRadius={'50%'}
                bg={'#4CC38A'}
                boxShadow={'0 0 0 3px rgba(76,195,138,.16)'}
              />
              <Text fontSize={'11.5px'} color={'#8C99AE'}>
                {t('account:service_running')} · V{systemVersion}
              </Text>
            </Flex>
          </Box>
        </Box>
      </Box>
      <ConfirmModal />
    </Flex>
  );
};

export default AccountContainer;
