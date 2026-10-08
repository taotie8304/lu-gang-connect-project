// 鲁港通 - 聊天侧积分余额提醒（个人积分账户）：
// ① 输入框左下角常驻余额标签；② 余额低于提醒线时在输入框上方给出购买引导提示条
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Flex, Text } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useContextSelector } from 'use-context-selector';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { formatNumber } from '@fastgpt/global/common/math/tools';
import { ChatBoxContext } from '@/components/core/chat/ChatContainer/ChatBox/Provider';
import { WorkflowRuntimeContext } from '@/components/core/chat/ChatContainer/context/workflowRuntimeContext';
import { ChatTypeEnum } from '@/components/core/chat/ChatContainer/ChatBox/constants';
import { getUserPointsDetail } from '@/web/support/wallet/points/api';

// 鲁港通 - 低余额提醒线（用户拍板 500 分）
const LOW_BALANCE_THRESHOLD = 500;
// 鲁港通 - 提示条关闭记录（按自然日，关闭后当天不再出现）
const NOTICE_DISMISSED_DATE_KEY = 'lugang_points_notice_dismissed_date';

const getTodayDateStr = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${date}`;
};

// 鲁港通 - 仅普通对话与首页对话展示余额，外链分享访客与调试/日志页不展示
const useIsPointsVisible = () => {
  const outLinkAuthData = useContextSelector(WorkflowRuntimeContext, (v) => v.outLinkAuthData);
  const chatType = useContextSelector(ChatBoxContext, (v) => v.chatType);

  // 鲁港通 - 外链访客以携带分享鉴权为准（普通场景该对象被规范为空对象，不能直接判空）
  const isOutLinkVisitor = !!(outLinkAuthData?.shareId && outLinkAuthData?.outLinkUid);

  return (
    !isOutLinkVisitor && (chatType === ChatTypeEnum.chat || chatType === ChatTypeEnum.home)
  );
};

// 鲁港通 - 进入时加载一次余额，每轮回答结束（扣费入库后）自动刷新
const useSurplusPoints = (isVisible: boolean) => {
  const isChatting = useContextSelector(ChatBoxContext, (v) => v.isChatting);
  const wasChattingRef = useRef(false);

  const { data, run: refreshPoints } = useRequest(getUserPointsDetail, {
    manual: true,
    errorToast: ''
  });

  useEffect(() => {
    if (isVisible) {
      refreshPoints();
    }
  }, [isVisible, refreshPoints]);

  useEffect(() => {
    if (!isVisible) return;

    const justFinished = wasChattingRef.current && !isChatting;
    wasChattingRef.current = isChatting;
    if (!justFinished) return;

    // 鲁港通 - 稍等扣费入库后再刷新，避免读到旧余额
    const timer = setTimeout(() => {
      refreshPoints();
    }, 1000);

    return () => clearTimeout(timer);
  }, [isVisible, isChatting, refreshPoints]);

  if (data === undefined) return undefined;

  return Math.max(0, data.surplusPoints);
};

// 鲁港通 - 输入框左下角常驻余额标签
export const PointsBalanceTag = () => {
  const { t } = useTranslation();
  const isVisible = useIsPointsVisible();
  const surplusPoints = useSurplusPoints(isVisible);

  if (!isVisible || surplusPoints === undefined) return null;

  return (
    <Text
      fontSize={'12px'}
      lineHeight={'16px'}
      whiteSpace={'nowrap'}
      color={surplusPoints < LOW_BALANCE_THRESHOLD ? 'orange.500' : 'myGray.400'}
    >
      {t('common:chat_points_balance', { points: formatNumber(surplusPoints) })}
    </Text>
  );
};

// 鲁港通 - 低余额购买引导提示条（积分未彻底用完时与拦截弹窗互补）
const PointsBalanceNotice = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const isVisible = useIsPointsVisible();
  const surplusPoints = useSurplusPoints(isVisible);
  const [dismissedDate, setDismissedDate] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem(NOTICE_DISMISSED_DATE_KEY)
  );

  const handleDismiss = useCallback(() => {
    const today = getTodayDateStr();
    localStorage.setItem(NOTICE_DISMISSED_DATE_KEY, today);
    setDismissedDate(today);
  }, []);

  if (
    !isVisible ||
    surplusPoints === undefined ||
    surplusPoints <= 0 ||
    surplusPoints >= LOW_BALANCE_THRESHOLD ||
    dismissedDate === getTodayDateStr()
  ) {
    return null;
  }

  return (
    <Flex
      alignItems={'center'}
      gap={2}
      mb={2}
      px={3}
      py={'6px'}
      borderRadius={'md'}
      bg={'yellow.50'}
      border={'1px solid'}
      borderColor={'yellow.200'}
    >
      <MyIcon name={'common/info'} w={'16px'} color={'yellow.600'} flexShrink={0} />
      <Text fontSize={'sm'} color={'myGray.700'} flex={'1 1 0'} minW={0}>
        {t('common:chat_points_low_notice', { points: formatNumber(surplusPoints) })}
      </Text>
      <Button size={'sm'} variant={'primary'} flexShrink={0} onClick={() => router.push('/price')}>
        {t('common:chat_points_go_buy')}
      </Button>
      <MyIcon
        name={'close'}
        w={'16px'}
        color={'myGray.500'}
        cursor={'pointer'}
        flexShrink={0}
        onClick={handleDismiss}
      />
    </Flex>
  );
};

export default PointsBalanceNotice;
