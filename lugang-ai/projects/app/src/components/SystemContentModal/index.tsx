/**
 * 鲁港通 - 系统内容显示弹窗
 * 用于显示使用条款、隐私政策、个人资料收集声明等内容
 * 支持 Markdown 渲染
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Box,
  Spinner,
  Center,
  Text
} from '@chakra-ui/react';
import Markdown from '@fastgpt/web/components/common/Markdown';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import type { SystemContentKeyEnum } from '@fastgpt/global/support/systemContent/constant';
import type { SystemContentResponse } from '@fastgpt/global/support/systemContent/type';
// 鲁港通 - 复用官方 GET 包装器（baseURL=/api，自动解包 NextAPI 信封 .data），替代裸 fetch
import { GET } from '@/web/common/api/request';

interface SystemContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentKey: `${SystemContentKeyEnum}`;
  title: string;
}

const SystemContentModal: React.FC<SystemContentModalProps> = ({
  isOpen,
  onClose,
  contentKey,
  title
}) => {
  const { t } = useClientTranslation();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchContent = async () => {
    try {
      setLoading(true);
      setError('');
      // 鲁港通 - GET 包装器已解包 NextAPI 信封，直接得到 SystemContentResponse
      const data = await GET<SystemContentResponse>(`/system/content/${contentKey}`);
      setContent(data?.content || '');
    } catch {
      // 鲁港通 - 用户可见错误走 i18n（禁硬编码繁体），客户端不打 console
      setError(t('common:system_content.fetch_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && contentKey) {
      fetchContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, contentKey]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="80vh">
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {loading ? (
            <Center py={10}>
              <Spinner size="lg" color="primary.500" />
            </Center>
          ) : error ? (
            <Center py={10}>
              <Text color="red.500">{error}</Text>
            </Center>
          ) : (
            <Box>
              <Markdown source={content} />
            </Box>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default SystemContentModal;
