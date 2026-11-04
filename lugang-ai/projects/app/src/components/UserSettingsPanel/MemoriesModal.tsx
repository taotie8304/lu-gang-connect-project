// 鲁港通 - 「我的记忆」弹窗：在客户端内直接管理记忆，不再跳转 FastGPT 账号页
import React from 'react';
import { ModalBody } from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import MemoriesPanel from './MemoriesPanel';

const MemoriesModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { t } = useClientTranslation('account');

  return (
    <MyModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('account:memories')}
      size={'lg'}
      maxW={['90vw', '720px']}
    >
      <ModalBody py={4} overflowY={'auto'}>
        <MemoriesPanel />
      </ModalBody>
    </MyModal>
  );
};

export default MemoriesModal;
