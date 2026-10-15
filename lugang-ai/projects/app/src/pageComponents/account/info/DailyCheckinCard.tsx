// 鲁港通 - 每日打卡卡片（Credits 改革批 2）：账户中心展示 7 天连签进度格与打卡按钮
import React from 'react';
import { Box, Button, Flex } from '@chakra-ui/react';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { getCheckinStatus, postCheckin } from '@/web/support/wallet/checkin/api';
import { accountTitleTextStyles } from '@/pageComponents/account/styles';

const CHECKIN_CYCLE = 7;

const DailyCheckinCard = () => {
  const { t } = useClientTranslation('account_info');
  const { toast } = useToast();

  const {
    data: status,
    loading,
    runAsync: refreshStatus
  } = useRequest(getCheckinStatus, { manual: false });
  const { runAsync: doCheckin, loading: checking } = useRequest(postCheckin, { manual: true });

  const streak = status?.streak ?? 0;
  const checkedToday = status?.checkedToday ?? false;
  // 连签在 7 天周期内的进度（满 7 天时第 7 格点亮，之后从第 1 格重新累积）
  const cycleProgress =
    streak > 0 && streak % CHECKIN_CYCLE === 0 ? CHECKIN_CYCLE : streak % CHECKIN_CYCLE;

  const onCheckin = async () => {
    try {
      const res = await doCheckin();
      toast({
        status: 'success',
        title: t('account_info:checkin_toast', { amount: res.reward })
      });
    } catch {
      // 失败文案（如「今日已打卡」）由请求层统一弹出，这里仅同步最新状态
    }
    refreshStatus().catch(() => undefined);
  };

  return (
    <Box mt={[6, 4]}>
      <Flex as={'h2'} alignItems={'center'} {...accountTitleTextStyles}>
        {t('account_info:checkin_title')}
      </Flex>

      <Box
        mt={[3, 4]}
        bg={'white'}
        borderWidth={'1px'}
        borderColor={'borderColor.low'}
        borderRadius={'md'}
        px={[5, 7]}
        py={[3, 6]}
      >
        <Flex alignItems={'center'} justifyContent={'space-between'} flexWrap={'wrap'} rowGap={3}>
          <Box>
            <Box fontWeight={'bold'} fontSize={'lg'} color={'myGray.900'}>
              {t('account_info:checkin_streak', { count: streak })}
            </Box>
            <Box mt={1} color={'myGray.600'} fontSize={'xs'}>
              {t('account_info:checkin_subtitle')}
            </Box>
          </Box>
          <Button
            size={'sm'}
            isLoading={checking}
            isDisabled={checkedToday || loading}
            onClick={onCheckin}
          >
            {checkedToday
              ? t('account_info:checkin_button_done')
              : t('account_info:checkin_button')}
          </Button>
        </Flex>

        <Flex mt={[3, 4]} columnGap={[1, 2]}>
          {Array.from({ length: CHECKIN_CYCLE }, (_, i) => {
            const day = i + 1;
            const filled = day <= cycleProgress;
            return (
              <Flex
                key={day}
                flex={'1 0 0'}
                h={['38px', '46px']}
                flexDir={'column'}
                alignItems={'center'}
                justifyContent={'center'}
                borderRadius={'sm'}
                bg={filled ? 'primary.500' : 'myGray.100'}
                color={filled ? 'white' : 'myGray.500'}
                fontWeight={'medium'}
              >
                <Box fontSize={['10px', 'xs']}>{day}</Box>
                {day === CHECKIN_CYCLE && (
                  <Box fontSize={'9px'} opacity={filled ? 1 : 0.7}>
                    +10
                  </Box>
                )}
              </Flex>
            );
          })}
        </Flex>
      </Box>
    </Box>
  );
};

export default React.memo(DailyCheckinCard);
