import { useSystemStore } from '@/web/common/system/useSystemStore';
import React, { useEffect, useState } from 'react';
import ProModal from './ProModal';
import { Box } from '@chakra-ui/react';

const ProText = ({ children, signKey }: { children: React.ReactNode; signKey: string }) => {
  const { feConfigs } = useSystemStore();

  const [isOpen, setIsOpen] = useState(false);

  const key = `proTip_${signKey}_lastShown`;

  // 鲁港通 - 隐藏升级提示
  return null;
};

export default ProText;
