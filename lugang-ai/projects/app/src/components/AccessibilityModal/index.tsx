/**
 * 鲁港通 - 辅助使用设计弹窗
 * 显示无障碍功能说明
 */
import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Text,
  Box
} from '@chakra-ui/react';

interface AccessibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AccessibilityModal: React.FC<AccessibilityModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>輔助使用設計</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Box>
            <Text fontSize="14px" lineHeight="1.8">
              本流動用應用程式已適當地採用輔助使用設計。如對本流動應用程式在使用上有任何查詢或意見，請發送電郵地址至 service@airscend.com 與我們聯繫。
            </Text>
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AccessibilityModal;
