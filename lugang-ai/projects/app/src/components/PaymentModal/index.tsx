/**
 * 鲁港通 - 支付弹窗
 * 显示支付方式选择和支付信息
 * Requirements: 10.2, 10.3, 10.4, 10.5
 */

import React, { useState } from 'react';
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
  Button,
  Radio,
  RadioGroup,
  Stack,
  Divider,
  Alert,
  AlertIcon,
  AlertDescription,
  Spinner,
  Image
} from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useToast } from '@fastgpt/web/hooks/useToast';
import type { RechargePackage } from '@fastgpt/service/support/user/integration/recharge';
import { PaymentMethod } from '@fastgpt/service/support/payment/types';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  package: RechargePackage | null; // 选中的套餐
  onPaymentSuccess: () => void;    // 支付成功回调
}

/**
 * 支付弹窗组件
 * Requirement 10.2: 发起支付流程
 * Requirement 10.3: 支持微信支付和支付宝
 * Requirement 10.4: 处理支付回调
 * Requirement 10.5: 刷新账户信息显示
 */
const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  package: selectedPackage,
  onPaymentSuccess
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.WeChat);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  // Requirement 10.4, 10.5: 支付状态轮询
  const { isPolling, isSuccess } = usePaymentStatus({
    orderId: currentOrderId,
    onSuccess: () => {
      // Requirement 10.5: 支付成功后刷新账户信息
      onPaymentSuccess();
      onClose();
    },
    onFailed: () => {
      setError('支付失败，请重试');
    },
    enabled: !!currentOrderId
  });

  // 处理支付
  const handlePay = async () => {
    if (!selectedPackage) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 调用支付 API
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          package_id: selectedPackage.id,
          payment_method: paymentMethod
        })
      });

      if (!response.ok) {
        throw new Error('创建支付订单失败');
      }

      const data = await response.json();

      if (data.code === 200 && data.data) {
        const paymentData = data.data;

        // Requirement 10.4: 保存订单 ID 用于状态轮询
        setCurrentOrderId(paymentData.order_id);

        // 根据支付方式处理
        if (paymentData.payment_url) {
          // 跳转到支付页面
          window.location.href = paymentData.payment_url;
        } else if (paymentData.qr_code) {
          // 显示二维码（扫码支付）
          // TODO: 实现二维码显示
          toast({
            status: 'info',
            title: '请扫码支付',
            description: '请使用手机扫描二维码完成支付'
          });
        } else {
          throw new Error('支付数据格式错误');
        }
      } else {
        throw new Error(data.message || '创建支付订单失败');
      }
    } catch (err: any) {
      setError(err.message || '创建支付订单失败');
      toast({
        status: 'error',
        title: '支付失败',
        description: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  // 格式化金额
  const formatAmount = (amount: number): string => {
    return `¥${amount.toFixed(2)}`;
  };

  // 获取支付方式图标
  const getPaymentIcon = (method: PaymentMethod): string => {
    const icons: Record<PaymentMethod, string> = {
      [PaymentMethod.WeChat]: '/images/payment/wechat.png',
      [PaymentMethod.Alipay]: '/images/payment/alipay.png',
      [PaymentMethod.UnionPay]: '/images/payment/unionpay.png'
    };
    return icons[method] || '';
  };

  // 获取支付方式名称
  const getPaymentName = (method: PaymentMethod): string => {
    const names: Record<PaymentMethod, string> = {
      [PaymentMethod.WeChat]: '微信支付',
      [PaymentMethod.Alipay]: '支付宝',
      [PaymentMethod.UnionPay]: '银联支付'
    };
    return names[method] || method;
  };

  if (!selectedPackage) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>确认支付</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4} align="stretch">
            {/* 套餐信息 */}
            <Box bg="myGray.50" borderRadius="md" p={4}>
              <VStack spacing={2} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="14px" color="myGray.600">
                    套餐名称
                  </Text>
                  <Text fontSize="14px" fontWeight="500">
                    {selectedPackage.name}
                  </Text>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="14px" color="myGray.600">
                    充值金额
                  </Text>
                  <Text fontSize="16px" fontWeight="600" color="blue.600">
                    {formatAmount(selectedPackage.amount)}
                  </Text>
                </HStack>
                {selectedPackage.bonus > 0 && (
                  <HStack justify="space-between">
                    <Text fontSize="14px" color="myGray.600">
                      赠送金额
                    </Text>
                    <Text fontSize="14px" fontWeight="500" color="green.600">
                      +{formatAmount(selectedPackage.bonus)}
                    </Text>
                  </HStack>
                )}
                <Divider />
                <HStack justify="space-between">
                  <Text fontSize="14px" fontWeight="600">
                    实际到账
                  </Text>
                  <Text fontSize="18px" fontWeight="700" color="blue.600">
                    {formatAmount(selectedPackage.total_amount)}
                  </Text>
                </HStack>
              </VStack>
            </Box>

            {/* 支付方式选择 */}
            <Box>
              <Text fontSize="14px" fontWeight="600" mb={3}>
                选择支付方式
              </Text>
              <RadioGroup
                value={paymentMethod}
                onChange={(value) => setPaymentMethod(value as PaymentMethod)}
              >
                <Stack spacing={2}>
                  {/* 微信支付 */}
                  <Box
                    borderWidth="1px"
                    borderColor={
                      paymentMethod === PaymentMethod.WeChat ? 'blue.500' : 'myGray.200'
                    }
                    borderRadius="md"
                    p={3}
                    cursor="pointer"
                    onClick={() => setPaymentMethod(PaymentMethod.WeChat)}
                    _hover={{ borderColor: 'blue.400' }}
                  >
                    <HStack spacing={3}>
                      <Radio value={PaymentMethod.WeChat} />
                      <MyIcon name="common/wechat" w="24px" h="24px" color="green.500" />
                      <Text fontSize="14px" fontWeight="500">
                        {getPaymentName(PaymentMethod.WeChat)}
                      </Text>
                    </HStack>
                  </Box>

                  {/* 支付宝 */}
                  <Box
                    borderWidth="1px"
                    borderColor={
                      paymentMethod === PaymentMethod.Alipay ? 'blue.500' : 'myGray.200'
                    }
                    borderRadius="md"
                    p={3}
                    cursor="pointer"
                    onClick={() => setPaymentMethod(PaymentMethod.Alipay)}
                    _hover={{ borderColor: 'blue.400' }}
                  >
                    <HStack spacing={3}>
                      <Radio value={PaymentMethod.Alipay} />
                      <Box w="24px" h="24px" bg="blue.500" borderRadius="sm" />
                      <Text fontSize="14px" fontWeight="500">
                        {getPaymentName(PaymentMethod.Alipay)}
                      </Text>
                    </HStack>
                  </Box>
                </Stack>
              </RadioGroup>
            </Box>

            {/* 错误提示 */}
            {error && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <AlertDescription fontSize="14px">{error}</AlertDescription>
              </Alert>
            )}

            {/* 支付轮询提示 */}
            {isPolling && (
              <Alert status="info" borderRadius="md">
                <Spinner size="sm" mr={2} />
                <AlertDescription fontSize="14px">
                  正在确认支付结果，请稍候...
                </AlertDescription>
              </Alert>
            )}

            {/* 支付按钮 */}
            <Button
              colorScheme="blue"
              size="lg"
              onClick={handlePay}
              isLoading={loading || isPolling}
              loadingText={isPolling ? '确认支付中...' : '正在创建订单...'}
              isDisabled={isPolling}
              leftIcon={<MyIcon name="support/pay/payRecordLight" w="18px" h="18px" />}
            >
              立即支付 {formatAmount(selectedPackage.amount)}
            </Button>

            {/* 支付说明 */}
            <Text fontSize="12px" color="myGray.500" textAlign="center">
              支付即表示您同意《鲁港通服务协议》和《隐私政策》
            </Text>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default PaymentModal;
