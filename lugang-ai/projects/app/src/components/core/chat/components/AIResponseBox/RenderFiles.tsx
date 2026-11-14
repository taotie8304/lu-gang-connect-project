import React, { useState } from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { useContextSelector } from 'use-context-selector';
import type { ChatFileCardType } from '@fastgpt/global/core/chat/type';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useChatAuthApiTarget } from '@/web/core/chat/utils';
import { getPresignedChatFileGetUrl } from '@/web/common/file/api';
import { WorkflowRuntimeContext } from '../../ChatContainer/context/workflowRuntimeContext';

/** 鲁港通 - 聊天内生成文档的文件卡片：展示名称/格式/大小/保留期，并提供短链下载。 */
const RenderFiles = ({ files }: { files?: ChatFileCardType[] | null }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const chatId = useContextSelector(WorkflowRuntimeContext, (v) => v.chatId);
  const sourceTarget = useContextSelector(WorkflowRuntimeContext, (v) => v.sourceTarget);
  const outLinkAuthData = useContextSelector(WorkflowRuntimeContext, (v) => v.outLinkAuthData);
  const chatAuthTarget = useChatAuthApiTarget({ sourceTarget, outLinkAuthData });
  const retentionDays = useSystemStore((s) => s.feConfigs?.lugangChatFileRetentionDays);
  const [downloadingKey, setDownloadingKey] = useState('');

  if (!files?.length) return null;

  const expiryText = retentionDays
    ? t('chat:chat_file_card_expiry', { days: retentionDays })
    : t('chat:chat_file_card_expiry_unknown');

  const formatSize = (size?: number) => {
    if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return '';
    if (size >= 1024 * 1024) {
      return t('chat:chat_file_card_size_mb', { size: (size / 1024 / 1024).toFixed(1) });
    }
    return t('chat:chat_file_card_size_kb', { size: Math.max(1, Math.round(size / 1024)) });
  };

  const handleDownload = async (file: ChatFileCardType) => {
    if (downloadingKey) return;
    setDownloadingKey(file.key);
    try {
      const url = await getPresignedChatFileGetUrl({
        key: file.key,
        chatId,
        ...chatAuthTarget
      });
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      // 鲁港通 - 文件超期或已被清理时给出可操作提示
      toast({
        title: t('chat:chat_file_card_download_failed'),
        status: 'warning',
        duration: 4000,
        isClosable: true
      });
    } finally {
      setDownloadingKey('');
    }
  };

  return (
    <Flex flexDirection={'column'} gap={2}>
      {files.map((file) => {
        const sizeText = formatSize(file.size);
        const metaText = [sizeText, expiryText].filter(Boolean).join(' · ');

        return (
          <Flex
            key={file.key}
            alignItems={'center'}
            gap={3}
            px={3}
            py={2}
            border={'1px solid'}
            borderColor={'rgba(111,157,208,0.28)'}
            borderRadius={'10px'}
            bg={'rgba(231,241,251,0.5)'}
          >
            <Box
              flexShrink={0}
              minW={'44px'}
              px={1.5}
              py={1}
              borderRadius={'6px'}
              bg={'rgba(74,111,146,0.1)'}
              color={'#4A6F92'}
              fontSize={'10px'}
              fontWeight={700}
              textAlign={'center'}
            >
              {file.format.toUpperCase()}
            </Box>
            <Box flex={1} minW={0}>
              <Text fontWeight={600} fontSize={'13px'} color={'#2F3B4A'} noOfLines={1}>
                {file.name}
              </Text>
              <Text mt={0.5} fontSize={'11px'} color={'#6B7A90'}>
                {metaText}
              </Text>
            </Box>
            <Button
              flexShrink={0}
              size={'xs'}
              variant={'outline'}
              borderColor={'rgba(111,157,208,0.5)'}
              color={'#4A6F92'}
              isLoading={downloadingKey === file.key}
              onClick={() => handleDownload(file)}
            >
              {t('chat:chat_file_card_download')}
            </Button>
          </Flex>
        );
      })}
    </Flex>
  );
};

export default React.memo(RenderFiles);
