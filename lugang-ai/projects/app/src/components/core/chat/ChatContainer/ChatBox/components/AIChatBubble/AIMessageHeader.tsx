// 鲁港通 - 消息区 AI 头部（第 4 批）：印章头像 + 助手名 + 时间 + 官方来源标记
import { Box, Flex } from '@chakra-ui/react';
import dayjs from 'dayjs';
import { useTranslation } from 'next-i18next';
import { formatTimeToChatItemTime } from '@fastgpt/global/common/string/time';
import { LG } from '@/pageComponents/chat/lugangTheme';

export const AISealAvatar = () => (
  <Box
    w={'28px'}
    h={'28px'}
    flexShrink={0}
    borderRadius={'8px'}
    bg={'linear-gradient(145deg, rgba(160,193,232,0.4), rgba(231,241,251,0.95))'}
    border={'1px solid'}
    borderColor={'rgba(111,157,208,0.35)'}
    display={'grid'}
    placeItems={'center'}
    color={LG.mountain}
    mt={'1px'}
  >
    <Box as={'svg'} w={'14px'} h={'14px'} viewBox={'0 0 24 24'} fill={'none'} stroke={'currentColor'} strokeWidth={1.7} strokeLinecap={'round'} strokeLinejoin={'round'}>
      <path d={'M3 21h18'} />
      <path d={'M5 21V8l7-5 7 5v13'} />
      <path d={'M9 21v-6h6v6'} />
    </Box>
  </Box>
);

type AIMessageHeaderProps = {
  appName?: string;
  time?: Date;
  showVerified?: boolean;
};

const AIMessageHeader = ({ appName, time, showVerified = false }: AIMessageHeaderProps) => {
  const { t } = useTranslation();

  if (!appName && !time) return null;

  return (
    <Flex alignItems={'center'} gap={'8px'} mb={'7px'} minW={0}>
      {appName && (
        <Box fontSize={'12.5px'} fontWeight={600} color={LG.ink} minW={0} noOfLines={1}>
          {appName}
        </Box>
      )}
      {time && (
        <Box fontSize={'10.5px'} color={'#91A3B6'} flexShrink={0}>
          {t(formatTimeToChatItemTime(time) as any, {
            time: dayjs(time).format('HH:mm')
          }).replace('#', ':')}
        </Box>
      )}
      {showVerified && (
        <Flex
          alignItems={'center'}
          gap={'3px'}
          h={'19px'}
          px={'6px'}
          flexShrink={0}
          borderRadius={'5px'}
          fontSize={'10px'}
          letterSpacing={'0.04em'}
          bg={'rgba(111,157,208,0.12)'}
          color={LG.mountain}
          border={'1px solid'}
          borderColor={'rgba(111,157,208,0.24)'}
        >
          <Box as={'svg'} w={'9px'} h={'9px'} viewBox={'0 0 24 24'} fill={'none'} stroke={'currentColor'} strokeWidth={2.4} strokeLinecap={'round'} strokeLinejoin={'round'}>
            <polyline points={'20 6 9 17 4 12'} />
          </Box>
          {t('chat:answer_verified_official')}
        </Flex>
      )}
    </Flex>
  );
};

export default AIMessageHeader;
