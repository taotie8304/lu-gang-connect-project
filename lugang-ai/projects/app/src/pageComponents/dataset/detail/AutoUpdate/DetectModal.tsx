import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Box,
  Flex,
  Button,
  Text,
  VStack,
  Badge
} from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import type { DetectResultType } from '@/web/core/dataset/type';

// 鲁港通 - 数据集识别结果弹窗
interface DetectModalProps {
  isOpen: boolean;
  onClose: () => void;
  detectResult: DetectResultType;
  onSelectFile: (file: { fileName: string; format: string; fileUrl: string }) => void;
}

const DetectModal = ({ isOpen, onClose, detectResult, onSelectFile }: DetectModalProps) => {
  const { t } = useTranslation();

  // 鲁港通 - 按格式分组文件
  const groupedFiles = React.useMemo(() => {
    const groups: Record<string, typeof detectResult.files> = {};
    detectResult.files.forEach((file) => {
      if (!groups[file.format]) {
        groups[file.format] = [];
      }
      groups[file.format].push(file);
    });
    return groups;
  }, [detectResult.files]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t('dataset:detect_result')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {detectResult.success ? (
            <VStack align="stretch" spacing={4}>
              <Text fontSize={'sm'} color={'myGray.600'}>
                {t('dataset:found_files', { count: detectResult.files.length })}
              </Text>

              {Object.entries(groupedFiles).map(([format, files]) => (
                <Box key={format}>
                  <Flex alignItems={'center'} mb={2}>
                    <Badge colorScheme="blue" fontSize={'xs'}>
                      {format.toUpperCase()}
                    </Badge>
                    <Text fontSize={'xs'} ml={2} color={'myGray.500'}>
                      {files.length} {t('dataset:files')}
                    </Text>
                  </Flex>
                  <VStack align="stretch" spacing={2}>
                    {files.map((file, index) => (
                      <Flex
                        key={index}
                        p={3}
                        borderRadius={'md'}
                        border={'1px solid'}
                        borderColor={'myGray.200'}
                        _hover={{ borderColor: 'primary.300', bg: 'myGray.50' }}
                        cursor={'pointer'}
                        onClick={() => onSelectFile(file)}
                      >
                        <MyIcon name={'common/file/fill/csv'} w={'16px'} mr={2} />
                        <Box flex={1}>
                          <Text fontSize={'sm'} fontWeight={'500'}>
                            {file.fileName}
                          </Text>
                        </Box>
                        <MyIcon name={'common/rightArrowLight'} w={'14px'} color={'myGray.500'} />
                      </Flex>
                    ))}
                  </VStack>
                </Box>
              ))}
            </VStack>
          ) : (
            <Flex
              direction={'column'}
              alignItems={'center'}
              justifyContent={'center'}
              py={8}
              color={'myGray.500'}
            >
              <MyIcon name={'common/errorLight'} w={'48px'} mb={4} />
              <Text fontSize={'sm'}>{detectResult.message || t('dataset:detect_failed')}</Text>
            </Flex>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default DetectModal;
