import { ModalBody, Flex, Box, VStack, Button } from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { getDocPath } from '@/web/common/system/doc';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useTranslation } from 'next-i18next';
import { useState } from 'react';

const ProModal = (props: { isOpen?: boolean; onClose?: () => void }) => {
  const { t } = useTranslation();
  const { feConfigs } = useSystemStore();

  const [isOpen, setIsOpen] = useState(false);

  const openModal = props?.isOpen ?? isOpen;
  const onClose = props?.onClose ?? (() => setIsOpen(false));

  // 鲁港通 - 隐藏升级提示
  return null;
};

export default ProModal;
