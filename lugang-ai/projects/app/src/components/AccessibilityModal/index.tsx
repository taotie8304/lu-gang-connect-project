/**
 * 鲁港通 - 辅助使用设计弹窗（无障碍说明）。
 * C7a-2：自 staging 移植；标题、正文、联系邮箱全部 i18n 化，邮箱走统一常量 LUGANG_SUPPORT_EMAIL（不再硬编码）。
 */
import React from 'react';
import { ModalBody, Text } from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { LUGANG_SUPPORT_EMAIL } from '@/web/common/system/constants';

type AccessibilityModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const AccessibilityModal = ({ isOpen, onClose }: AccessibilityModalProps) => {
  const { t } = useClientTranslation('common');

  return (
    <MyModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('common:user_settings.accessibility')}
      size="md"
    >
      <ModalBody py={5}>
        <Text fontSize="14px" lineHeight="1.8" color="myGray.900">
          {t('common:user_settings.accessibility_content', { email: LUGANG_SUPPORT_EMAIL })}
        </Text>
      </ModalBody>
    </MyModal>
  );
};

export default AccessibilityModal;
