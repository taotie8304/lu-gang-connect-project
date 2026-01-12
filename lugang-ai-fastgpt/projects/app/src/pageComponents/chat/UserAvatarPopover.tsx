import React, { useCallback } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { useUserStore } from '@/web/support/user/useUserStore';
import { clearToken } from '@/web/support/user/auth';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import MyPopover from '@fastgpt/web/components/common/MyPopover';
import MyIcon from '@fastgpt/web/components/common/Icon';
import Avatar from '@fastgpt/web/components/common/Avatar';
import { useRouter } from 'next/router';
import { useSystemStore } from '@/web/common/system/useSystemStore';

type UserAvatarPopoverProps = {
  isCollapsed: boolean;
  children: React.ReactNode;
  placement?: Parameters<typeof MyPopover>[0]['placement'];
};

const UserAvatarPopover = ({
  isCollapsed,
  children,
  placement = 'top-end',
  ...props
}: UserAvatarPopoverProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { setUserInfo, userInfo } = useUserStore();
  const { feConfigs } = useSystemStore();

  // 检查是否为管理员
  const isAdmin = userInfo?.team?.permission?.hasManagePer;
  // 是否启用纯聊天模式
  const enableUserChatOnly = feConfigs?.enableUserChatOnly;

  const { openConfirm, ConfirmModal } = useConfirm({ content: t('common:confirm_logout') });

  const handleLogout = useCallback(() => {
    setUserInfo(null);
    clearToken();
  }, [setUserInfo]);

  const handleGoToProfile = useCallback(() => {
    router.push('/account/info');
  }, [router]);

  const handleGoToAdmin = useCallback(() => {
    router.push(feConfigs?.adminPath || '/admin');
  }, [router, feConfigs?.adminPath]);

  return (
    <>
      <MyPopover
        Trigger={
          <Box cursor="pointer" w="full">
            {children}
          </Box>
        }
        trigger="hover"
        placement={placement}
        w="180px"
        {...props}
      >
        {({ onClose }) => {
          const onLogout = useCallback(() => {
            onClose();
            openConfirm({ onConfirm: handleLogout })();
          }, [onClose]);

          const onProfile = useCallback(() => {
            onClose();
            handleGoToProfile();
          }, [onClose]);

          const onAdmin = useCallback(() => {
            onClose();
            handleGoToAdmin();
          }, [onClose]);

          return (
            <Flex p={2} direction="column" gap={1}>
              {/* 用户信息头部 */}
              {!!isCollapsed && (
                <Flex
                  borderBottom="1px solid"
                  alignItems="center"
                  borderColor="myGray.200"
                  pb={2}
                  px={2}
                  mb={1}
                  fontWeight="500"
                  fontSize="14px"
                  gap={2}
                >
                  <Avatar src={userInfo?.avatar} bg="myGray.200" borderRadius="50%" w={5} h={5} />
                  <Box flex="1 1 0" minW="0" whiteSpace="pre-wrap">
                    {userInfo?.team.memberName ?? '-'}
                  </Box>
                </Flex>
              )}

              {/* 个人中心 */}
              <Flex
                alignItems="center"
                cursor="pointer"
                _hover={{ bg: 'myGray.100' }}
                py={1.5}
                px={2}
                borderRadius="4px"
                gap={2}
                onClick={onProfile}
                w="100%"
              >
                <MyIcon name="support/user/userLight" w="16px" />
                <Text fontSize="14px">{t('common:user.Personal_Center') || '个人中心'}</Text>
              </Flex>

              {/* 管理后台入口 - 仅管理员且启用纯聊天模式时显示 */}
              {isAdmin && enableUserChatOnly && (
                <Flex
                  alignItems="center"
                  cursor="pointer"
                  _hover={{ bg: 'myGray.100' }}
                  py={1.5}
                  px={2}
                  borderRadius="4px"
                  gap={2}
                  onClick={onAdmin}
                  w="100%"
                >
                  <MyIcon name="common/setting" w="16px" />
                  <Text fontSize="14px">{t('common:admin_dashboard') || '管理后台'}</Text>
                </Flex>
              )}

              {/* 分隔线 */}
              <Box borderTop="1px solid" borderColor="myGray.200" my={1} />

              {/* 退出登录 */}
              <Flex
                alignItems="center"
                cursor="pointer"
                _hover={{ bg: 'myGray.100' }}
                py={1.5}
                px={2}
                borderRadius="4px"
                gap={2}
                onClick={onLogout}
                w="100%"
                color="red.500"
              >
                <MyIcon name="core/chat/sidebar/logout" w="16px" />
                <Text fontSize="14px">{t('common:logout')}</Text>
              </Flex>

              {/* 版本号 */}
              <Box
                textAlign="center"
                fontSize="12px"
                color="myGray.400"
                mt={1}
                pt={1}
                borderTop="1px solid"
                borderColor="myGray.100"
              >
                v{global?.systemVersion || '1.0.0'}
              </Box>
            </Flex>
          );
        }}
      </MyPopover>

      <ConfirmModal />
    </>
  );
};

export default UserAvatarPopover;
