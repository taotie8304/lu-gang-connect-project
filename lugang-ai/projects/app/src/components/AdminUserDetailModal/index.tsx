/**
 * 鲁港通 - 管理员用户详情弹窗
 * 展示并编辑用户完整信息，支持密码重置
 * Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.5, 5.6, 5.7
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
  Badge,
  Divider,
  Alert,
  AlertIcon
} from '@chakra-ui/react';
import { useToast } from '@fastgpt/web/hooks/useToast';
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
      toast({ status: 'error', title: '获取用户详情失败' });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchDetail();
    }
  }, [isOpen, userId, fetchDetail]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (form.email) {
      const parts = form.email.split('@');
      if (parts.length !== 2 || !parts[0] || !parts[1] || !parts[1].includes('.')) {
        errors.email = '邮箱格式不合法';
      }
    }

    if (form.phone && !/^\d{7,15}$/.test(form.phone)) {
      errors.phone = '手机号格式不合法（需7-15位数字）';
    }

    // Requirement 5.5: 密码长度校验
    if (form.newPassword && form.newPassword.length < 8) {
      errors.newPassword = '密码长度至少 8 位';
    }

    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
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
      toast({ status: 'success', title: '用户信息保存成功' });
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast({ status: 'error', title: err?.message || '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', {
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
        <ModalHeader>用户详情</ModalHeader>
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
                  root 用户信息不可修改
                </Alert>
              )}

              {/* 只读信息 */}
              <HStack justify="space-between">
                <Text fontSize="14px" color="myGray.600">用户名</Text>
                <Text fontSize="14px" fontWeight="500">{detail.username}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="14px" color="myGray.600">注册时间</Text>
                <Text fontSize="14px">{formatDate(detail.createTime)}</Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="14px" color="myGray.600">状态</Text>
                <Badge
                  colorScheme={detail.status === 'active' ? 'green' : 'red'}
                  variant="subtle"
                >
                  {detail.status === 'active' ? '正常' : '已禁用'}
                </Badge>
              </HStack>

              <Divider />

              {/* 可编辑字段 */}
              <FormControl>
                <FormLabel fontSize="14px">姓名</FormLabel>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  isDisabled={isRootUser}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="14px">昵称</FormLabel>
                <Input
                  value={form.nickname}
                  onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))}
                  isDisabled={isRootUser}
                />
              </FormControl>

              <FormControl isInvalid={!!formErrors.phone}>
                <FormLabel fontSize="14px">手机号</FormLabel>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  isDisabled={isRootUser}
                />
                {formErrors.phone && <FormErrorMessage>{formErrors.phone}</FormErrorMessage>}
              </FormControl>

              <FormControl isInvalid={!!formErrors.email}>
                <FormLabel fontSize="14px">邮箱</FormLabel>
                <Input
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  isDisabled={isRootUser}
                />
                {formErrors.email && <FormErrorMessage>{formErrors.email}</FormErrorMessage>}
              </FormControl>

              <FormControl>
                <FormLabel fontSize="14px">通讯地址</FormLabel>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  isDisabled={isRootUser}
                />
              </FormControl>

              <Divider />

              {/* 密码重置 */}
              <Text fontSize="14px" fontWeight="600">密码重置（可选）</Text>

              <FormControl isInvalid={!!formErrors.newPassword}>
                <FormLabel fontSize="14px">新密码</FormLabel>
                <Input
                  type="password"
                  value={form.newPassword}
                  onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder="留空则不修改"
                  isDisabled={isRootUser}
                />
                {formErrors.newPassword && (
                  <FormErrorMessage>{formErrors.newPassword}</FormErrorMessage>
                )}
              </FormControl>

              <FormControl isInvalid={!!formErrors.confirmPassword}>
                <FormLabel fontSize="14px">确认密码</FormLabel>
                <Input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="再次输入新密码"
                  isDisabled={isRootUser}
                />
                {formErrors.confirmPassword && (
                  <FormErrorMessage>{formErrors.confirmPassword}</FormErrorMessage>
                )}
              </FormControl>

              <Divider />

              {/* 额度展示（只读） */}
              <Text fontSize="14px" fontWeight="600">账户额度</Text>
              {detail.quota ? (
                <VStack spacing={2} align="stretch">
                  <HStack justify="space-between">
                    <Text fontSize="13px" color="myGray.600">总额度</Text>
                    <Text fontSize="13px">{detail.quota.quota}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="13px" color="myGray.600">已用额度</Text>
                    <Text fontSize="13px">{detail.quota.usedQuota}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="13px" color="myGray.600">剩余额度</Text>
                    <Text fontSize="13px" color="green.600">{detail.quota.remainingQuota}</Text>
                  </HStack>
                </VStack>
              ) : (
                <Text fontSize="13px" color="myGray.500">暂无数据</Text>
              )}

              {/* 保存按钮 */}
              {!isRootUser && (
                <Button
                  colorScheme="blue"
                  onClick={handleSave}
                  isLoading={saving}
                  mt={2}
                >
                  保存
                </Button>
              )}
            </VStack>
          ) : (
            <Text color="myGray.500">无法加载用户信息</Text>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AdminUserDetailModal;
