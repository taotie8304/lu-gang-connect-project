import { Box, Flex, useDisclosure } from '@chakra-ui/react';
import React from 'react';
import dynamic from 'next/dynamic';
import type { AIChatItemValueItemType } from '@fastgpt/global/core/chat/type';
import type { OnOpenCiteModalProps } from '@/web/core/chat/context/chatItemContext';
import type { ChatSiteItemType } from '../../type';
import AIChatBubbleContent from './Content';
import AIChatBubbleActions from './Actions';
import AIMessageHeader, { AISealAvatar } from './AIMessageHeader';
import type { ChatControllerProps } from '../ChatController';
import { useContextSelector } from 'use-context-selector';
import { ChatBoxContext } from '../../Provider';
import { ChatItemContext } from '@/web/core/chat/context/chatItemContext';
import AIChatLoading from '../AIChatLoading';
import { hasAiProcessingContent, shouldShowNoOutputTip } from './utils';
import { useTranslation } from 'next-i18next';
import { ChatGenerateStatusEnum } from '@fastgpt/global/core/chat/constants';
import { ChatBoxContentMaxWidth } from '../../constants';

const ResponseTags = dynamic(() => import('../ResponseTags'));
const WholeResponseModal = dynamic(() => import('../../../../components/WholeResponseModal'));

export { shouldFilterAiValue } from './utils';

type AIChatBubbleProps = {
  chat: ChatSiteItemType;
  chatValue: AIChatItemValueItemType[];
  isPlanCard: boolean;
  isLastChild: boolean;
  isLastValueGroup: boolean;
  isChatting: boolean;
  hasValidContent: boolean;
  loadingText?: string;
  questionGuides: string[];
  enableSandbox: boolean;
  allowedCitationIds?: Set<string>;
  onOpenCiteModal: (e?: OnOpenCiteModalProps) => void;
  // 鲁港通 - 消息区改版（第 4 批）：仅首组显示 AI 头部；有真实引用时才标记「已核对官方原文」
  showHeader?: boolean;
  hasCitations?: boolean;
  chatControllerProps: ChatControllerProps;
  children?: React.ReactNode;
};

const AIChatBubble = ({
  chat,
  chatValue,
  isPlanCard,
  isLastChild,
  isLastValueGroup,
  isChatting,
  hasValidContent,
  loadingText,
  questionGuides,
  enableSandbox,
  allowedCitationIds,
  onOpenCiteModal,
  showHeader = false,
  hasCitations = false,
  chatControllerProps,
  children
}: AIChatBubbleProps) => {
  const { t } = useTranslation();
  const chatType = useContextSelector(ChatBoxContext, (v) => v.chatType);
  const appName = useContextSelector(ChatItemContext, (v) => v.chatBoxData?.app?.name);
  const showWholeResponse = useContextSelector(ChatItemContext, (v) => v.showWholeResponse ?? true);
  const chatGenerateStatus = useContextSelector(
    ChatItemContext,
    (v) => v.chatBoxData.chatGenerateStatus
  );
  const {
    isOpen: isOpenWholeModal,
    onOpen: onOpenWholeModal,
    onClose: onCloseWholeModal
  } = useDisclosure();
  const showFooterActions = isLastValueGroup && (!isLastChild || !isChatting);
  const canShowWholeResponse = chatType !== 'share' && showWholeResponse;
  const showLoading = isLastChild && isLastValueGroup && isChatting;
  const hasProcessingContent = chatValue.some((item) => hasAiProcessingContent(item));
  const isCurrentChatGenerateStatusReady = chatGenerateStatus !== undefined;
  const isCurrentChatGenerating = chatGenerateStatus === ChatGenerateStatusEnum.generating;
  const shouldWaitCurrentChatStatus =
    isLastChild &&
    isLastValueGroup &&
    (!isCurrentChatGenerateStatusReady || isCurrentChatGenerating);
  const showLoadingPlaceholder =
    shouldWaitCurrentChatStatus &&
    !isChatting &&
    !chat.errorMsg &&
    !chat.errorText &&
    !hasValidContent;
  const showNoOutputTip = shouldShowNoOutputTip({
    obj: chat.obj,
    status: chat.status,
    isLastValueGroup,
    isLastChild,
    isChatting,
    shouldWaitCurrentChatStatus,
    hasError: !!chat.errorMsg || !!chat.errorText,
    hasValidContent
  });
  const placeholderText = showLoadingPlaceholder
    ? t('chat:chat_loading_content')
    : showNoOutputTip
      ? t('chat:no_output_content')
      : '';

  return (
    <Box position={'relative'} w={'100%'} maxW={'100%'}>
      <Flex alignItems={'flex-start'} gap={'11px'} w={'100%'}>
        <Box display={['none', 'block']} flexShrink={0} w={'28px'}>
          {showHeader && <AISealAvatar />}
        </Box>
        <Box
          flex={1}
          minW={isPlanCard ? ['100%', '50%'] : 0}
          maxW={ChatBoxContentMaxWidth}
          color={'myGray.900'}
          textAlign={'left'}
        >
          {showHeader && (
            <AIMessageHeader
              appName={appName}
              time={chat.time}
              showVerified={hasCitations}
            />
          )}
          <AIChatBubbleContent
            chatValue={chatValue}
            responseData={chat.responseData}
            dataId={chat.dataId}
            isLastChild={isLastChild && isLastValueGroup}
            isChatting={isChatting}
            allowedCitationIds={allowedCitationIds}
            onOpenCiteModal={onOpenCiteModal}
          />
          {placeholderText && (
            <Box
              mt={hasProcessingContent ? 4 : 0}
              fontSize="14px"
              lineHeight="20px"
              color="myGray.500"
            >
              {placeholderText}
            </Box>
          )}
          {isLastValueGroup && (
            <ResponseTags
              showTags={!isLastChild || !isChatting}
              historyItem={chat}
              onOpenCiteModal={onOpenCiteModal}
              showFooterMeta={false}
            />
          )}
          {children}
          {showLoading && (
            <Box mt={3}>
              <AIChatLoading text={loadingText} size={'md'} />
            </Box>
          )}
          {showFooterActions && (
            <AIChatBubbleActions
              chatControllerProps={chatControllerProps}
              historyItem={chat}
              questionGuides={isLastChild ? questionGuides : []}
              showWholeResponse={canShowWholeResponse}
              enableSandbox={enableSandbox}
              onOpenWholeModal={onOpenWholeModal}
              durationSeconds={chat.durationSeconds || 0}
              responseData={chat.responseData}
            />
          )}
        </Box>
      </Flex>
      {isOpenWholeModal && <WholeResponseModal dataId={chat.dataId} onClose={onCloseWholeModal} />}
    </Box>
  );
};

export default React.memo(AIChatBubble);
