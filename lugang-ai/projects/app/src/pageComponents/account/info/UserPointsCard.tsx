// 鲁港通 - 个人积分卡片：账户中心展示个人积分余额与套餐状态，所有成员（含普通用户）可见
import React, { useMemo } from 'react';
import { Box, Button, Flex } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { getUserPointsDetail } from '@/web/support/wallet/points/api';
import { formatNumber } from '@fastgpt/global/common/math/tools';
import { formatTime2YMD } from '@fastgpt/global/common/string/time';
import { standardSubLevelMap } from '@fastgpt/global/support/wallet/sub/constants';
import { accountTitleTextStyles } from '@/pageComponents/account/styles';

const UserPointsCard = () => {
  const router = useRouter();
  const { t } = useClientTranslation('account_info');
  const { subPlans } = useSystemStore();

  const { data: pointsDetail } = useRequest(getUserPointsDetail, { manual: false });

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
    <Box mt={[6, 0]}>
      <Flex as={'h2'} alignItems={'center'} {...accountTitleTextStyles}>
        {t('account_info:my_points')}
      </Flex>

      <Box
        mt={[3, 6]}
        bg={'white'}
        borderWidth={'1px'}
        borderColor={'borderColor.low'}
        borderRadius={'md'}
        px={[5, 7]}
        pt={[3, 6]}
        pb={[3, 6]}
      >
        <Flex alignItems={'flex-start'}>
          <Box flex={'1 0 0'}>
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
          </Box>

          <Button size={'sm'} w={'8rem'} onClick={() => router.push('/price')}>
            {t('account_info:buy_points')}
          </Button>
        </Flex>

        <Flex mt={4} flexWrap={'wrap'} columnGap={6} rowGap={2} color={'#485264'} fontSize={'xs'}>
          <Box>
            {t('account_info:current_package')}: {t(planName as any)}
          </Box>
          {!!pointsDetail?.expiredTime && (
            <Box>
              {t('account_info:package_expiry_time')}: {formatTime2YMD(pointsDetail.expiredTime)}
            </Box>
          )}
        </Flex>
      </Box>
    </Box>
  );
};

export default React.memo(UserPointsCard);
