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
import type { SystemContentKeyEnum } from '@fastgpt/global/support/systemContent/constant';

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
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchContent = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/system/content/${contentKey}`);
      
      if (!response.ok) {
        throw new Error('獲取內容失敗');
      }

      const data = await response.json();
      setContent(data.content || '');
    } catch (err: any) {
      console.error('鲁港通：获取系统内容失败', { contentKey, error: err.message });
      setError('獲取內容失敗，請稍後再試');
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
