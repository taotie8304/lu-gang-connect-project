// 鲁港通 - 账号中心 Credits 主视觉卡：可用余额、累计/已用与套餐信息
import React, { useMemo } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import type { UserPointsDetailType } from '@fastgpt/global/support/wallet/points/type';
import { formatNumber } from '@fastgpt/global/common/math/tools';
import { formatTime2YMD } from '@fastgpt/global/common/string/time';
import { standardSubLevelMap } from '@fastgpt/global/support/wallet/sub/constants';

const chipStyles = {
  fontSize: '11.5px',
  color: '#66758F',
  bg: '#fff',
  border: '1px solid',
  borderColor: '#E7EEF9',
  borderRadius: '999px',
  px: '10px',
  py: '5px',
  lineHeight: 1
} as const;

const UserPointsCard = ({ pointsDetail }: { pointsDetail?: UserPointsDetailType }) => {
  const router = useRouter();
  const { t } = useClientTranslation('account_info');
  const { subPlans } = useSystemStore();

  const planName = useMemo(() => {
    const level = pointsDetail?.currentSubLevel;
    if (!level) return '';
    return subPlans?.standard?.[level]?.name || standardSubLevelMap[level]?.label || '';
  }, [pointsDetail?.currentSubLevel, subPlans]);

  const surplusPoints = pointsDetail?.surplusPoints ?? 0;
  const totalPoints = pointsDetail?.totalPoints ?? 0;
  const usedPoints = Math.max(totalPoints - surplusPoints, 0);

  return (
    <Box
      position={'relative'}
      overflow={'hidden'}
      bg={'linear-gradient(135deg,#F3F8FF 0%,#FFFFFF 58%)'}
      border={'1px solid'}
      borderColor={'#DFEAFB'}
      borderRadius={['16px', '18px']}
      boxShadow={'0 10px 30px rgba(36,80,181,.06)'}
      px={['16px', '24px']}
      py={['17px', '22px']}
    >
      <Box
        position={'absolute'}
        right={'-70px'}
        top={'-90px'}
        w={'280px'}
        h={'280px'}
        borderRadius={'50%'}
        bg={
          'radial-gradient(circle at 40% 40%, rgba(94,143,255,.28), rgba(94,143,255,.06) 55%, transparent 70%)'
        }
        pointerEvents={'none'}
        display={['none', 'block']}
      />
      <Flex
        position={'relative'}
        direction={['column', 'row']}
        align={['stretch', 'flex-start']}
        justify={'space-between'}
        gap={['12px', '18px']}
      >
        <Box>
          <Text fontSize={'12.5px'} color={'#66758F'}>
            {t('account_info:points_surplus')}
          </Text>
          <Flex alignItems={'baseline'} gap={'8px'} mt={'6px'}>
            <Text
              fontSize={['31px', '38px']}
              lineHeight={1}
              fontWeight={650}
              letterSpacing={'-0.5px'}
              css={{ fontVariantNumeric: 'tabular-nums' }}
              color={pointsDetail && surplusPoints <= 0 ? '#D4553F' : '#182234'}
            >
              {pointsDetail ? formatNumber(surplusPoints) : '-'}
            </Text>
            <Text fontSize={'12.5px'} color={'#8C99AE'}>
              Credits
            </Text>
          </Flex>
          <Text mt={'8px'} fontSize={'12px'} color={'#8C99AE'}>
            {t('account_info:points_total')} {pointsDetail ? formatNumber(totalPoints) : '-'} ·{' '}
            {t('account_info:credits_used')} {pointsDetail ? formatNumber(usedPoints) : '-'}
          </Text>
        </Box>

        <Flex
          as={'button'}
          type={'button'}
          align={'center'}
          justify={'center'}
          h={'36px'}
          px={'16px'}
          borderRadius={'10px'}
          bg={'linear-gradient(135deg,#4F86FF,#3370FF)'}
          color={'#fff'}
          fontSize={'13px'}
          whiteSpace={'nowrap'}
          boxShadow={'0 8px 18px rgba(51,112,255,.24)'}
          transition={'0.18s'}
          w={['100%', 'auto']}
          flexShrink={0}
          _hover={{ bg: 'linear-gradient(135deg,#3E77F2,#2450B5)' }}
          onClick={() => router.push('/price')}
        >
          {t('account_info:buy_points')}
        </Flex>
      </Flex>

      <Flex position={'relative'} mt={'18px'} gap={'8px'} flexWrap={'wrap'}>
        {!!planName && (
          <Box {...chipStyles}>
            {t('account_info:current_package')} {t(planName as any)}
          </Box>
        )}
        {!!pointsDetail?.expiredTime && (
          <Box {...chipStyles}>
            {t('account_info:valid_until')} {formatTime2YMD(pointsDetail.expiredTime)}
          </Box>
        )}
      </Flex>
    </Box>
  );
};

export default React.memo(UserPointsCard);
