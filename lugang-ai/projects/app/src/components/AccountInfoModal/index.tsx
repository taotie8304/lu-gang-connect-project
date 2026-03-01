/**
 * 鲁港通 - 账户信息弹窗
 * 显示用户订阅和余额信息
 * Requirements: 9.2, 9.3, 9.4
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Box,
  Text,
  Flex,
  Badge,
  Divider,
  Alert,
  AlertIcon,
  AlertDescription,
  Spinner,
  Button
} from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useToast } from '@fastgpt/web/hooks/useToast';
import type {
  SubscriptionInfo,
  BalanceInfo,
  UserAccountInfo
} from '@fastgpt/service/support/user/integration/subscription';
import { SubscriptionStatus } from '@fastgpt/service/support/user/integration/subscription';

interface AccountInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecharge?: () => void; // 充值按钮回调
}

const AccountInfoModal: React.FC<AccountInfoModalProps> = ({ isOpen, onClose, onRecharge }) => {
  const { t } = useTranslation();
  const { userInfo } = useUserStore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<UserAccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 获取账户信息
  const fetchAccountInfo = async () => {
    if (!userInfo?.username) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 调用 API 获取账户信息
      const response = await fetch(`/api/user/account-info?username=${userInfo.username}`);
      
      if (!response.ok) {
        throw new Error('获取账户信息失败');
      }

      const data = await response.json();
      
      if (data.code === 200 && data.data) {
        setAccountInfo(data.data);
      } else {
        throw new Error(data.message || '获取账户信息失败');
      }
    } catch (err: any) {
      setError(err.message || '获取账户信息失败');
      toast({
        status: 'error',
        title: '获取账户信息失败',
        description: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  // 打开弹窗时获取账户信息
  useEffect(() => {
    if (isOpen) {
      fetchAccountInfo();
    }
  }, [isOpen, userInfo?.username]);

  // 获取订阅状态的显示样式
  const getSubscriptionStatusBadge = (status: SubscriptionStatus) => {
    const statusConfig = {
      [SubscriptionStatus.Active]: { colorScheme: 'green', label: '有效' },
      [SubscriptionStatus.Expired]: { colorScheme: 'red', label: '已过期' },
      [SubscriptionStatus.Cancelled]: { colorScheme: 'gray', label: '已取消' },
      [SubscriptionStatus.Trial]: { colorScheme: 'blue', label: '试用中' }
    };

    const config = statusConfig[status] || { colorScheme: 'gray', label: '未知' };

    return (
      <Badge colorScheme={config.colorScheme} fontSize="12px">
        {config.label}
      </Badge>
    );
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // 检查余额是否不足
  const isBalanceLow = (balance: BalanceInfo) => {
    if (balance.usage_quota === 0) return false;
    const usagePercentage = (balance.usage_quota - balance.remaining_quota) / balance.usage_quota;
    return usagePercentage >= 0.9; // 使用超过 90%
  };

  // 获取余额警告信息
  const getBalanceWarning = (balance: BalanceInfo): string | null => {
    if (balance.remaining_quota <= 0) {
      return '您的配额已用尽，请充值后继续使用。';
    }

    if (isBalanceLow(balance)) {
      const percentage = Math.round((balance.remaining_quota / balance.usage_quota) * 100);
      return `您的配额即将用尽，剩余 ${percentage}%（${balance.remaining_quota} ${balance.quota_unit}），请及时充值。`;
    }

    return null;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>账户信息</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {loading ? (
            <Flex justify="center" align="center" py={10}>
              <Spinner size="lg" />
            </Flex>
          ) : error ? (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : accountInfo ? (
            <VStack spacing={6} align="stretch">
              {/* Requirement 9.4: 余额不足警告 */}
              {accountInfo.balance && getBalanceWarning(accountInfo.balance) && (
                <Alert status="warning" borderRadius="md">
                  <AlertIcon />
                  <AlertDescription fontSize="14px">
                    {getBalanceWarning(accountInfo.balance)}
                  </AlertDescription>
                </Alert>
              )}

              {/* Requirement 9.2: 订阅信息 */}
              <Box>
                <HStack mb={3}>
                  <MyIcon name="core/chat/sidebar/home" w="18px" h="18px" />
                  <Text fontSize="16px" fontWeight="600">
                    订阅信息
                  </Text>
                </HStack>
                <VStack spacing={3} align="stretch" pl={6}>
                  <HStack justify="space-between">
                    <Text fontSize="14px" color="myGray.600">
                      计划名称
                    </Text>
                    <Text fontSize="14px" fontWeight="500">
                      {accountInfo.subscription.plan_name}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="14px" color="myGray.600">
                      计划状态
                    </Text>
                    {getSubscriptionStatusBadge(accountInfo.subscription.plan_status)}
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="14px" color="myGray.600">
                      到期日期
                    </Text>
                    <Text fontSize="14px" fontWeight="500">
                      {formatDate(accountInfo.subscription.expiration_date)}
                    </Text>
                  </HStack>
                  {accountInfo.subscription.features && accountInfo.subscription.features.length > 0 && (
                    <Box>
                      <Text fontSize="14px" color="myGray.600" mb={2}>
                        计划功能
                      </Text>
                      <VStack spacing={1} align="stretch" pl={2}>
                        {accountInfo.subscription.features.map((feature, index) => (
                          <HStack key={index} spacing={2}>
                            <MyIcon name="common/check" w="14px" h="14px" color="green.500" />
                            <Text fontSize="13px">{feature}</Text>
                          </HStack>
                        ))}
                      </VStack>
                    </Box>
                  )}
                </VStack>
              </Box>

              <Divider />

              {/* Requirement 9.3: 余额信息 */}
              <Box>
                <HStack mb={3}>
                  <MyIcon name="support/pay/payRecordLight" w="18px" h="18px" />
                  <Text fontSize="16px" fontWeight="600">
                    余额信息
                  </Text>
                </HStack>
                <VStack spacing={3} align="stretch" pl={6}>
                  <HStack justify="space-between">
                    <Text fontSize="14px" color="myGray.600">
                      当前余额
                    </Text>
                    <Text fontSize="14px" fontWeight="500" color="green.600">
                      ¥ {accountInfo.balance.current_balance.toFixed(2)}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="14px" color="myGray.600">
                      使用配额
                    </Text>
                    <Text fontSize="14px" fontWeight="500">
                      {accountInfo.balance.usage_quota === 0
                        ? '无限'
                        : `${accountInfo.balance.usage_quota} ${accountInfo.balance.quota_unit}`}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="14px" color="myGray.600">
                      剩余配额
                    </Text>
                    <Text
                      fontSize="14px"
                      fontWeight="500"
                      color={isBalanceLow(accountInfo.balance) ? 'red.500' : 'inherit'}
                    >
                      {accountInfo.balance.remaining_quota} {accountInfo.balance.quota_unit}
                    </Text>
                  </HStack>
                  {accountInfo.balance.usage_quota > 0 && (
                    <Box>
                      <Text fontSize="14px" color="myGray.600" mb={2}>
                        使用进度
                      </Text>
                      <Box position="relative" h="8px" bg="myGray.100" borderRadius="full">
                        <Box
                          position="absolute"
                          top={0}
                          left={0}
                          h="100%"
                          bg={isBalanceLow(accountInfo.balance) ? 'red.400' : 'green.400'}
                          borderRadius="full"
                          width={`${
                            ((accountInfo.balance.usage_quota - accountInfo.balance.remaining_quota) /
                              accountInfo.balance.usage_quota) *
                            100
                          }%`}
                          transition="width 0.3s"
                        />
                      </Box>
                      <Text fontSize="12px" color="myGray.500" mt={1} textAlign="right">
                        已使用{' '}
                        {Math.round(
                          ((accountInfo.balance.usage_quota - accountInfo.balance.remaining_quota) /
                            accountInfo.balance.usage_quota) *
                            100
                        )}
                        %
                      </Text>
                    </Box>
                  )}
                </VStack>
              </Box>

              {/* 充值按钮 */}
              {onRecharge && (
                <>
                  <Divider />
                  <Button
                    colorScheme="blue"
                    size="md"
                    onClick={() => {
                      onClose();
                      onRecharge();
                    }}
                    leftIcon={<MyIcon name="support/pay/payRecordLight" w="16px" h="16px" />}
                  >
                    立即充值
                  </Button>
                </>
              )}

              {/* 刷新按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchAccountInfo}
                leftIcon={<MyIcon name="common/refresh" w="14px" h="14px" />}
              >
                刷新信息
              </Button>
            </VStack>
          ) : (
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <AlertDescription>暂无账户信息</AlertDescription>
            </Alert>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AccountInfoModal;
