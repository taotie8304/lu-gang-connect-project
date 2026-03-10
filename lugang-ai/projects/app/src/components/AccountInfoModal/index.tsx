/**
 * 鲁港通 - 账户信息弹窗
 * Tab 1: 个人资料（查看/编辑 name/nickname/phone/email/address）
 * Tab 2: 账户额度（quota/usedQuota/remainingQuota + 充值按钮）
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.6, 3.1, 3.2, 3.3, 3.4
 */

import React, { useEffect, useState, useCallback } from 'react';
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
  Spinner,
  Button,
  Input,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Progress
} from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { useToast } from '@fastgpt/web/hooks/useToast';
import LightRowTabs from '@fastgpt/web/components/common/Tabs/LightRowTabs';
import { GET, PUT } from '@/web/common/api/request';
import type { UserProfile } from '@/pages/api/user/profile';
import type { QuotaResponse } from '@/pages/api/integration/oneapi/quota';

type TabType = 'profile' | 'quota';

interface AccountInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecharge?: () => void;
}

const AccountInfoModal: React.FC<AccountInfoModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('profile');

  // 个人资料状态
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    nickname: '',
    phone: '',
    email: '',
    address: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // 额度状态
  const [quota, setQuota] = useState<QuotaResponse>({ quota: 0, usedQuota: 0, remainingQuota: 0 });
  const [quotaLoading, setQuotaLoading] = useState(false);

  // 加载个人资料
  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const data = await GET<UserProfile>('/user/profile');
      setProfile(data);
      setProfileForm({
        name: data.name || '',
        nickname: data.nickname || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || ''
      });
    } catch {
      // 静默处理
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Requirement 1.1: 通过 /api/integration/oneapi/quota 获取额度
  const fetchQuota = useCallback(async () => {
    setQuotaLoading(true);
    try {
      const data = await GET<QuotaResponse>('/integration/oneapi/quota');
      setQuota(data);
    } catch {
      // Requirement 1.2: 失败时显示默认值 0，不显示错误 Toast
      setQuota({ quota: 0, usedQuota: 0, remainingQuota: 0 });
    } finally {
      setQuotaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
      fetchQuota();
    }
  }, [isOpen, fetchProfile, fetchQuota]);

  // 表单校验
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Requirement 2.4: 邮箱格式校验
    if (profileForm.email) {
      const parts = profileForm.email.split('@');
      if (parts.length !== 2 || !parts[0] || !parts[1] || !parts[1].includes('.')) {
        errors.email = '邮箱格式不合法';
      }
    }

    // Requirement 2.5: 手机号格式校验
    if (profileForm.phone && !/^\d{7,15}$/.test(profileForm.phone)) {
      errors.phone = '手机号格式不合法（需7-15位数字）';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 保存个人资料
  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      await PUT('/user/profile', {
        name: profileForm.name,
        nickname: profileForm.nickname,
        phone: profileForm.phone,
        email: profileForm.email,
        address: profileForm.address
      });
      // Requirement 2.6: 保存成功显示 Toast
      toast({ status: 'success', title: '个人资料保存成功' });
      await fetchProfile();
    } catch (err: any) {
      toast({ status: 'error', title: err?.message || '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  // Requirement 3.4: 充值按钮跳转
  const handleRecharge = () => {
    window.open('https://api.airscend.com/topup', '_blank');
  };

  const usagePercent =
    quota.quota > 0 ? Math.round((quota.usedQuota / quota.quota) * 100) : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>账户信息</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Box mb={4}>
            <LightRowTabs<TabType>
              list={[
                { label: '个人资料', value: 'profile' },
                { label: '账户额度', value: 'quota' }
              ]}
              value={activeTab}
              onChange={setActiveTab}
            />
          </Box>

          {activeTab === 'profile' && (
            <>
              {profileLoading ? (
                <Flex justify="center" py={10}>
                  <Spinner size="lg" />
                </Flex>
              ) : (
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <FormLabel fontSize="14px">姓名</FormLabel>
                    <Input
                      value={profileForm.name}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="请输入姓名"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="14px">昵称</FormLabel>
                    <Input
                      value={profileForm.nickname}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, nickname: e.target.value }))
                      }
                      placeholder="请输入昵称"
                    />
                  </FormControl>

                  <FormControl isInvalid={!!formErrors.phone}>
                    <FormLabel fontSize="14px">手机号</FormLabel>
                    <Input
                      value={profileForm.phone}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder="请输入手机号"
                    />
                    {formErrors.phone && (
                      <FormErrorMessage>{formErrors.phone}</FormErrorMessage>
                    )}
                  </FormControl>

                  <FormControl isInvalid={!!formErrors.email}>
                    <FormLabel fontSize="14px">邮箱</FormLabel>
                    <Input
                      value={profileForm.email}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      placeholder="请输入邮箱"
                    />
                    {formErrors.email && (
                      <FormErrorMessage>{formErrors.email}</FormErrorMessage>
                    )}
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="14px">通讯地址</FormLabel>
                    <Input
                      value={profileForm.address}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, address: e.target.value }))
                      }
                      placeholder="请输入通讯地址"
                    />
                  </FormControl>

                  <Button
                    colorScheme="blue"
                    onClick={handleSave}
                    isLoading={saving}
                    mt={2}
                  >
                    保存
                  </Button>
                </VStack>
              )}
            </>
          )}

          {activeTab === 'quota' && (
            <>
              {quotaLoading ? (
                <Flex justify="center" py={10}>
                  <Spinner size="lg" />
                </Flex>
              ) : (
                <VStack spacing={4} align="stretch">
                  {/* Requirement 3.1, 3.2: 显示额度信息 */}
                  <HStack justify="space-between">
                    <Text fontSize="14px" color="myGray.600">
                      总额度
                    </Text>
                    <Text fontSize="14px" fontWeight="500" data-testid="quota-total">
                      {quota.quota}
                    </Text>
                  </HStack>

                  <HStack justify="space-between">
                    <Text fontSize="14px" color="myGray.600">
                      已用额度
                    </Text>
                    <Text fontSize="14px" fontWeight="500" data-testid="quota-used">
                      {quota.usedQuota}
                    </Text>
                  </HStack>

                  <HStack justify="space-between">
                    <Text fontSize="14px" color="myGray.600">
                      剩余额度
                    </Text>
                    <Text
                      fontSize="14px"
                      fontWeight="500"
                      color={usagePercent >= 90 ? 'red.500' : 'green.600'}
                      data-testid="quota-remaining"
                    >
                      {quota.remainingQuota}
                    </Text>
                  </HStack>

                  {/* 使用进度条 */}
                  {quota.quota > 0 && (
                    <Box>
                      <Text fontSize="12px" color="myGray.500" mb={1}>
                        使用进度 {usagePercent}%
                      </Text>
                      <Progress
                        value={usagePercent}
                        size="sm"
                        borderRadius="full"
                        colorScheme={usagePercent >= 90 ? 'red' : 'green'}
                      />
                    </Box>
                  )}

                  {/* Requirement 3.3, 3.4: 充值按钮 */}
                  <Button colorScheme="blue" onClick={handleRecharge} mt={2}>
                    充值
                  </Button>
                </VStack>
              )}
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AccountInfoModal;
