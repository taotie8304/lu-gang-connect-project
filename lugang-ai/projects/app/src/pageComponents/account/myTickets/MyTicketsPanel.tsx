'use client';
import React, { useCallback, useRef, useState } from 'react';
import { Box, Button, Flex } from '@chakra-ui/react';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { postGetTicketList } from '@/web/support/ticket/api';
import type { TicketStatusEnum } from '@fastgpt/global/support/ticket/constants';
import type { TicketItemSchemaType } from '@fastgpt/global/openapi/support/ticket/api';
import TicketListPane from './TicketListPane';
import TicketCreatePane from './TicketCreatePane';
import TicketDetailPane from './TicketDetailPane';
import {
  accountContentFlowStyles,
  accountContentScrollStyles,
  accountPageFlowRootStyles,
  accountPageRootStyles,
  accountTitleTextStyles
} from '../styles';
import { useAccountFlow } from '../AccountFlowContext';

enum MyTicketViewEnum {
  list = 'list',
  create = 'create',
  detail = 'detail'
}

/** 我的工单：列表 / 提交 / 详情三视图单页切换。账号页与客户端设置弹窗共用，弹窗态多一个「关闭」。 */
const MyTicketsPanel = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useClientTranslation('ticket');
  const isFlow = useAccountFlow();

  const [view, setView] = useState<MyTicketViewEnum>(MyTicketViewEnum.list);
  const [statusFilter, setStatusFilter] = useState<TicketStatusEnum>();
  const [activeTicket, setActiveTicket] = useState<{ id: string; unread: number }>();

  // 首次使用（无任何历史工单）自动展开提交表单，仅首次加载判定一次
  const autoOpenedRef = useRef(false);
  const { data, loading, refresh } = useRequest(
    () => postGetTicketList({ status: statusFilter, page: 1, pageSize: 50 }),
    {
      manual: false,
      refreshDeps: [statusFilter],
      errorToast: '',
      onSuccess: (res) => {
        if (autoOpenedRef.current) return;
        autoOpenedRef.current = true;
        if (res.total === 0 && !statusFilter) {
          setView(MyTicketViewEnum.create);
        }
      }
    }
  );
  const list = data?.list ?? [];

  const handleCreated = useCallback(
    (ticketId: string) => {
      refresh();
      setActiveTicket({ id: ticketId, unread: 0 });
      setView(MyTicketViewEnum.detail);
    },
    [refresh]
  );

  const handleOpenDetail = useCallback((ticket: TicketItemSchemaType) => {
    setActiveTicket({ id: ticket._id, unread: ticket.userUnread });
    setView(MyTicketViewEnum.detail);
  }, []);

  const handleBackToList = useCallback(() => {
    setActiveTicket(undefined);
    setView(MyTicketViewEnum.list);
    // 打开详情会清空未读，返回时刷新列表徽标
    refresh();
  }, [refresh]);

  return (
    <Flex
      {...(isFlow ? accountPageFlowRootStyles : accountPageRootStyles)}
      flexDirection={'column'}
    >
      <Flex
        h={['56px', '64px']}
        flexShrink={0}
        px={[4, 6]}
        alignItems={'center'}
        borderBottom={'1px solid'}
        borderColor={'myGray.200'}
        position={'sticky'}
        top={0}
        bg={'white'}
        zIndex={1}
      >
        <Box as={'h1'} {...accountTitleTextStyles}>
          {t('ticket:my_tickets')}
        </Box>
        <Box flex={1} />
        {view === MyTicketViewEnum.list && (
          <Button variant={'primary'} size={'sm'} onClick={() => setView(MyTicketViewEnum.create)}>
            {t('ticket:submit_ticket')}
          </Button>
        )}
        {onClose && (
          <Button ml={2} variant={'whitePrimaryOutline'} size={'sm'} onClick={onClose}>
            {t('common:Close')}
          </Button>
        )}
      </Flex>

      <Box
        px={[4, 6]}
        pt={[4, 6]}
        pb={[4, 6]}
        {...(isFlow ? accountContentFlowStyles : accountContentScrollStyles)}
      >
        {view === MyTicketViewEnum.list && (
          <TicketListPane
            list={list}
            loading={loading}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            onOpenDetail={handleOpenDetail}
          />
        )}
        {view === MyTicketViewEnum.create && (
          <TicketCreatePane
            onCreated={handleCreated}
            onCancel={() => setView(MyTicketViewEnum.list)}
          />
        )}
        {view === MyTicketViewEnum.detail && activeTicket && (
          <TicketDetailPane
            ticketId={activeTicket.id}
            newReplyCount={activeTicket.unread}
            onBack={handleBackToList}
            onUpdated={refresh}
          />
        )}
      </Box>
    </Flex>
  );
};

export default MyTicketsPanel;
