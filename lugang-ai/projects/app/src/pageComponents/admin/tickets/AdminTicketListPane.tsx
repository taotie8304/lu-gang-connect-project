'use client';
import React from 'react';
import { Box, Flex, Select } from '@chakra-ui/react';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyBox from '@fastgpt/web/components/common/MyBox';
import EmptyTip from '@fastgpt/web/components/common/EmptyTip';
import FillRowTabs from '@fastgpt/web/components/common/Tabs/FillRowTabs';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import {
  TicketStatusEnum,
  TicketTypeEnum,
  ticketStatusMap,
  ticketTypeMap
} from '@fastgpt/global/support/ticket/constants';
import type { TicketItemSchemaType } from '@fastgpt/global/openapi/support/ticket/api';
import { formatTicketTime, ticketStatusColorMap } from '@/web/support/ticket/utils';

export const AdminTicketStatusFilterAll = 'all';
export const AdminTicketTypeFilterAll = 'all';

/** 管理侧工单队列：状态分段筛选 + 类型筛选 + 行卡片（未读角标随行显示） */
const AdminTicketListPane = ({
  list,
  loading,
  statusFilter,
  typeFilter,
  onStatusChange,
  onTypeChange,
  onOpenDetail
}: {
  list: TicketItemSchemaType[];
  loading: boolean;
  statusFilter: TicketStatusEnum | undefined;
  typeFilter: TicketTypeEnum | undefined;
  onStatusChange: (status: TicketStatusEnum | undefined) => void;
  onTypeChange: (type: TicketTypeEnum | undefined) => void;
  onOpenDetail: (ticket: TicketItemSchemaType) => void;
}) => {
  const { t } = useClientTranslation('ticket');

  const statusOptions = [
    { label: t('ticket:filter_all'), value: AdminTicketStatusFilterAll },
    ...Object.values(TicketStatusEnum).map((status) => ({
      label: t(ticketStatusMap[status].label as any),
      value: status
    }))
  ];

  return (
    <Flex flexDirection={'column'} h={'100%'}>
      <Flex alignItems={'center'} gap={3} flexWrap={'wrap'}>
        <FillRowTabs
          w={['100%', 'auto']}
          alignSelf={['stretch', 'flex-start']}
          size={'sm'}
          scrollPositionKey={'admin-tickets-status-tabs'}
          list={statusOptions}
          value={statusFilter ?? AdminTicketStatusFilterAll}
          onChange={(value) =>
            onStatusChange(
              value === AdminTicketStatusFilterAll ? undefined : (value as TicketStatusEnum)
            )
          }
        />
        <Select
          size={'sm'}
          w={'140px'}
          bg={'white'}
          borderRadius={'md'}
          value={typeFilter ?? AdminTicketTypeFilterAll}
          onChange={(e) =>
            onTypeChange(
              e.target.value === AdminTicketTypeFilterAll
                ? undefined
                : (e.target.value as TicketTypeEnum)
            )
          }
        >
          <option value={AdminTicketTypeFilterAll}>{t('ticket:filter_all')}</option>
          {Object.values(TicketTypeEnum).map((type) => (
            <option key={type} value={type}>
              {t(ticketTypeMap[type].label as any)}
            </option>
          ))}
        </Select>
      </Flex>

      <MyBox isLoading={loading} mt={4} flex={['0 0 auto', '1 0 0']} minH={0} overflowY={['visible', 'auto']}>
        {list.length === 0 && !loading ? (
          <EmptyTip text={t('ticket:empty_queue')} />
        ) : (
          <Flex flexDirection={'column'} gap={3} pb={4}>
            {list.map((item) => {
              const statusColor = ticketStatusColorMap[item.status];
              return (
                <Flex
                  key={item._id}
                  cursor={'pointer'}
                  px={4}
                  py={3.5}
                  borderRadius={'xl'}
                  border={'1px solid'}
                  borderColor={'myGray.200'}
                  bg={'white'}
                  _hover={{ borderColor: 'primary.300', boxShadow: '1px 1px 4px rgba(51,112,255,0.08)' }}
                  onClick={() => onOpenDetail(item)}
                >
                  <Box flex={1} minW={0}>
                    <Flex alignItems={'center'} gap={2}>
                      <Box
                        px={2}
                        py={0.5}
                        borderRadius={'md'}
                        fontSize={'xs'}
                        bg={statusColor.bg}
                        color={statusColor.color}
                      >
                        {t(ticketStatusMap[item.status].label as any)}
                      </Box>
                      <Box fontSize={'xs'} color={'myGray.500'}>
                        {item.ticketNo}
                      </Box>
                      <Box fontSize={'xs'} color={'myGray.500'}>
                        {t(ticketTypeMap[item.type].label as any)}
                      </Box>
                    </Flex>
                    <Box
                      mt={2}
                      fontSize={'sm'}
                      fontWeight={500}
                      color={'myGray.900'}
                      noOfLines={1}
                    >
                      {item.title}
                    </Box>
                    <Flex mt={1.5} fontSize={'xs'} color={'myGray.500'} gap={3}>
                      <Box>{item.userSnapshot.email || item.userSnapshot.name}</Box>
                      <Box>{formatTicketTime(item.lastActiveTime, t)}</Box>
                    </Flex>
                  </Box>
                  <Flex alignItems={'center'} gap={2} ml={3}>
                    {item.adminUnread > 0 && (
                      <Box
                        fontSize={'xs'}
                        color={'white'}
                        bg={'red.500'}
                        minW={'18px'}
                        h={'18px'}
                        px={'5px'}
                        borderRadius={'full'}
                        display={'flex'}
                        alignItems={'center'}
                        justifyContent={'center'}
                        lineHeight={1}
                      >
                        {item.adminUnread > 99 ? '99+' : item.adminUnread}
                      </Box>
                    )}
                    <MyIcon name={'common/rightArrowLight'} w={'16px'} color={'myGray.400'} />
                  </Flex>
                </Flex>
              );
            })}
          </Flex>
        )}
      </MyBox>
    </Flex>
  );
};

export default AdminTicketListPane;
