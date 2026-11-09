/**
 * 鲁港通 - 管理员用户详情弹窗
 * 三页签：资料 / Credits 与代金券 / 操作记录
 * root 账号只读：资料不可改、不可调整 Credits、不可发券
 * 展示并编辑用户完整信息，支持密码重置
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
  Textarea,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Badge,
  Divider,
  Alert,
  AlertIcon,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Box
} from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { isValidEmail, isValidChinesePhone } from '@fastgpt/global/support/user/validation';
import { AdminAuditEventEnum } from '@fastgpt/global/support/user/audit/constants';
import { VoucherSourceEnum } from '@fastgpt/global/support/wallet/voucher/constants';
import { GET, PUT, POST } from '@/web/common/api/request';
import type { AdminUserDetail } from '@/pages/api/admin/users/detail';
import type { AdminUserWalletResponse } from '@/pages/api/admin/users/wallet';
import type { AdminAdjustUserPointsResponse } from '@/pages/api/admin/users/points';
import type { AdminIssueVoucherResponse } from '@/pages/api/admin/users/voucher';

interface AdminUserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSaved?: () => void;
}

const ADMIN_VOUCHER_MAX_YUAN = 100000;

const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSaved
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
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

  const [wallet, setWallet] = useState<AdminUserWalletResponse | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [adjustMode, setAdjustMode] = useState<'add' | 'deduct' | null>(null);
  const [deltaInput, setDeltaInput] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [voucherNote, setVoucherNote] = useState('');
  const [issuing, setIssuing] = useState(false);

  const isRootUser = detail?.isRoot ?? false;

  const fetchDetail = useCallback(async () => {
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

  const fetchWallet = useCallback(async () => {
    try {
      const data = await GET<AdminUserWalletResponse>('/admin/users/wallet', { userId });
      setWallet(data);
    } catch {
      toast({ status: 'error', title: t('common:admin_user.wallet_load_failed') });
    } finally {
      setWalletLoading(false);
    }
  }, [userId, toast, t]);

  // 关闭动画结束后重置状态，避免下一次打开时残留上一位用户的数据
  const resetOnCloseComplete = useCallback(() => {
    setDetail(null);
    setWallet(null);
    setLoading(true);
    setWalletLoading(true);
    setFormErrors({});
    setAdjustMode(null);
    setDeltaInput('');
    setAdjustReason('');
    setAmountInput('');
    setVoucherNote('');
  }, []);

  useEffect(() => {
    if (isOpen && userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 打开弹窗即拉取该用户资料与钱包，属于对外部数据源的同步
      fetchDetail();
      fetchWallet();
    }
  }, [isOpen, userId, fetchDetail, fetchWallet]);

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

  const balance = wallet?.points.surplusPoints ?? 0;
  const deltaNum = Number(deltaInput);
  const deltaValid =
    /^\d+$/.test(deltaInput.trim()) && Number.isInteger(deltaNum) && deltaNum > 0;
  const reasonValid = adjustReason.trim().length >= 2 && adjustReason.trim().length <= 200;
  const signedDelta = adjustMode === 'deduct' ? -deltaNum : deltaNum;
  const afterBalance = balance + (deltaValid ? signedDelta : 0);
  const deductExceeds = adjustMode === 'deduct' && deltaValid && deltaNum > balance;

  const amountNum = Number(amountInput);
  const amountValid =
    amountInput.trim() !== '' &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    amountNum <= ADMIN_VOUCHER_MAX_YUAN &&
    Math.abs(amountNum * 100 - Math.round(amountNum * 100)) < 1e-6;
  const noteValid = voucherNote.trim().length <= 200;

  const handleAdjust = async () => {
    if (!adjustMode || !deltaValid || !reasonValid || deductExceeds) return;
    setAdjusting(true);
    try {
      await POST<AdminAdjustUserPointsResponse>('/admin/users/points', {
        userId,
        delta: signedDelta,
        reason: adjustReason.trim()
      });
      toast({ status: 'success', title: t('common:admin_user.credits_adjust_success') });
      setAdjustMode(null);
      setDeltaInput('');
      setAdjustReason('');
      setWalletLoading(true);
      await fetchWallet();
      onSaved?.();
    } catch (err: any) {
      toast({ status: 'error', title: err?.message || t('common:admin_user.credits_adjust_failed') });
    } finally {
      setAdjusting(false);
    }
  };

  const handleIssueVoucher = async () => {
    if (!amountValid || !noteValid) return;
    setIssuing(true);
    try {
      await POST<AdminIssueVoucherResponse>('/admin/users/voucher', {
        userId,
        amountYuan: amountNum,
        note: voucherNote.trim()
      });
      toast({ status: 'success', title: t('common:admin_user.voucher_issue_success') });
      setAmountInput('');
      setVoucherNote('');
      setWalletLoading(true);
      await fetchWallet();
      onSaved?.();
    } catch (err: any) {
      toast({ status: 'error', title: err?.message || t('common:admin_user.voucher_issue_failed') });
    } finally {
      setIssuing(false);
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

  const formatMoney = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });

  const renderLogItem = (log: AdminUserWalletResponse['logs'][number]) => {
    const meta = (log.metadata ?? {}) as Record<string, any>;
    const isPoints = log.event === AdminAuditEventEnum.ADMIN_ADJUST_USER_POINTS;
    const delta = Number(meta.delta) || 0;
    return (
      <Box key={log._id} border="1px solid" borderColor="myGray.200" borderRadius="md" p={3}>
        <Flex justify="space-between" align="center">
          <Badge colorScheme={isPoints ? 'blue' : 'purple'} variant="subtle" px={2} borderRadius="md">
            {isPoints
              ? t('common:admin_user.logs_adjust_points')
              : t('common:admin_user.logs_issue_voucher')}
          </Badge>
          <Text
            fontSize="sm"
            fontWeight="600"
            color={isPoints ? (delta >= 0 ? 'green.500' : 'red.500') : 'purple.500'}
          >
            {isPoints
              ? `${delta > 0 ? '+' : ''}${delta}`
              : `¥${formatMoney(Number(meta.amountYuan) || 0)}`}
          </Text>
        </Flex>
        <Text fontSize="xs" color="myGray.600" mt={1.5}>
          {t('common:admin_user.logs_operator', { name: String(meta.name || 'root') })}
        </Text>
        {isPoints && meta.reason ? (
          <Text fontSize="xs" color="myGray.600">
            {t('common:admin_user.logs_reason', { reason: String(meta.reason) })}
          </Text>
        ) : null}
        {!isPoints && meta.note ? (
          <Text fontSize="xs" color="myGray.600">
            {t('common:admin_user.logs_note', { note: String(meta.note) })}
          </Text>
        ) : null}
        <Text fontSize="xs" color="myGray.400" mt={1}>
          {formatDate(log.timestamp)}
        </Text>
      </Box>
    );
  };

  const renderWalletContent = () => {
    if (walletLoading && !wallet) {
      return (
        <Flex justify="center" py={8}>
          <Spinner size="lg" />
        </Flex>
      );
    }
    if (!wallet) {
      return <Text color="myGray.500">{t('common:admin_user.wallet_load_failed')}</Text>;
    }

    return (
      <VStack spacing={4} align="stretch">
        {/* Credits 账户 */}
        <Box border="1px solid" borderColor="myGray.200" borderRadius="md" p={4}>
          <Flex justify="space-between" align="center" gap={4}>
            <Box>
              <Text fontSize="xs" color="myGray.500">
                {t('common:admin_user.credits_balance')}
              </Text>
              <Text fontSize="2xl" fontWeight="700" color="myGray.900">
                {isRootUser ? '—' : formatMoney(balance)}
              </Text>
            </Box>
            {!isRootUser && (
              <HStack spacing={2}>
                <Button
                  size="sm"
                  colorScheme="green"
                  variant={adjustMode === 'add' ? 'solid' : 'outline'}
                  onClick={() => {
                    setAdjustMode('add');
                    setDeltaInput('');
                    setAdjustReason('');
                  }}
                >
                  {t('common:admin_user.credits_add')}
                </Button>
                <Button
                  size="sm"
                  colorScheme="red"
                  variant={adjustMode === 'deduct' ? 'solid' : 'outline'}
                  onClick={() => {
                    setAdjustMode('deduct');
                    setDeltaInput('');
                    setAdjustReason('');
                  }}
                >
                  {t('common:admin_user.credits_deduct')}
                </Button>
              </HStack>
            )}
          </Flex>

          {!isRootUser && adjustMode && (
            <VStack spacing={3} align="stretch" mt={4}>
              <FormControl isInvalid={deltaInput !== '' && !deltaValid}>
                <FormLabel fontSize="sm">{t('common:admin_user.credits_delta_label')}</FormLabel>
                <Input
                  size="sm"
                  type="number"
                  min={1}
                  step={1}
                  value={deltaInput}
                  placeholder={t('common:admin_user.credits_delta_placeholder')}
                  onChange={(e) => setDeltaInput(e.target.value)}
                />
                {deltaInput !== '' && !deltaValid && (
                  <FormErrorMessage>{t('common:admin_user.credits_delta_invalid')}</FormErrorMessage>
                )}
              </FormControl>
              <FormControl isInvalid={adjustReason !== '' && !reasonValid}>
                <FormLabel fontSize="sm">{t('common:admin_user.credits_reason_label')}</FormLabel>
                <Textarea
                  size="sm"
                  rows={2}
                  maxLength={200}
                  value={adjustReason}
                  placeholder={t('common:admin_user.credits_reason_placeholder')}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
                {adjustReason !== '' && !reasonValid && (
                  <FormErrorMessage>
                    {t('common:admin_user.credits_reason_invalid')}
                  </FormErrorMessage>
                )}
              </FormControl>
              {deltaValid && (
                <Text fontSize="sm" color={deductExceeds ? 'red.500' : 'myGray.600'}>
                  {deductExceeds
                    ? t('common:admin_user.credits_deduct_exceeds')
                    : t('common:admin_user.credits_after', { balance: formatMoney(afterBalance) })}
                </Text>
              )}
              <Button
                size="sm"
                alignSelf="flex-end"
                colorScheme={adjustMode === 'add' ? 'green' : 'red'}
                isDisabled={!deltaValid || !reasonValid || deductExceeds}
                isLoading={adjusting}
                onClick={handleAdjust}
              >
                {adjustMode === 'add'
                  ? t('common:admin_user.credits_confirm_add')
                  : t('common:admin_user.credits_confirm_deduct')}
              </Button>
            </VStack>
          )}
        </Box>

        {/* 发放代金券 */}
        {!isRootUser && (
          <Box border="1px solid" borderColor="myGray.200" borderRadius="md" p={4}>
            <Text fontSize="14px" fontWeight="600">
              {t('common:admin_user.voucher_title')}
            </Text>
            <VStack spacing={3} align="stretch" mt={3}>
              <FormControl isInvalid={amountInput !== '' && !amountValid}>
                <FormLabel fontSize="sm">{t('common:admin_user.voucher_amount_label')}</FormLabel>
                <Input
                  size="sm"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={amountInput}
                  placeholder={t('common:admin_user.voucher_amount_placeholder')}
                  onChange={(e) => setAmountInput(e.target.value)}
                />
                {amountInput !== '' && !amountValid && (
                  <FormErrorMessage>
                    {t('common:admin_user.voucher_amount_invalid')}
                  </FormErrorMessage>
                )}
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t('common:admin_user.voucher_note_label')}</FormLabel>
                <Input
                  size="sm"
                  maxLength={200}
                  value={voucherNote}
                  placeholder={t('common:admin_user.voucher_note_placeholder')}
                  onChange={(e) => setVoucherNote(e.target.value)}
                />
              </FormControl>
              <Button
                size="sm"
                alignSelf="flex-end"
                colorScheme="purple"
                isDisabled={!amountValid || !noteValid}
                isLoading={issuing}
                onClick={handleIssueVoucher}
              >
                {t('common:admin_user.voucher_issue')}
              </Button>
            </VStack>
          </Box>
        )}

        {/* 持券记录 */}
        <Box>
          <Text fontSize="14px" fontWeight="600" mb={2}>
            {t('common:admin_user.voucher_list_title')}
          </Text>
          {wallet.vouchers.length === 0 ? (
            <Text fontSize="sm" color="myGray.500">
              {t('common:admin_user.voucher_empty')}
            </Text>
          ) : (
            <VStack spacing={2} align="stretch">
              {wallet.vouchers.map((voucher) => (
                <Box
                  key={voucher._id}
                  border="1px solid"
                  borderColor="myGray.200"
                  borderRadius="md"
                  px={3}
                  py={2}
                >
                  <Flex justify="space-between" align="center">
                    <HStack spacing={2}>
                      <Text fontSize="sm" fontWeight="600">
                        ¥{formatMoney(voucher.amount)}
                      </Text>
                      <Badge
                        colorScheme={voucher.source === VoucherSourceEnum.admin ? 'purple' : 'blue'}
                        variant="subtle"
                        px={2}
                        borderRadius="md"
                      >
                        {voucher.source === VoucherSourceEnum.admin
                          ? t('common:admin_user.voucher_source_admin')
                          : t('common:admin_user.voucher_source_register')}
                      </Badge>
                      {voucher.isLocked && (
                        <Badge colorScheme="orange" variant="subtle" px={2} borderRadius="md">
                          {t('common:admin_user.voucher_locked')}
                        </Badge>
                      )}
                    </HStack>
                    <Text fontSize="sm" color="myGray.600">
                      {t('common:admin_user.voucher_remaining', {
                        amount: formatMoney(voucher.remainingAmount)
                      })}
                    </Text>
                  </Flex>
                  {voucher.note && (
                    <Text fontSize="xs" color="myGray.500" mt={1}>
                      {voucher.note}
                    </Text>
                  )}
                  <Text fontSize="xs" color="myGray.400" mt={1}>
                    {formatDate(voucher.createTime)}
                  </Text>
                </Box>
              ))}
            </VStack>
          )}
        </Box>
      </VStack>
    );
  };

  const renderLogsContent = () => {
    if (walletLoading && !wallet) {
      return (
        <Flex justify="center" py={8}>
          <Spinner size="lg" />
        </Flex>
      );
    }
    if (!wallet) {
      return <Text color="myGray.500">{t('common:admin_user.wallet_load_failed')}</Text>;
    }
    if (wallet.logs.length === 0) {
      return (
        <Text fontSize="sm" color="myGray.500">
          {t('common:admin_user.logs_empty')}
        </Text>
      );
    }
    return (
      <VStack spacing={2} align="stretch">
        {wallet.logs.map(renderLogItem)}
      </VStack>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onCloseComplete={resetOnCloseComplete}
      size="2xl"
      isCentered
      scrollBehavior="inside"
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack spacing={2}>
            <Text>{t('common:admin_user.detail_title')}</Text>
            {detail && (
              <Text fontSize="sm" fontWeight="400" color="myGray.500">
                {detail.username}
              </Text>
            )}
          </HStack>
        </ModalHeader>
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

              <Tabs colorScheme="blue" isLazy>
                <TabList>
                  <Tab>{t('common:admin_user.tab_profile')}</Tab>
                  <Tab>{t('common:admin_user.tab_wallet')}</Tab>
                  <Tab>{t('common:admin_user.tab_logs')}</Tab>
                </TabList>

                <TabPanels>
                  {/* 资料 */}
                  <TabPanel px={0}>
                    <VStack spacing={4} align="stretch">
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
                        {formErrors.phone && (
                          <FormErrorMessage>{formErrors.phone}</FormErrorMessage>
                        )}
                      </FormControl>

                      <FormControl isInvalid={!!formErrors.email}>
                        <FormLabel fontSize="14px">{t('common:admin_user.email')}</FormLabel>
                        <Input
                          value={form.email}
                          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                          isDisabled={isRootUser}
                        />
                        {formErrors.email && (
                          <FormErrorMessage>{formErrors.email}</FormErrorMessage>
                        )}
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
                        <FormLabel fontSize="14px">
                          {t('common:admin_user.new_password')}
                        </FormLabel>
                        <Input
                          type="password"
                          value={form.newPassword}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, newPassword: e.target.value }))
                          }
                          placeholder={t('common:admin_user.password_placeholder')}
                          isDisabled={isRootUser}
                        />
                        {formErrors.newPassword && (
                          <FormErrorMessage>{formErrors.newPassword}</FormErrorMessage>
                        )}
                      </FormControl>

                      <FormControl isInvalid={!!formErrors.confirmPassword}>
                        <FormLabel fontSize="14px">
                          {t('common:admin_user.confirm_password')}
                        </FormLabel>
                        <Input
                          type="password"
                          value={form.confirmPassword}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, confirmPassword: e.target.value }))
                          }
                          placeholder={t('common:admin_user.confirm_password_placeholder')}
                          isDisabled={isRootUser}
                        />
                        {formErrors.confirmPassword && (
                          <FormErrorMessage>{formErrors.confirmPassword}</FormErrorMessage>
                        )}
                      </FormControl>

                      <Divider />

                      {!isRootUser && (
                        <Button colorScheme="blue" onClick={handleSave} isLoading={saving} mt={2}>
                          {t('common:admin_user.save')}
                        </Button>
                      )}
                    </VStack>
                  </TabPanel>

                  {/* Credits 与代金券 */}
                  <TabPanel px={0}>{renderWalletContent()}</TabPanel>

                  {/* 操作记录 */}
                  <TabPanel px={0}>{renderLogsContent()}</TabPanel>
                </TabPanels>
              </Tabs>
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
