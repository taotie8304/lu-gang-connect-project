'use client';
import React from 'react';
import { Box, Flex } from '@chakra-ui/react';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyBox from '@fastgpt/web/components/common/MyBox';
import EmptyTip from '@fastgpt/web/components/common/EmptyTip';
import FillRowTabs from '@fastgpt/web/components/common/Tabs/FillRowTabs';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import {
  TicketStatusEnum,
  ticketStatusMap,
  ticketTypeMap
} from '@fastgpt/global/support/ticket/constants';
import type { TicketItemSchemaType } from '@fastgpt/global/openapi/support/ticket/api';
import { formatTicketTime, ticketStatusColorMap } from '@/web/support/ticket/utils';

export const TicketStatusFilterAll = 'all';

const TicketListPane = ({
  list,
  loading,
  statusFilter,
  onStatusChange,
  onOpenDetail
}: {
  list: TicketItemSchemaType[];
  loading: boolean;
  statusFilter: TicketStatusEnum | undefined;
  onStatusChange: (status: TicketStatusEnum | undefined) => void;
  onOpenDetail: (ticket: TicketItemSchemaType) => void;
}) => {
  const { t } = useClientTranslation('ticket');

  const filterList = [
    { label: t('ticket:filter_all'), value: TicketStatusFilterAll },
    ...Object.values(TicketStatusEnum).map((status) => ({
      label: t(ticketStatusMap[status].label as any),
      value: status
    }))
  ];

  return (
    <Flex flexDirection={'column'} h={'100%'}>
      <FillRowTabs
        w={['100%', 'auto']}
        alignSelf={['stretch', 'flex-start']}
        size={'sm'}
        scrollPositionKey={'account-my-tickets-tabs'}
        list={filterList}
        value={statusFilter ?? TicketStatusFilterAll}
        onChange={(value) =>
          onStatusChange(value === TicketStatusFilterAll ? undefined : (value as TicketStatusEnum))
        }
      />

      <MyBox isLoading={loading} mt={4} flex={['0 0 auto', '1 0 0']} minH={0} overflowY={['visible', 'auto']}>
        {list.length === 0 && !loading ? (
          <EmptyTip text={t('ticket:empty_filtered')} />
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
                      <Box>{t(ticketTypeMap[item.type].label as any)}</Box>
                      <Box>{formatTicketTime(item.lastActiveTime, t)}</Box>
                    </Flex>
                  </Box>
                  <Flex alignItems={'center'} gap={2} ml={3}>
                    {item.userUnread > 0 && (
                      <Box
                        fontSize={'xs'}
                        color={'red.600'}
                        bg={'red.50'}
                        px={2}
                        py={1}
                        borderRadius={'full'}
                        whiteSpace={'nowrap'}
                      >
                        {t('ticket:new_reply', { count: item.userUnread })}
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

export default TicketListPane;
