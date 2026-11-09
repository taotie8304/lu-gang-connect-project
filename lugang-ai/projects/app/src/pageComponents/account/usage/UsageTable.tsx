import {
  Box,
  Button,
  Flex,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr
} from '@chakra-ui/react';
import { formatNumber } from '@fastgpt/global/common/math/tools';
import { UsageSourceMap } from '@fastgpt/global/support/wallet/usage/constants';
import { type UsageListItemType } from '@fastgpt/global/support/wallet/usage/type';
import EmptyTip from '@fastgpt/web/components/common/EmptyTip';
import MyBox from '@fastgpt/web/components/common/MyBox';
import dayjs from 'dayjs';
import React, { useMemo, useRef, useState } from 'react';
import Avatar from '@fastgpt/web/components/common/Avatar';
import { usePagination } from '@fastgpt/web/hooks/usePagination';
import { getUserUsages } from '@/web/support/wallet/usage/api';
import dynamic from 'next/dynamic';
import { type UsageFilterParams } from './type';
import PopoverConfirm from '@fastgpt/web/components/common/MyPopover/PopoverConfirm';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { downloadFetch } from '@/web/common/system/utils';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { i18nT } from '@fastgpt/global/common/i18n/utils';
import {
  accountContentFlowStyles,
  accountContentScrollStyles,
  accountPageFlowRootStyles,
  accountPageRootStyles
} from '@/pageComponents/account/styles';
import { useAccountFlow } from '@/pageComponents/account/AccountFlowContext';
import { useSystem } from '@fastgpt/web/hooks/useSystem';

const UsageDetail = dynamic(() => import('./UsageDetail'));

const UsageTableList = ({
  filterParams,
  Tabs,
  Selectors
}: {
  Tabs: React.ReactNode;
  Selectors: React.ReactNode;
  filterParams: UsageFilterParams;
}) => {
  const { t } = useClientTranslation('account_usage');
  const { isPc } = useSystem();
  const isFlow = useAccountFlow();

  const { dateRange, selectTmbIds, isSelectAllTmb, usageSources, isSelectAllSource, projectName } =
    filterParams;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const requestParams = useMemo(() => {
    return {
      dateStart: dayjs(dateRange.from || new Date()).format(),
      dateEnd: dayjs(dateRange.to || new Date()).format(),
      sources: isSelectAllSource ? undefined : usageSources,
      teamMemberIds: isSelectAllTmb ? undefined : selectTmbIds,
      projectName
    };
  }, [
    dateRange.from,
    dateRange.to,
    isSelectAllSource,
    isSelectAllTmb,
    projectName,
    selectTmbIds,
    usageSources
  ]);

  const {
    data: usages,
    isLoading,
    Pagination,
    total
  } = usePagination(getUserUsages, {
    defaultPageSize: 20,
    pageSizeOptions: [20, 50, 100, 200],
    pageSizeCacheKey: 'account-usage-detail',
    params: requestParams,
    refreshDeps: [requestParams],
    scrollContainerRef
  });

  const [usageDetail, setUsageDetail] = useState<UsageListItemType>();

  const { runAsync: exportUsage } = useRequest(
    async () => {
      await downloadFetch({
        url: `/api/proApi/support/wallet/usage/exportUsage`,
        filename: `usage.csv`,
        body: {
          ...requestParams,
          appNameMap: {
            ['core.app.Question Guide']: t('common:core.app.Question Guide'),
            [i18nT('common:support.wallet.usage.Audio Speech')]: t(
              'common:support.wallet.usage.Audio Speech'
            ),
            ['support.wallet.usage.Whisper']: t('common:support.wallet.usage.Whisper'),
            [i18nT('account_usage:embedding_index')]: t('account_usage:embedding_index'),
            [i18nT('account_usage:qa')]: t('account_usage:qa'),
            ['core.dataset.training.Auto mode']: t('common:core.dataset.training.Auto mode'),
            [i18nT('common:core.module.template.ai_chat')]: t('common:core.module.template.ai_chat')
          },
          sourcesMap: Object.fromEntries(
            Object.entries(UsageSourceMap).map(([key, config]) => [
              key,
              {
                label: t(config.label as any)
              }
            ])
          ),
          title: t('account_usage:export_title')
        }
      });
    },
    {
      refreshDeps: [requestParams]
    }
  );

  return (
    <MyBox
      {...(isFlow ? accountPageFlowRootStyles : accountPageRootStyles)}
      display={'flex'}
      flexDirection={'column'}
      isLoading={isLoading}
    >
      <Flex
        px={[3, 6]}
        w={'100%'}
        flexDirection={['column', 'row']}
        flexWrap={['nowrap', 'wrap']}
        alignItems={['stretch', 'center']}
        justifyContent={'space-between'}
        gap={[4, 6]}
      >
        <Box flexShrink={0}>{Tabs}</Box>
        <Flex
          flex={['0 0 auto', '1 1 auto']}
          minW={['0', 'min-content']}
          flexWrap={'wrap'}
          alignItems={'flex-start'}
          justifyContent={'flex-end'}
          gap={3}
        >
          <Box flex={'0 0 auto'} minW={0} w={['100%', 'auto']}>
            {Selectors}
          </Box>
          <Box display={['none', 'block']} flexShrink={0}>
            <PopoverConfirm
              Trigger={<Button size={'md'}>{t('common:Export')}</Button>}
              showCancel
              content={t('account_usage:export_confirm_tip', { total })}
              onConfirm={exportUsage}
            />
          </Box>
        </Flex>
      </Flex>
      <Flex display={['flex', 'none']} mt={3} px={3} w={'100%'}>
        <PopoverConfirm
          Trigger={
            <Button w={'100%'} size={'md'}>
              {t('common:Export')}
            </Button>
          }
          showCancel
          content={t('account_usage:export_confirm_tip', { total })}
          onConfirm={exportUsage}
        />
      </Flex>
      {isPc ? (
        <TableContainer
          ref={scrollContainerRef}
          {...(isFlow ? accountContentFlowStyles : accountContentScrollStyles)}
          mt={3}
          px={[3, 6]}
        >
          <Table>
            <Thead>
              <Tr>
                <Th>{t('common:user.Time')}</Th>
                <Th>{t('account_usage:member')}</Th>
                <Th>{t('account_usage:user_type')}</Th>
                <Th>{t('account_usage:project_name')}</Th>
                <Th>{t('account_usage:total_points')}</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody fontSize={'sm'}>
              {usages.map((item) => (
                <Tr key={item.id}>
                  <Td>{dayjs(item.time).format('YYYY/MM/DD HH:mm:ss')}</Td>
                  <Td>
                    <Flex alignItems={'center'} color={'myGray.500'}>
                      <Avatar src={item.sourceMember.avatar} w={'20px'} mr={1} rounded={'full'} />
                      {item.sourceMember.name}
                    </Flex>
                  </Td>
                  <Td>{t(UsageSourceMap[item.source]?.label as any) || '-'}</Td>
                  <Td className="textEllipsis" maxW={'400px'} title={t(item.appName as any)}>
                    {t(item.appName as any) || '-'}
                  </Td>
                  <Td>{formatNumber(item.totalPoints) || 0}</Td>
                  <Td>
                    <Button
                      size={'sm'}
                      variant={'whitePrimary'}
                      onClick={() => setUsageDetail(item)}
                    >
                      {t('account_usage:details')}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          {!isLoading && usages.length === 0 && (
            <EmptyTip text={t('account_usage:no_usage_records')}></EmptyTip>
          )}
        </TableContainer>
      ) : (
        // 鲁港通 - 手机端（<900px）改用卡片列表，避免 6 列表格横向挤压
        <Box px={3} mt={3} display={'flex'} flexDirection={'column'} gap={3}>
          {usages.map((item) => (
            <Box
              key={item.id}
              border={'1px solid'}
              borderColor={'myGray.200'}
              borderRadius={'md'}
              p={3}
              bg={'white'}
            >
              <Flex alignItems={'center'} gap={2} fontSize={'xs'} color={'myGray.500'}>
                <Box>{dayjs(item.time).format('YYYY/MM/DD HH:mm:ss')}</Box>
                <Box flex={1} />
                <Box flexShrink={0}>{t(UsageSourceMap[item.source]?.label as any) || '-'}</Box>
              </Flex>
              <Box
                mt={1}
                fontWeight={'500'}
                color={'myGray.900'}
                className="textEllipsis"
                title={t(item.appName as any)}
              >
                {t(item.appName as any) || '-'}
              </Box>
              <Flex mt={2.5} alignItems={'center'}>
                <Flex alignItems={'center'} color={'myGray.500'} fontSize={'xs'} flex={1} minW={0}>
                  <Avatar
                    src={item.sourceMember.avatar}
                    w={'18px'}
                    mr={1}
                    rounded={'full'}
                    flexShrink={0}
                  />
                  <Box className="textEllipsis">{item.sourceMember.name}</Box>
                </Flex>
                <Box fontWeight={'600'} color={'myGray.900'} mr={3} flexShrink={0}>
                  {formatNumber(item.totalPoints) || 0}
                </Box>
                <Button
                  size={'sm'}
                  variant={'whitePrimary'}
                  flexShrink={0}
                  onClick={() => setUsageDetail(item)}
                >
                  {t('account_usage:details')}
                </Button>
              </Flex>
            </Box>
          ))}
          {!isLoading && usages.length === 0 && (
            <EmptyTip text={t('account_usage:no_usage_records')}></EmptyTip>
          )}
        </Box>
      )}
      <Flex mt={3} justifyContent={'center'}>
        <Pagination />
      </Flex>

      {!!usageDetail && (
        <UsageDetail usage={usageDetail} onClose={() => setUsageDetail(undefined)} />
      )}
    </MyBox>
  );
};

export default React.memo(UsageTableList);
