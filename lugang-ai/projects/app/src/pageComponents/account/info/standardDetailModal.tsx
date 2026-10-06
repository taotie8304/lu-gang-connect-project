// 鲁港通 - 套餐详情弹窗：与「我的积分」卡同源（个人积分账户）展示，两处数字始终一致
import React, { useMemo } from 'react';
import { Box, Flex, HStack, ModalBody, ModalCloseButton } from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useLoading } from '@fastgpt/web/hooks/useLoading';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { getUserPointsDetail } from '@/web/support/wallet/points/api';
import { formatNumber } from '@fastgpt/global/common/math/tools';
import { formatTime2YMD } from '@fastgpt/global/common/string/time';
import { standardSubLevelMap } from '@fastgpt/global/support/wallet/sub/constants';

const StandDetailModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useClientTranslation('account_info');
  const { Loading } = useLoading();
  const { subPlans } = useSystemStore();

  const { data: pointsDetail, loading: isLoading } = useRequest(getUserPointsDetail, {
    manual: false
  });

  const planName = useMemo(() => {
    if (!pointsDetail?.currentSubLevel) return '';
    return (
      subPlans?.standard?.[pointsDetail.currentSubLevel]?.name ||
      standardSubLevelMap[pointsDetail.currentSubLevel].label
    );
  }, [pointsDetail?.currentSubLevel, subPlans]);

  const surplusPoints = pointsDetail?.surplusPoints ?? 0;
  const totalPoints = pointsDetail?.totalPoints ?? 0;

  return (
    <MyModal
      isOpen
      maxW={['90vw', '520px']}
      iconSrc="modal/teamPlans"
      title={t('account_info:package_details')}
      isCentered
    >
      <ModalCloseButton onClick={onClose} />
      <ModalBody px={[4, 8]} py={[2, 6]}>
        <Box position={'relative'} minH={'160px'}>
          <Box color={'myGray.600'} fontSize={'sm'}>
            {t('account_info:points_surplus')}
          </Box>
          <Box
            mt={1}
            fontWeight={'bold'}
            fontSize={'2xl'}
            color={pointsDetail && surplusPoints <= 0 ? 'red.600' : 'myGray.900'}
          >
            {pointsDetail ? formatNumber(surplusPoints) : '-'}
          </Box>
          <Box mt={1} color={'myGray.600'} fontSize={'xs'}>
            {t('account_info:points_total')}: {pointsDetail ? formatNumber(totalPoints) : '-'}
          </Box>

          <Flex
            mt={5}
            pt={4}
            flexWrap={'wrap'}
            columnGap={6}
            rowGap={2}
            color={'#485264'}
            fontSize={'xs'}
            borderTopWidth={'1px'}
            borderTopColor={'borderColor.low'}
          >
            <Box>
              {t('account_info:current_package')}: {pointsDetail ? t(planName as any) : '-'}
            </Box>
            {!!pointsDetail?.expiredTime && (
              <Box>
                {t('account_info:package_expiry_time')}: {formatTime2YMD(pointsDetail.expiredTime)}
              </Box>
            )}
          </Flex>

          <HStack mt={5} color={'myGray.500'}>
            <MyIcon name={'infoRounded'} w={'1rem'} />
            <Box fontSize={'xs'}>{t('account_info:points_order_record_tip')}</Box>
          </HStack>

          <Loading loading={isLoading} fixed={false} />
        </Box>
      </ModalBody>
    </MyModal>
  );
};

export default StandDetailModal;
