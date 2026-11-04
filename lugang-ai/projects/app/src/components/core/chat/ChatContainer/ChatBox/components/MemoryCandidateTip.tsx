// 鲁港通 - 对话轻提示：本次对话提取到待确认记忆时引导用户去确认
import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Flex, IconButton } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { getChatMemoryCandidates } from '@/web/support/memory/api';

/** 提取在响应结束后异步执行，用短轮询等待候选落库 */
const POLL_TIMES = 4;
const POLL_INTERVAL = 2500;

type Props = {
  chatId?: string;
  isChatting?: boolean;
  enabled: boolean;
};

const MemoryCandidateTip = ({ chatId, isChatting = false, enabled }: Props) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevIsChattingRef = useRef(isChatting);

  useEffect(() => {
    const wasChatting = prevIsChattingRef.current;
    prevIsChattingRef.current = isChatting;
    if (!enabled || !chatId || !wasChatting || isChatting) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async (attempt: number) => {
      try {
        const res = await getChatMemoryCandidates(chatId);
        if (cancelled) return;
        if (res.list.length > 0) {
          setVisible(true);
          setDismissed(false);
          return;
        }
      } catch {
        // 提取结果可能尚未落库，继续短轮询
      }
      if (cancelled || attempt + 1 >= POLL_TIMES) return;
      timer = setTimeout(() => void poll(attempt + 1), POLL_INTERVAL);
    };

    void poll(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [chatId, enabled, isChatting]);

  if (!enabled || !visible || dismissed) return null;

  return (
    <Flex
      mb={2}
      px={3}
      py={2}
      gap={2}
      alignItems={'center'}
      borderRadius={'lg'}
      border={'1px solid'}
      borderColor={'primary.200'}
      bg={'primary.50'}
      fontSize={'sm'}
    >
      <MyIcon name={'core/chat/think'} w={'16px'} flexShrink={0} color={'primary.600'} />
      <Box flex={1} minW={0} color={'myGray.700'}>
        {t('account:memory_tip_text')}
      </Box>
      <Button
        size={'xs'}
        variant={'primary'}
        flexShrink={0}
        onClick={() => router.push('/account/memories')}
      >
        {t('account:memory_tip_action')}
      </Button>
      <IconButton
        aria-label={t('account:memory_tip_close')}
        size={'xs'}
        variant={'unstyled'}
        flexShrink={0}
        color={'myGray.500'}
        icon={<MyIcon name={'close'} w={'14px'} />}
        onClick={() => setDismissed(true)}
      />
    </Flex>
  );
};

export default React.memo(MemoryCandidateTip);
