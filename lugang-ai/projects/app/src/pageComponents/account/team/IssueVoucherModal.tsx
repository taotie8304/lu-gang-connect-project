// 鲁港通 - 代金券发放弹窗（Credits 改革批 3）：管理员批量发放（多选成员）/ 单成员发放（含持券列表）
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import MyModal from '@fastgpt/web/components/v2/common/MyModal';
import { Box, Button, Checkbox, Flex, Input, VStack } from '@chakra-ui/react';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import MyIcon from '@fastgpt/web/components/common/Icon';
import Avatar from '@fastgpt/web/components/common/Avatar';
import SearchInput from '@fastgpt/web/components/common/Input/SearchInput';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { format } from 'date-fns/format';
import { getTeamMembers } from '@/web/support/user/team/api';
import { getMemberVouchers, postIssueVouchers } from '@/web/support/wallet/voucher/api';
import type { TeamMemberItemType } from '@fastgpt/global/support/user/team/type';

type MemberBrief = { tmbId: string; memberName: string };

const IssueVoucherModal = ({
  onClose,
  member
}: {
  onClose: () => void;
  /** 行内入口传入时为单成员模式：展示其持券列表并默认选中该成员 */
  member?: MemberBrief;
}) => {
  const { t } = useClientTranslation(['account_team']);
  const { toast } = useToast();

  const isSingle = !!member;
  const [selected, setSelected] = useState<Map<string, MemberBrief>>(
    () => new Map(member ? [[member.tmbId, member]] : [])
  );
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  /* 批量模式：搜索在职团队成员（空关键词列出前 50 名） */
  const {
    runAsync: searchMembers,
    data: memberList,
    loading: isSearching
  } = useRequest(
    (key: string) => getTeamMembers({ offset: 0, pageSize: 50, status: 'active', searchKey: key }),
    { manual: true, throttleWait: 400 }
  );

  useEffect(() => {
    if (!isSingle) void searchMembers('');
  }, [isSingle, searchMembers]);

  /* 单成员模式：拉取该成员持券列表 */
  const {
    data: holdings,
    loading: isLoadingHoldings,
    runAsync: refreshHoldings
  } = useRequest(() => getMemberVouchers(member!.tmbId), {
    manual: !isSingle,
    refreshDeps: [member?.tmbId]
  });

  const toggleMember = useCallback((item: MemberBrief) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.tmbId)) {
        next.delete(item.tmbId);
      } else {
        next.set(item.tmbId, item);
      }
      return next;
    });
  }, []);

  const amountYuan = useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : NaN;
  }, [amount]);

  const { loading: isIssuing, runAsync: onIssue } = useRequest(postIssueVouchers, {
    onSuccess: ({ count }) => {
      toast({
        status: 'success',
        title: t('account_team:issue_voucher_success', { count })
      });
      if (isSingle) {
        setAmount('');
        setNote('');
        void refreshHoldings();
      } else {
        onClose();
      }
    }
  });

  const handleConfirm = () => {
    if (selected.size === 0) {
      toast({ status: 'warning', title: t('account_team:issue_voucher_no_member') });
      return;
    }
    if (!(amountYuan > 0) || amount.includes('e')) {
      toast({ status: 'warning', title: t('account_team:issue_voucher_amount_invalid') });
      return;
    }
    void onIssue({
      tmbIds: [...selected.keys()],
      amountYuan,
      ...(note.trim() ? { note: note.trim() } : {})
    });
  };

  const renderHolding = (voucher: {
    _id: string;
    amount: number;
    remainingAmount: number;
    source: string;
    note: string;
    isLocked: boolean;
    createTime: Date;
  }) => (
    <Flex
      key={voucher._id}
      px={4}
      py={2.5}
      alignItems={'center'}
      gap={3}
      borderWidth={'1px'}
      borderColor={'myGray.200'}
      borderRadius={'md'}
      bg={'white'}
    >
      <MyIcon name={'support/account/coupon'} w={'18px'} />
      <Box flex={1} minW={0}>
        <Flex alignItems={'baseline'} gap={2}>
          <Box fontSize={'16px'} fontWeight={'600'} color={'primary.600'}>
            ¥{voucher.remainingAmount.toFixed(2)}
          </Box>
          <Box fontSize={'11px'} color={'myGray.500'}>
            {t('account_team:issue_voucher_face_value', { amount: voucher.amount.toFixed(2) })}
          </Box>
          {voucher.isLocked && (
            <Box fontSize={'11px'} color={'orange.600'}>
              · {t('account_team:issue_voucher_locked')}
            </Box>
          )}
        </Flex>
        <Flex fontSize={'11px'} color={'myGray.500'} mt={0.5} gap={2}>
          {voucher.note && <Box className={'textEllipsis'}>{voucher.note}</Box>}
          <Box flexShrink={0}>{format(new Date(voucher.createTime), 'yyyy-MM-dd')}</Box>
        </Flex>
      </Box>
    </Flex>
  );

  return (
    <MyModal
      isOpen
      title={t('account_team:issue_voucher_title')}
      w={isSingle ? '560px' : '620px'}
      onClose={onClose}
      closeOnOverlayClick={false}
      bodyStyles={{ px: 6, pb: 6 }}
    >
      {isSingle ? (
        <Flex alignItems={'center'} gap={2} mb={4} px={3} py={2} bg={'myGray.50'} borderRadius={'md'}>
          <Avatar src={undefined} w={'24px'} borderRadius={'50%'} />
          <Box fontSize={'14px'} fontWeight={'500'} color={'myGray.800'}>
            {member!.memberName}
          </Box>
          <Box fontSize={'12px'} color={'myGray.500'}>
            {t('account_team:issue_voucher_single_tip')}
          </Box>
        </Flex>
      ) : (
        <Box mb={4}>
          <Box fontSize={'13px'} fontWeight={'500'} color={'myGray.700'} mb={2}>
            {t('account_team:issue_voucher_member_label')}
          </Box>
          <SearchInput
            bg={'white'}
            placeholder={t('account_team:search_member')}
            onChange={(e) => {
              void searchMembers(e.target.value);
            }}
          />
          <Box
            mt={2}
            borderWidth={'1px'}
            borderColor={'myGray.200'}
            borderRadius={'md'}
            maxH={'200px'}
            overflowY={'auto'}
          >
            {isSearching && (
              <Flex justifyContent={'center'} py={4}>
                <MyIcon name={'common/loading'} w={'16px'} />
              </Flex>
            )}
            {!isSearching && (memberList?.list?.length ?? 0) === 0 && (
              <Flex justifyContent={'center'} py={4} fontSize={'12px'} color={'myGray.500'}>
                {t('account_team:issue_voucher_no_result')}
              </Flex>
            )}
            {!isSearching &&
              memberList?.list?.map((item: TeamMemberItemType) => {
                const isChecked = selected.has(item.tmbId);
                return (
                  <Flex
                    key={item.tmbId}
                    px={3}
                    py={2}
                    alignItems={'center'}
                    gap={3}
                    cursor={'pointer'}
                    _hover={{ bg: 'myGray.50' }}
                    onClick={() => toggleMember({ tmbId: item.tmbId, memberName: item.memberName })}
                  >
                    <Checkbox isChecked={isChecked} pointerEvents={'none'} />
                    <Avatar src={item.avatar} w={'20px'} borderRadius={'50%'} />
                    <Box fontSize={'13px'} color={'myGray.800'} className={'textEllipsis'}>
                      {item.memberName}
                    </Box>
                    <Box fontSize={'11px'} color={'myGray.500'} className={'textEllipsis'}>
                      {item.contact || ''}
                    </Box>
                  </Flex>
                );
              })}
          </Box>
          <Box mt={1.5} fontSize={'12px'} color={'myGray.500'}>
            {t('account_team:issue_voucher_selected', { count: selected.size })}
          </Box>
        </Box>
      )}

      <Flex gap={3} mb={4}>
        <Box flex={1}>
          <Box fontSize={'13px'} fontWeight={'500'} color={'myGray.700'} mb={2}>
            {t('account_team:issue_voucher_amount_label')}
          </Box>
          <Input
            bg={'white'}
            inputMode={'decimal'}
            placeholder={t('account_team:issue_voucher_amount_placeholder')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Box>
        <Box flex={1}>
          <Box fontSize={'13px'} fontWeight={'500'} color={'myGray.700'} mb={2}>
            {t('account_team:issue_voucher_note_label')}
          </Box>
          <Input
            bg={'white'}
            maxLength={60}
            placeholder={t('account_team:issue_voucher_note_placeholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Box>
      </Flex>

      {isSingle && (
        <Box>
          <Box fontSize={'13px'} fontWeight={'500'} color={'myGray.700'} mb={2}>
            {t('account_team:issue_voucher_holdings_title')}
          </Box>
          <VStack align={'stretch'} spacing={2} maxH={'180px'} overflowY={'auto'}>
            {isLoadingHoldings && (
              <Flex justifyContent={'center'} py={2}>
                <MyIcon name={'common/loading'} w={'16px'} />
              </Flex>
            )}
            {!isLoadingHoldings && (holdings?.length ?? 0) === 0 && (
              <Box fontSize={'12px'} color={'myGray.500'} textAlign={'center'} py={2}>
                {t('account_team:issue_voucher_none')}
              </Box>
            )}
            {!isLoadingHoldings && holdings?.map((voucher) => renderHolding(voucher))}
          </VStack>
        </Box>
      )}

      <Flex mt={6} justifyContent={'flex-end'} gap={3}>
        <Button variant={'whiteBase'} onClick={onClose}>
          {t('common:Cancel')}
        </Button>
        <Button variant={'primary'} isLoading={isIssuing} onClick={handleConfirm}>
          {t('account_team:issue_voucher_confirm')}
        </Button>
      </Flex>
    </MyModal>
  );
};

export default React.memo(IssueVoucherModal);
