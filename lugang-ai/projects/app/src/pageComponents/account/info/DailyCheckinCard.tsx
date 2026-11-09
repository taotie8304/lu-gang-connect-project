// 鲁港通 - 账号中心每日打卡卡片：7 天连签进度与今日打卡
import React from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { getCheckinStatus, postCheckin } from '@/web/support/wallet/checkin/api';

const CHECKIN_CYCLE = 7;

const cardStyles = {
  bg: '#fff',
  border: '1px solid',
  borderColor: '#E7EEF9',
  borderRadius: ['16px', '18px'],
  boxShadow: '0 10px 30px rgba(36,80,181,.06)',
  px: ['16px', '24px'],
  py: ['17px', '22px']
};

const DailyCheckinCard = ({ onCheckedIn }: { onCheckedIn?: () => void }) => {
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
  const nextReward = status?.nextRewardPreview ?? 0;
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
      onCheckedIn?.();
    } catch {
      // 失败文案（如「今日已打卡」）由请求层统一弹出，这里仅同步最新状态
    }
    refreshStatus().catch(() => undefined);
  };

  return (
    <Box {...cardStyles}>
      <Flex
        align={['stretch', 'flex-start']}
        justify={'space-between'}
        gap={['10px', '16px']}
        direction={['column', 'row']}
      >
        <Box>
          <Text fontSize={'15.5px'} fontWeight={600} letterSpacing={'0.2px'} color={'#182234'}>
            {t('account_info:checkin_title')}
          </Text>
          <Text mt={'5px'} fontSize={'12px'} color={'#8C99AE'} lineHeight={'1.5'}>
            {t('account_info:checkin_desc')}
          </Text>
        </Box>
        <Button
          h={'36px'}
          px={'16px'}
          borderRadius={'10px'}
          fontSize={'13px'}
          fontWeight={500}
          color={'#fff'}
          bgImage={'linear-gradient(135deg,#4F86FF,#3370FF)'}
          boxShadow={'0 8px 18px rgba(51,112,255,.24)'}
          whiteSpace={'nowrap'}
          isLoading={checking}
          isDisabled={checkedToday || loading}
          _hover={{ bgImage: 'linear-gradient(135deg,#3E77F2,#2450B5)' }}
          _disabled={{
            bgImage: 'none',
            bg: '#DCE4F2',
            color: '#9AA8BE',
            boxShadow: 'none',
            cursor: 'default'
          }}
          onClick={onCheckin}
        >
          {checkedToday
            ? t('account_info:checkin_button_done')
            : t('account_info:checkin_button_reward', { amount: nextReward })}
        </Button>
      </Flex>

      <Flex alignItems={'baseline'} gap={'5px'} mt={'14px'}>
        <Text
          fontSize={'15px'}
          fontWeight={650}
          color={'#182234'}
          css={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {streak}
        </Text>
        <Text fontSize={'12.5px'} color={'#8C99AE'}>
          {t('account_info:checkin_streak_unit')}
        </Text>
      </Flex>

      <Box
        display={'grid'}
        gridTemplateColumns={'repeat(7, minmax(0, 1fr))'}
        gap={['5px', '8px']}
        mt={'14px'}
      >
        {Array.from({ length: CHECKIN_CYCLE }, (_, i) => {
          const day = i + 1;
          const filled = day <= cycleProgress;
          const isToday = filled && day === cycleProgress;
          return (
            <Flex
              key={day}
              h={['44px', '48px']}
              flexDir={'column'}
              alignItems={'center'}
              justifyContent={'center'}
              gap={'2px'}
              borderRadius={['9px', '11px']}
              border={'1px solid transparent'}
              bg={filled ? 'linear-gradient(160deg,#5E8FFF,#3370FF)' : '#F2F5FA'}
              color={filled ? '#fff' : '#8C99AE'}
              boxShadow={filled ? '0 8px 16px rgba(51,112,255,.22)' : 'none'}
              transition={'0.22s'}
              outline={isToday ? '2px solid rgba(51,112,255,.35)' : 'none'}
              outlineOffset={isToday ? '2px' : undefined}
            >
              <Text
                fontSize={'12.5px'}
                fontWeight={600}
                css={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {day}
              </Text>
              {day === CHECKIN_CYCLE && (
                <Text fontSize={'9px'} opacity={0.85}>
                  +10
                </Text>
              )}
            </Flex>
          );
        })}
      </Box>
    </Box>
  );
};

export default React.memo(DailyCheckinCard);
