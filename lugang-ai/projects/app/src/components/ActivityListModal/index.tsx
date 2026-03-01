/**
 * 鲁港通 - 活动中心弹窗
 * 显示当前有效的营销活动列表
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
  VStack,
  Text,
  Image,
  Link,
  Spinner,
  Center,
  Flex,
  Badge
} from '@chakra-ui/react';
import type { ActivityResponse } from '@fastgpt/global/support/activity/type';

interface ActivityListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ActivityListModal: React.FC<ActivityListModalProps> = ({ isOpen, onClose }) => {
  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/support/activity/list');

      if (!response.ok) {
        throw new Error('獲取活動失敗');
      }

      const data = await response.json();
      setActivities(data || []);
    } catch (err: any) {
      console.error('鲁港通：获取活动列表失败', { error: err.message });
      setError('獲取活動失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchActivities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="80vh">
        <ModalHeader>活動中心</ModalHeader>
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
          ) : activities.length === 0 ? (
            <Center py={10}>
              <Text color="gray.500" fontSize="14px">
                暫無活動
              </Text>
            </Center>
          ) : (
            <VStack spacing={4} align="stretch">
              {activities.map((activity) => (
                <Box
                  key={activity._id}
                  p={4}
                  borderWidth="1px"
                  borderColor="gray.200"
                  borderRadius="md"
                  _hover={{ bg: 'gray.50' }}
                  transition="background 0.2s"
                >
                  {activity.image && (
                    <Image
                      src={activity.image}
                      alt={activity.title}
                      maxH="200px"
                      w="100%"
                      objectFit="cover"
                      borderRadius="md"
                      mb={3}
                    />
                  )}
                  
                  <Flex justify="space-between" align="start" mb={2}>
                    <Text fontSize="16px" fontWeight="600">
                      {activity.title}
                    </Text>
                    <Badge colorScheme="green" fontSize="xs">
                      進行中
                    </Badge>
                  </Flex>

                  <Text fontSize="14px" color="gray.600" mb={2} noOfLines={3}>
                    {activity.description}
                  </Text>

                  <Flex justify="space-between" align="center" fontSize="12px" color="gray.500">
                    <Text>
                      {formatDate(activity.startDate)} - {formatDate(activity.endDate)}
                    </Text>
                    {activity.link && (
                      <Link
                        href={activity.link}
                        color="primary.600"
                        fontWeight="500"
                        isExternal
                      >
                        查看詳情 →
                      </Link>
                    )}
                  </Flex>
                </Box>
              ))}
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default ActivityListModal;
