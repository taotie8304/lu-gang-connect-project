import React from 'react';
import {
  Box,
  Flex,
  Text,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer
} from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { getAutoUpdateHistory } from '@/web/core/dataset/api/autoUpdate';
import type { AutoUpdateHistoryType } from '@/web/core/dataset/type';
import { formatTime2YMDHM } from '@fastgpt/global/common/string/time';
import FormLabel from '@fastgpt/web/components/common/MyBox/FormLabel';
import EmptyTip from '@fastgpt/web/components/common/EmptyTip';

// 鲁港通 - 更新历史列表组件
interface HistoryListProps {
  collectionId: string;
}

const HistoryList = ({ collectionId }: HistoryListProps) => {
  const { t } = useTranslation();

  // 鲁港通 - 加载历史记录
  const { data: historyData } = useRequest(
    async () => {
      if (!collectionId) return null;
      return await getAutoUpdateHistory(collectionId);
    },
    {
      manual: false,
      refreshDeps: [collectionId],
      errorToast: ''
    }
  );

  const history: AutoUpdateHistoryType[] = historyData?.history || [];

  return (
    <Box>
      <FormLabel fontSize={'sm'} fontWeight={'500'} mb={3}>
        {t('dataset:update_history')}
      </FormLabel>

      {history.length === 0 ? (
        <EmptyTip text={t('dataset:no_update_history')} />
      ) : (
        <TableContainer>
          <Table variant={'simple'} size={'sm'}>
            <Thead>
              <Tr>
                <Th>{t('dataset:update_time')}</Th>
                <Th>{t('dataset:status')}</Th>
                <Th>{t('dataset:file_name')}</Th>
                <Th>{t('dataset:message')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {history.map((item, index) => (
                <Tr key={index}>
                  <Td fontSize={'xs'}>
                    {item.timestamp ? formatTime2YMDHM(item.timestamp) : '-'}
                  </Td>
                  <Td>
                    <Badge
                      colorScheme={item.status === 'success' ? 'green' : 'red'}
                      fontSize={'xs'}
                    >
                      {item.status === 'success'
                        ? t('dataset:update_success')
                        : t('dataset:update_failed')}
                    </Badge>
                  </Td>
                  <Td fontSize={'xs'}>{item.fileName || '-'}</Td>
                  <Td fontSize={'xs'} maxW={'200px'} className="textEllipsis">
                    {item.message || '-'}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      {historyData && (
        <Flex mt={3} fontSize={'xs'} color={'myGray.500'} alignItems={'center'}>
          <Text>
            {t('dataset:last_check_time')}:{' '}
            {historyData.lastCheckTime ? formatTime2YMDHM(historyData.lastCheckTime) : '-'}
          </Text>
          <Text ml={4}>
            {t('dataset:last_update_time')}:{' '}
            {historyData.lastUpdateTime ? formatTime2YMDHM(historyData.lastUpdateTime) : '-'}
          </Text>
        </Flex>
      )}
    </Box>
  );
};

export default HistoryList;
