import React, { useCallback, useState, useEffect } from 'react';
import { Box, Flex, Text, Spinner } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { useUserStore } from '@/web/support/user/useUserStore';
import { clearToken } from '@/web/support/user/auth';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import MyPopover from '@fastgpt/web/components/common/MyPopover';
import MyIcon from '@fastgpt/web/components/common/Icon';
import Avatar from '@fastgpt/web/components/common/Avatar';
import { useRouter } from 'next/router';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { GET } from '@/web/common/api/request';

type UserAvatarPopoverProps = {
  isCollapsed: boolean;
  children: React.ReactNode;
  placement?: Parameters<typeof MyPopover>[0]['placement'];
};

// 额度响应类型
type QuotaResponse = {
  quota: number;
  usedQuota: number;
  remainingQuota: number;
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

  // 检查是否为管理员（团队所有者）
  const isOwner = userInfo?.permission?.isOwner ?? false;
  // 是否启用纯聊天模式
  const enableUserChatOnly = !!feConfigs?.enableUserChatOnly;
  // 普通用户在纯聊天模式下显示简化菜单
  const showSimplifiedMenu = enableUserChatOnly && !isOwner;

  // 鲁港通：额度状态
  const [quotaData, setQuotaData] = useState<QuotaResponse | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);

  // 获取用户额度
  useEffect(() => {
    if (showSimplifiedMenu && userInfo) {
      setQuotaLoading(true);
      GET<QuotaResponse>('/api/integration/oneapi/quota')
        .then((data) => {
          setQuotaData(data);
        })
        .catch((err) => {
          console.error('Failed to fetch quota:', err);
          // 如果获取失败，显示默认值
          setQuotaData({ quota: 0, usedQuota: 0, remainingQuota: 0 });
        })
        .finally(() => {
          setQuotaLoading(false);
        });
    }
  }, [showSimplifiedMenu, userInfo]);

  const { openConfirm, ConfirmModal } = useConfirm({ content: t('common:confirm_logout') });

  const handleLogout = useCallback(() => {
    setUserInfo(null);
    clearToken();
  }, [setUserInfo]);

  const handleGoToProfile = useCallback(() => {
    router.push('/account/info');
  }, [router]);

  const handleGoToAdmin = useCallback(() => {
    router.push('/dashboard/agent');
  }, [router]);

  // 鲁港通：跳转到充值页面
  const handleGoToRecharge = useCallback(() => {
    // 跳转到 One API 充值页面
    const oneApiUrl = feConfigs?.oneApiUrl || 'https://api.airscend.com';
    window.open(`${oneApiUrl}/topup`, '_blank');
  }, [feConfigs?.oneApiUrl]);

  // 格式化额度显示（One API 额度单位是 1/500000 美元）
  const formatQuota = (value: number) => {
    // 转换为人民币显示（假设 1 美元 = 7.2 人民币）
    const cnyValue = (value / 500000) * 7.2;
    if (cnyValue >= 10000) {
      return `${(cnyValue / 10000).toFixed(2)}万`;
    }
    return cnyValue.toFixed(2);
  };

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
        w="200px"
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

          const onRecharge = useCallback(() => {
            onClose();
            handleGoToRecharge();
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

              {/* 鲁港通：额度显示 - 仅普通用户在纯聊天模式下显示 */}
              {showSimplifiedMenu && (
                <Flex
                  alignItems="center"
                  py={2}
                  px={2}
                  borderRadius="md"
                  bg="blue.50"
                  gap={2}
                  mb={1}
                >
                  <MyIcon name="support/bill/payRecordLight" w="16px" color="blue.500" />
                  <Box flex={1}>
                    <Text fontSize="12px" color="myGray.500">当前额度</Text>
                    <Text fontSize="14px" fontWeight="600" color="blue.600">
                      {quotaLoading ? (
                        <Spinner size="xs" />
                      ) : quotaData !== null ? (
                        `¥ ${formatQuota(quotaData.remainingQuota)}`
                      ) : (
                        '--'
                      )}
                    </Text>
                  </Box>
                </Flex>
              )}

              {/* 鲁港通：充值入口 - 仅普通用户在纯聊天模式下显示 */}
              {showSimplifiedMenu && (
                <Flex
                  alignItems="center"
                  cursor="pointer"
                  _hover={{ bg: 'blue.50' }}
                  py={1.5}
                  px={2}
                  borderRadius="4px"
                  gap={2}
                  onClick={onRecharge}
                  w="100%"
                  color="blue.600"
                >
                  <MyIcon name="support/bill/priceLight" w="16px" />
                  <Text fontSize="14px" fontWeight="500">充值额度</Text>
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
              {isOwner && enableUserChatOnly && (
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
                  <Text fontSize="14px">管理后台</Text>
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
