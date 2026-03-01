/**
 * 鲁港通 - 充值套餐弹窗
 * 显示可用充值套餐列表
 * Requirements: 10.1
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
  Button,
  Badge,
  Grid,
  Spinner,
  Alert,
  AlertIcon,
  AlertDescription,
  Flex
} from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useToast } from '@fastgpt/web/hooks/useToast';
import type { RechargePackage } from '@fastgpt/service/support/user/integration/recharge';

interface RechargePackagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPackage: (pkg: RechargePackage) => void; // 选择套餐回调
}

/**
 * 充值套餐弹窗组件
 * Requirement 10.1: 显示可用充值套餐列表
 */
const RechargePackagesModal: React.FC<RechargePackagesModalProps> = ({
  isOpen,
  onClose,
  onSelectPackage
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<RechargePackage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  // 获取充值套餐列表
  const fetchPackages = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/recharge/packages');

      if (!response.ok) {
        throw new Error('获取充值套餐失败');
      }

      const data = await response.json();

      if (data.code === 200 && data.data) {
        setPackages(data.data);
      } else {
        throw new Error(data.message || '获取充值套餐失败');
      }
    } catch (err: any) {
      setError(err.message || '获取充值套餐失败');
      toast({
        status: 'error',
        title: '获取充值套餐失败',
        description: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  // 打开弹窗时获取套餐列表
  useEffect(() => {
    if (isOpen) {
      fetchPackages();
    }
  }, [isOpen]);

  // 处理套餐选择
  const handleSelectPackage = (pkg: RechargePackage) => {
    setSelectedPackageId(pkg.id);
    onSelectPackage(pkg);
  };

  // 格式化金额
  const formatAmount = (amount: number): string => {
    return `¥${amount.toFixed(2)}`;
  };

  // 格式化配额
  const formatQuota = (quota: number, unit: string): string => {
    if (quota >= 10000) {
      return `${(quota / 10000).toFixed(1)}万${unit}`;
    }
    return `${quota}${unit}`;
  };

  // 计算折扣信息
  const getDiscountInfo = (pkg: RechargePackage) => {
    if (!pkg.discount_percentage || !pkg.original_price) {
      return null;
    }

    const savingsAmount = pkg.original_price - pkg.amount;
    const discountText = `${(10 - pkg.discount_percentage / 10).toFixed(1)}折`;

    return {
      discountText,
      savingsAmount
    };
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="90vh">
        <ModalHeader>选择充值套餐</ModalHeader>
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
          ) : packages.length === 0 ? (
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <AlertDescription>暂无可用充值套餐</AlertDescription>
            </Alert>
          ) : (
            <Grid
              templateColumns={{
                base: '1fr',
                md: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)'
              }}
              gap={4}
            >
              {packages.map((pkg) => {
                const discountInfo = getDiscountInfo(pkg);
                const isSelected = selectedPackageId === pkg.id;

                return (
                  <Box
                    key={pkg.id}
                    borderWidth="2px"
                    borderColor={isSelected ? 'blue.500' : 'myGray.200'}
                    borderRadius="lg"
                    p={4}
                    cursor="pointer"
                    transition="all 0.2s"
                    position="relative"
                    _hover={{
                      borderColor: 'blue.400',
                      transform: 'translateY(-2px)',
                      boxShadow: 'md'
                    }}
                    onClick={() => handleSelectPackage(pkg)}
                    bg={isSelected ? 'blue.50' : 'white'}
                  >
                    {/* 热门标签 */}
                    {pkg.is_popular && (
                      <Badge
                        position="absolute"
                        top={2}
                        right={2}
                        colorScheme="red"
                        fontSize="10px"
                      >
                        热门
                      </Badge>
                    )}

                    {/* 折扣标签 */}
                    {discountInfo && (
                      <Badge
                        position="absolute"
                        top={2}
                        left={2}
                        colorScheme="orange"
                        fontSize="10px"
                      >
                        {discountInfo.discountText}
                      </Badge>
                    )}

                    <VStack spacing={3} align="stretch" mt={pkg.is_popular || discountInfo ? 4 : 0}>
                      {/* 套餐名称 */}
                      <Text fontSize="18px" fontWeight="600" textAlign="center">
                        {pkg.name}
                      </Text>

                      {/* 金额信息 */}
                      <Box textAlign="center">
                        <HStack justify="center" spacing={2}>
                          <Text fontSize="28px" fontWeight="700" color="blue.600">
                            {formatAmount(pkg.amount)}
                          </Text>
                          {discountInfo && pkg.original_price && (
                            <Text
                              fontSize="16px"
                              color="myGray.500"
                              textDecoration="line-through"
                            >
                              {formatAmount(pkg.original_price)}
                            </Text>
                          )}
                        </HStack>

                        {/* 赠送金额 */}
                        {pkg.bonus > 0 && (
                          <Text fontSize="14px" color="green.600" mt={1}>
                            赠送 {formatAmount(pkg.bonus)}
                          </Text>
                        )}

                        {/* 实际到账 */}
                        <Text fontSize="14px" color="myGray.600" mt={1}>
                          实际到账 {formatAmount(pkg.total_amount)}
                        </Text>
                      </Box>

                      {/* 配额信息 */}
                      <Box
                        bg="myGray.50"
                        borderRadius="md"
                        p={3}
                        textAlign="center"
                      >
                        <Text fontSize="14px" color="myGray.600" mb={1}>
                          可用配额
                        </Text>
                        <Text fontSize="20px" fontWeight="600" color="blue.600">
                          {formatQuota(pkg.quota, pkg.quota_unit)}
                        </Text>
                      </Box>

                      {/* 套餐描述 */}
                      {pkg.description && (
                        <Text fontSize="13px" color="myGray.600" textAlign="center">
                          {pkg.description}
                        </Text>
                      )}

                      {/* 套餐特性 */}
                      {pkg.features && pkg.features.length > 0 && (
                        <VStack spacing={1} align="stretch">
                          {pkg.features.map((feature, index) => (
                            <HStack key={index} spacing={2}>
                              <MyIcon name="common/check" w="14px" h="14px" color="green.500" />
                              <Text fontSize="12px" color="myGray.700">
                                {feature}
                              </Text>
                            </HStack>
                          ))}
                        </VStack>
                      )}

                      {/* 选择按钮 */}
                      <Button
                        colorScheme={isSelected ? 'blue' : 'gray'}
                        size="md"
                        mt={2}
                        leftIcon={
                          isSelected ? (
                            <MyIcon name="common/check" w="16px" h="16px" />
                          ) : undefined
                        }
                      >
                        {isSelected ? '已选择' : '选择套餐'}
                      </Button>
                    </VStack>
                  </Box>
                );
              })}
            </Grid>
          )}

          {/* 刷新按钮 */}
          {!loading && !error && (
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchPackages}
              leftIcon={<MyIcon name="common/refresh" w="14px" h="14px" />}
              mt={4}
            >
              刷新套餐列表
            </Button>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default RechargePackagesModal;
