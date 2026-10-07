'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Flex, Textarea } from '@chakra-ui/react';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyBox from '@fastgpt/web/components/common/MyBox';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import {
  getTicketDetail,
  postReplyTicket,
  postUpdateTicketStatus
} from '@/web/support/ticket/api';
import {
  TicketRoleEnum,
  TicketStatusEnum,
  ticketStatusMap,
  ticketTypeMap
} from '@fastgpt/global/support/ticket/constants';
import { formatTicketTime, ticketStatusColorMap } from '@/web/support/ticket/utils';

/** 管理侧工单详情：提交人信息条 + 对话流（用户左/客服右）+ 常用回复 + 状态操作 */
const AdminTicketDetailPane = ({
  ticketId,
  onBack,
  onUpdated
}: {
  ticketId: string;
  onBack: () => void;
  onUpdated: () => void;
}) => {
  const { t } = useClientTranslation('ticket');

  const { data, loading, refresh } = useRequest(() => getTicketDetail(ticketId), {
    manual: false,
    refreshDeps: [ticketId],
    errorToast: ''
  });
  const ticket = data?.ticket;
  const messages = data?.messages ?? [];

  const [replyContent, setReplyContent] = useState('');
  const { run: sendReply, loading: replying } = useRequest(
    async () => postReplyTicket({ ticketId, content: replyContent.trim() }),
    {
      onSuccess: () => {
        setReplyContent('');
        refresh();
        onUpdated();
      },
      successToast: t('ticket:reply_success'),
      errorToast: ''
    }
  );

  const { run: updateStatus, loading: updatingStatus } = useRequest(
    async (status: TicketStatusEnum) => postUpdateTicketStatus({ ticketId, status }),
    {
      onSuccess: () => {
        refresh();
        onUpdated();
      },
      errorToast: ''
    }
  );

  const { openConfirm, ConfirmModal } = useConfirm({
    content: t('ticket:close_ticket_confirm')
  });

  // 操作按钮随状态变化：处理中/待处理可标记已解决；已解决/已关闭可重新打开；未关闭均可关闭
  const canResolve =
    ticket?.status === TicketStatusEnum.pending || ticket?.status === TicketStatusEnum.processing;
  const canReopen =
    ticket?.status === TicketStatusEnum.resolved || ticket?.status === TicketStatusEnum.closed;
  const canClose = !!ticket && ticket.status !== TicketStatusEnum.closed;

  // 常用回复短语：点击追加到回复框（已有内容则换行追加）
  const quickReplies = useMemo(
    () => [
      t('ticket:quick_reply_received'),
      t('ticket:quick_reply_need_info'),
      t('ticket:quick_reply_resolved')
    ],
    [t]
  );
  const appendQuickReply = (text: string) => {
    setReplyContent((prev) => (prev ? `${prev}\n${text}` : text));
  };

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const statusColor = ticket ? ticketStatusColorMap[ticket.status] : undefined;

  return (
    <Flex flexDirection={'column'} h={'100%'} minH={0}>
      {/* 头部：返回 + 标题 + 状态 + 状态操作 */}
      <Flex
        alignItems={'center'}
        gap={2}
        pb={3}
        flexWrap={'wrap'}
        borderBottom={'1px solid'}
        borderColor={'myGray.150'}
      >
        <Flex
          cursor={'pointer'}
          alignItems={'center'}
          color={'myGray.600'}
          _hover={{ color: 'primary.600' }}
          onClick={onBack}
          flexShrink={0}
        >
          <MyIcon name={'common/arrowLeft'} w={'18px'} />
        </Flex>
        <Flex alignItems={'center'} gap={2} flex={1} minW={0}>
          <Box fontSize={'sm'} fontWeight={500} color={'myGray.900'} noOfLines={1}>
            {ticket?.title ?? ''}
          </Box>
          {ticket && (
            <Box
              px={2}
              py={0.5}
              borderRadius={'md'}
              fontSize={'xs'}
              flexShrink={0}
              bg={statusColor!.bg}
              color={statusColor!.color}
            >
              {t(ticketStatusMap[ticket.status].label as any)}
            </Box>
          )}
        </Flex>
        <Flex alignItems={'center'} gap={2} flexShrink={0}>
          {canResolve && (
            <Button
              size={'sm'}
              variant={'primary'}
              isLoading={updatingStatus}
              onClick={() => updateStatus(TicketStatusEnum.resolved)}
            >
              {t('ticket:mark_resolved')}
            </Button>
          )}
          {canReopen && (
            <Button
              size={'sm'}
              variant={'whiteBase'}
              isLoading={updatingStatus}
              onClick={() => updateStatus(TicketStatusEnum.processing)}
            >
              {t('ticket:reopen')}
            </Button>
          )}
          {canClose && (
            <Button
              size={'sm'}
              variant={'whiteBase'}
              isLoading={updatingStatus}
              onClick={() => openConfirm({ onConfirm: () => updateStatus(TicketStatusEnum.closed) })()}
            >
              {t('ticket:mark_closed')}
            </Button>
          )}
        </Flex>
      </Flex>

      {/* 提交人信息条 */}
      {ticket && (
        <Flex
          mt={3}
          px={3}
          py={2}
          borderRadius={'lg'}
          bg={'myGray.50'}
          alignItems={'center'}
          gap={3}
          fontSize={'xs'}
          color={'myGray.600'}
          flexWrap={'wrap'}
        >
          <Box>
            {t('ticket:submitter')}: <Box as={'span'} fontWeight={500} color={'myGray.900'}>{ticket.userSnapshot.name}</Box>
            {ticket.userSnapshot.email ? ` (${ticket.userSnapshot.email})` : ''}
          </Box>
          <Box>
            {t('ticket:ticket_no')}: {ticket.ticketNo}
          </Box>
          <Box>{t(ticketTypeMap[ticket.type].label as any)}</Box>
          <Box>
            {t('ticket:submitted_at')}: {formatTicketTime(ticket.createTime, t)}
          </Box>
        </Flex>
      )}

      {/* 对话流（管理侧视角：用户左、客服右） */}
      <MyBox isLoading={loading} flex={['0 0 auto', '1 0 0']} minH={0} overflowY={['visible', 'auto']} mt={3}>
        <Flex flexDirection={'column'} gap={4} pb={4} pr={[0, 2]}>
          {messages.map((message) => {
            const isAdminMsg = message.role === TicketRoleEnum.admin;
            return (
              <Flex key={message._id} justifyContent={isAdminMsg ? 'flex-end' : 'flex-start'}>
                <Box maxW={['85%', '75%']}>
                  <Flex
                    fontSize={'xs'}
                    color={'myGray.500'}
                    mb={1}
                    gap={2}
                    justifyContent={isAdminMsg ? 'flex-end' : 'flex-start'}
                  >
                    <Box>{isAdminMsg ? t('ticket:role_admin') : message.name}</Box>
                    <Box>{formatTicketTime(message.createTime, t)}</Box>
                  </Flex>
                  <Box
                    px={4}
                    py={2.5}
                    borderRadius={'xl'}
                    bg={isAdminMsg ? '#EAF1FF' : 'white'}
                    border={'1px solid'}
                    borderColor={isAdminMsg ? '#EAF1FF' : 'myGray.200'}
                    fontSize={'sm'}
                    color={'myGray.900'}
                    whiteSpace={'pre-wrap'}
                    wordBreak={'break-word'}
                  >
                    {message.content}
                  </Box>
                </Box>
              </Flex>
            );
          })}
          <Box ref={bottomRef} />
        </Flex>
      </MyBox>

      {/* 常用回复 + 回复区 */}
      <Box pt={3} borderTop={'1px solid'} borderColor={'myGray.150'}>
        <Flex alignItems={'center'} gap={2} mb={2} flexWrap={'wrap'}>
          <Box fontSize={'xs'} color={'myGray.500'} flexShrink={0}>
            {t('ticket:quick_replies')}
          </Box>
          {quickReplies.map((text) => (
            <Box
              key={text}
              cursor={'pointer'}
              px={2}
              py={1}
              borderRadius={'md'}
              fontSize={'xs'}
              bg={'myGray.100'}
              color={'myGray.700'}
              _hover={{ bg: 'primary.50', color: 'primary.600' }}
              onClick={() => appendQuickReply(text)}
            >
              {text}
            </Box>
          ))}
        </Flex>
        <Textarea
          bg={'white'}
          minH={'90px'}
          value={replyContent}
          maxLength={3000}
          placeholder={t('ticket:reply_placeholder')}
          onChange={(e) => setReplyContent(e.target.value)}
        />
        <Flex mt={2} justifyContent={'flex-end'}>
          <Button
            variant={'primary'}
            size={'sm'}
            px={6}
            isDisabled={replyContent.trim().length < 5}
            isLoading={replying}
            onClick={() => sendReply()}
          >
            {t('ticket:reply')}
          </Button>
        </Flex>
      </Box>

      <ConfirmModal />
    </Flex>
  );
};

export default AdminTicketDetailPane;
