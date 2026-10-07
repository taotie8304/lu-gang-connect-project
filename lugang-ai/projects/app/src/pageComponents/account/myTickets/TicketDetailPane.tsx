'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Flex, Textarea } from '@chakra-ui/react';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyBox from '@fastgpt/web/components/common/MyBox';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import { getTicketDetail, postReplyTicket, postUpdateTicketStatus } from '@/web/support/ticket/api';
import {
  TicketRoleEnum,
  TicketStatusEnum,
  ticketStatusMap,
  ticketTypeMap
} from '@fastgpt/global/support/ticket/constants';
import { formatTicketTime, ticketStatusColorMap } from '@/web/support/ticket/utils';

/** 工单详情：对话流 + 补充回复 + 关闭工单（打开即清未读，由服务端处理） */
const TicketDetailPane = ({
  ticketId,
  newReplyCount,
  onBack,
  onUpdated
}: {
  ticketId: string;
  newReplyCount: number;
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
  const messages = useMemo(() => data?.messages ?? [], [data?.messages]);

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

  const { run: closeTicket, loading: closing } = useRequest(
    async () => postUpdateTicketStatus({ ticketId, status: TicketStatusEnum.closed }),
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

  // 新回复分隔线：用户最后一条消息之后的客服消息即未读部分
  const dividerIndex = useMemo(() => {
    if (newReplyCount <= 0 || messages.length === 0) return -1;
    let lastUserIndex = -1;
    messages.forEach((message, index) => {
      if (message.role === TicketRoleEnum.user) lastUserIndex = index;
    });
    const index = lastUserIndex + 1;
    return index < messages.length ? index : -1;
  }, [messages, newReplyCount]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const statusColor = ticket ? ticketStatusColorMap[ticket.status] : undefined;

  return (
    <Flex flexDirection={'column'} h={'100%'} minH={0}>
      {/* 头部：返回 + 单号 + 状态 + 关闭入口 */}
      <Flex alignItems={'center'} gap={2} pb={3} borderBottom={'1px solid'} borderColor={'myGray.150'}>
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
        {ticket?.status === TicketStatusEnum.resolved && (
          <Button
            size={'sm'}
            variant={'whiteBase'}
            isLoading={closing}
            onClick={() => openConfirm({ onConfirm: () => closeTicket() })()}
          >
            {t('ticket:close_ticket')}
          </Button>
        )}
      </Flex>

      <Flex mt={2} alignItems={'center'} gap={3} fontSize={'xs'} color={'myGray.500'} flexWrap={'wrap'}>
        {ticket && (
          <>
            <Box>
              {t('ticket:ticket_no')}: {ticket.ticketNo}
            </Box>
            <Box>{t(ticketTypeMap[ticket.type].label as any)}</Box>
            <Box>
              {t('ticket:submitted_at')}: {formatTicketTime(ticket.createTime, t)}
            </Box>
          </>
        )}
      </Flex>

      {/* 对话流 */}
      <MyBox isLoading={loading} flex={['0 0 auto', '1 0 0']} minH={0} overflowY={['visible', 'auto']} mt={3}>
        <Flex flexDirection={'column'} gap={4} pb={4} pr={[0, 2]}>
          {messages.map((message, index) => {
            const isMine = message.role === TicketRoleEnum.user;
            return (
              <React.Fragment key={message._id}>
                {index === dividerIndex && (
                  <Flex alignItems={'center'} gap={3}>
                    <Box flex={1} h={'1px'} bg={'red.200'} />
                    <Box fontSize={'xs'} color={'red.600'}>
                      {t('ticket:new_reply', { count: newReplyCount })}
                    </Box>
                    <Box flex={1} h={'1px'} bg={'red.200'} />
                  </Flex>
                )}
                <Flex justifyContent={isMine ? 'flex-end' : 'flex-start'}>
                  <Box maxW={['85%', '75%']}>
                    <Flex
                      fontSize={'xs'}
                      color={'myGray.500'}
                      mb={1}
                      gap={2}
                      justifyContent={isMine ? 'flex-end' : 'flex-start'}
                    >
                      <Box>{isMine ? t('ticket:role_me') : t('ticket:role_admin')}</Box>
                      <Box>{formatTicketTime(message.createTime, t)}</Box>
                    </Flex>
                    <Box
                      px={4}
                      py={2.5}
                      borderRadius={'xl'}
                      bg={isMine ? '#EAF1FF' : 'white'}
                      border={'1px solid'}
                      borderColor={isMine ? '#EAF1FF' : 'myGray.200'}
                      fontSize={'sm'}
                      color={'myGray.900'}
                      whiteSpace={'pre-wrap'}
                      wordBreak={'break-word'}
                    >
                      {message.content}
                    </Box>
                  </Box>
                </Flex>
              </React.Fragment>
            );
          })}
          <Box ref={bottomRef} />
        </Flex>
      </MyBox>

      {/* 回复区 */}
      <Box pt={3} borderTop={'1px solid'} borderColor={'myGray.150'}>
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

export default TicketDetailPane;
