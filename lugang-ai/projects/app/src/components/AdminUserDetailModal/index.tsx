/**
 * 鲁港通 - 管理员用户详情弹窗
 * 展示并编辑用户完整信息，支持密码重置
 * Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.5, 5.6, 5.7
 *
 * 适配 4.16.2：全部用户可见文字走 i18n（common:admin_user.*）；
 *   邮箱/手机号校验复用 @fastgpt/global/support/user/validation，与后端 detail.ts 保持一致。
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
  Text,
  Flex,
  Spinner,
  Button,
  Input,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Badge,
  Divider,
  Alert,
  AlertIcon
} from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { isValidEmail, isValidChinesePhone } from '@fastgpt/global/support/user/validation';
import { GET, PUT } from '@/web/common/api/request';
import type { AdminUserDetail } from '@/pages/api/admin/users/detail';

interface AdminUserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSaved?: () => void;
}

const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSaved
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [form, setForm] = useState({
    name: '',
    nickname: '',
    phone: '',
    email: '',
    address: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isRootUser = detail?.isRoot ?? false;

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await GET<AdminUserDetail>('/admin/users/detail', { userId });
      setDetail(data);
      setForm({
        name: data.name || '',
        nickname: data.nickname || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch {
      toast({ status: 'error', title: t('common:admin_user.fetch_detail_failed') });
    } finally {
      setLoading(false);
    }
  }, [userId, toast, t]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchDetail();
    }
  }, [isOpen, userId, fetchDetail]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (form.email && !isValidEmail(form.email)) {
      errors.email = t('common:admin_user.email_invalid');
    }

    if (form.phone && !isValidChinesePhone(form.phone)) {
      errors.phone = t('common:admin_user.phone_invalid');
    }

    // Requirement 5.5: 密码长度校验
    if (form.newPassword && form.newPassword.length < 8) {
      errors.newPassword = t('common:admin_user.password_too_short');
    }

    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      errors.confirmPassword = t('common:admin_user.password_mismatch');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const body: Record<string, any> = {
        userId,
        name: form.name,
        nickname: form.nickname,
        phone: form.phone,
        email: form.email,
        address: form.address
      };
      if (form.newPassword) {
        body.newPassword = form.newPassword;
      }

      await PUT('/admin/users/detail', body);
      // Requirement 5.6: 保存成功显示 Toast
      toast({ status: 'success', title: t('common:admin_user.save_success') });
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast({ status: 'error', title: err?.message || t('common:admin_user.save_failed') });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t('common:admin_user.detail_title')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {loading ? (
            <Flex justify="center" py={10}>
              <Spinner size="lg" />
            </Flex>
          ) : detail ? (
            <VStack spacing={4} align="stretch">
              {/* Requirement 5.7: root 用户提示 */}
              {isRootUser && (
                <Alert status="warning" borderRadius="md">
                  <AlertIcon />
                  {t('common:admin_user.root_readonly')}
                </Alert>
              )}

              {/* 只读信息 */}
              <HStack justify="space-between">
                <Text fontSize="14px" color="myGray.600">
                  {t('common:admin_user.username')}
                </Text>
                <Text fontSize="14px" fontWeight="500">
                  {detail.username}
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="14px" color="myGray.600">
                  {t('common:admin_user.create_time')}
                </Text>
                <Text fontSize="14px">{formatDate(detail.createTime)}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="14px" color="myGray.600">
                  {t('common:admin_user.status')}
                </Text>
                <Badge
                  colorScheme={detail.status === 'active' ? 'green' : 'red'}
                  variant="subtle"
                >
                  {detail.status === 'active'
                    ? t('common:admin_user.status_active')
                    : t('common:admin_user.status_forbidden')}
                </Badge>
              </HStack>

              <Divider />

              {/* 可编辑字段 */}
              <FormControl>
                <FormLabel fontSize="14px">{t('common:admin_user.name')}</FormLabel>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  isDisabled={isRootUser}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="14px">{t('common:admin_user.nickname')}</FormLabel>
                <Input
                  value={form.nickname}
                  onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))}
                  isDisabled={isRootUser}
                />
              </FormControl>

              <FormControl isInvalid={!!formErrors.phone}>
                <FormLabel fontSize="14px">{t('common:admin_user.phone')}</FormLabel>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  isDisabled={isRootUser}
                />
                {formErrors.phone && <FormErrorMessage>{formErrors.phone}</FormErrorMessage>}
              </FormControl>

              <FormControl isInvalid={!!formErrors.email}>
                <FormLabel fontSize="14px">{t('common:admin_user.email')}</FormLabel>
                <Input
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  isDisabled={isRootUser}
                />
                {formErrors.email && <FormErrorMessage>{formErrors.email}</FormErrorMessage>}
              </FormControl>

              <FormControl>
                <FormLabel fontSize="14px">{t('common:admin_user.address')}</FormLabel>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  isDisabled={isRootUser}
                />
              </FormControl>

              <Divider />

              {/* 密码重置 */}
              <Text fontSize="14px" fontWeight="600">
                {t('common:admin_user.password_reset')}
              </Text>

              <FormControl isInvalid={!!formErrors.newPassword}>
                <FormLabel fontSize="14px">{t('common:admin_user.new_password')}</FormLabel>
                <Input
                  type="password"
                  value={form.newPassword}
                  onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder={t('common:admin_user.password_placeholder')}
                  isDisabled={isRootUser}
                />
                {formErrors.newPassword && (
                  <FormErrorMessage>{formErrors.newPassword}</FormErrorMessage>
                )}
              </FormControl>

              <FormControl isInvalid={!!formErrors.confirmPassword}>
                <FormLabel fontSize="14px">{t('common:admin_user.confirm_password')}</FormLabel>
                <Input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder={t('common:admin_user.confirm_password_placeholder')}
                  isDisabled={isRootUser}
                />
                {formErrors.confirmPassword && (
                  <FormErrorMessage>{formErrors.confirmPassword}</FormErrorMessage>
                )}
              </FormControl>

              <Divider />

              {/* 额度展示（只读） */}
              <Text fontSize="14px" fontWeight="600">
                {t('common:admin_user.quota')}
              </Text>
              {detail.quota ? (
                <VStack spacing={2} align="stretch">
                  <HStack justify="space-between">
                    <Text fontSize="13px" color="myGray.600">
                      {t('common:admin_user.quota_total')}
                    </Text>
                    <Text fontSize="13px">{detail.quota.quota}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="13px" color="myGray.600">
                      {t('common:admin_user.quota_used')}
                    </Text>
                    <Text fontSize="13px">{detail.quota.usedQuota}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="13px" color="myGray.600">
                      {t('common:admin_user.quota_remaining')}
                    </Text>
                    <Text fontSize="13px" color="green.600">
                      {detail.quota.remainingQuota}
                    </Text>
                  </HStack>
                </VStack>
              ) : (
                <Text fontSize="13px" color="myGray.500">
                  {t('common:admin_user.quota_none')}
                </Text>
              )}

              {/* 保存按钮 */}
              {!isRootUser && (
                <Button colorScheme="blue" onClick={handleSave} isLoading={saving} mt={2}>
                  {t('common:admin_user.save')}
                </Button>
              )}
            </VStack>
          ) : (
            <Text color="myGray.500">{t('common:admin_user.load_failed')}</Text>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AdminUserDetailModal;
