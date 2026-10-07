'use client';
import React, { useCallback, useState } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import SearchInput from '@fastgpt/web/components/common/Input/SearchInput';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { postGetTicketList } from '@/web/support/ticket/api';
import type { TicketStatusEnum, TicketTypeEnum } from '@fastgpt/global/support/ticket/constants';
import type {
  TicketItemSchemaType,
  TicketListStatsType
} from '@fastgpt/global/openapi/support/ticket/api';
import AdminTicketListPane from './AdminTicketListPane';
import AdminTicketDetailPane from './AdminTicketDetailPane';
import {
  accountContentScrollStyles,
  accountPageRootStyles,
  accountTitleTextStyles
} from '@/pageComponents/account/styles';

enum AdminTicketViewEnum {
  list = 'list',
  detail = 'detail'
}

/** 工单管理（root）：概览统计 + 队列筛选搜索 + 详情处理，单页视图切换 */
const AdminTickets = () => {
  const { t } = useClientTranslation('ticket');

  const [view, setView] = useState<AdminTicketViewEnum>(AdminTicketViewEnum.list);
  const [activeTicketId, setActiveTicketId] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<TicketStatusEnum>();
  const [typeFilter, setTypeFilter] = useState<TicketTypeEnum>();
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const { data, loading, refresh } = useRequest(
    () =>
      postGetTicketList({
        status: statusFilter,
        type: typeFilter,
        search: appliedSearch || undefined,
        page: 1,
        pageSize: 50
      }),
    { manual: false, refreshDeps: [statusFilter, typeFilter, appliedSearch], errorToast: '' }
  );
  const list = data?.list ?? [];
  const stats: TicketListStatsType | undefined = data?.stats;

  const handleOpenDetail = useCallback((ticket: TicketItemSchemaType) => {
    setActiveTicketId(ticket._id);
    setView(AdminTicketViewEnum.detail);
  }, []);

  const handleBackToList = useCallback(() => {
    setActiveTicketId(undefined);
    setView(AdminTicketViewEnum.list);
    // 打开详情会清管理侧未读，返回时刷新列表与统计
    refresh();
  }, [refresh]);

  const statsItems = [
    { label: t('ticket:status.pending'), value: stats?.pending ?? 0 },
    { label: t('ticket:status.processing'), value: stats?.processing ?? 0 },
    { label: t('ticket:today_new'), value: stats?.todayNew ?? 0 },
    { label: t('ticket:unread_replies'), value: stats?.unreadReplies ?? 0 }
  ];

  return (
    <Flex {...accountPageRootStyles} flexDirection={'column'}>
      <Flex
        h={['56px', '64px']}
        flexShrink={0}
        px={[4, 6]}
        alignItems={'center'}
        gap={3}
        borderBottom={'1px solid'}
        borderColor={'myGray.200'}
      >
        <Box as={'h1'} {...accountTitleTextStyles}>
          {t('ticket:admin_title')}
        </Box>
        <Box flex={1} />
        <SearchInput
          w={['100%', '280px']}
          value={searchText}
          placeholder={t('ticket:search_placeholder')}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setAppliedSearch(searchText.trim())}
        />
      </Flex>

      <Box px={[4, 6]} pt={[4, 6]} pb={[4, 6]} {...accountContentScrollStyles}>
        {view === AdminTicketViewEnum.list && (
          <>
            {/* 概览统计行 */}
            <Flex gap={3} mb={4} flexWrap={'wrap'}>
              {statsItems.map((item) => (
                <Flex
                  key={item.label}
                  flex={'1 1 0'}
                  minW={'120px'}
                  px={4}
                  py={3}
                  borderRadius={'lg'}
                  bg={'myGray.50'}
                  flexDirection={'column'}
                  gap={1}
                >
                  <Box fontSize={'lg'} fontWeight={600} color={'myGray.900'}>
                    {item.value}
                  </Box>
                  <Box fontSize={'xs'} color={'myGray.500'}>
                    {item.label}
                  </Box>
                </Flex>
              ))}
            </Flex>

            <AdminTicketListPane
              list={list}
              loading={loading}
              statusFilter={statusFilter}
              typeFilter={typeFilter}
              onStatusChange={setStatusFilter}
              onTypeChange={setTypeFilter}
              onOpenDetail={handleOpenDetail}
            />
          </>
        )}
        {view === AdminTicketViewEnum.detail && activeTicketId && (
          <AdminTicketDetailPane
            ticketId={activeTicketId}
            onBack={handleBackToList}
            onUpdated={refresh}
          />
        )}
      </Box>
    </Flex>
  );
};

export default AdminTickets;
