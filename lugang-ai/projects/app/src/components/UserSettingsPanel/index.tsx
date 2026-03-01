/**
 * 鲁港通 - 用户设置面板
 * 普通用户点击头像后显示的设置菜单
 */
import React, { useCallback } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  Flex,
  Text,
  Box
} from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import MyIcon from '@fastgpt/web/components/common/Icon';
import type { IconName } from '@fastgpt/web/components/common/Icon/type';
import { useUserStore } from '@/web/support/user/useUserStore';
import { clearToken } from '@/web/support/user/auth';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';

interface SettingsMenuItem {
  key: string;
  icon: IconName;
  label: string;
  onClick: () => void;
}

interface UserSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserSettingsPanel: React.FC<UserSettingsPanelProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { setUserInfo } = useUserStore();
  const { openConfirm, ConfirmModal } = useConfirm({ content: t('common:confirm_logout') });

  // 鲁港通：处理登出
  const handleLogout = useCallback(() => {
    setUserInfo(null);
    clearToken();
    router.replace('/login');
  }, [setUserInfo, router]);

  // 鲁港通：用户设置菜单项配置
  const menuItems: SettingsMenuItem[] = [
    {
      key: 'activityCenter',
      icon: 'core/chat/sidebar/home',
      label: '活動中心',
      onClick: () => {
        console.log('活動中心');
        // TODO: 实现活动中心功能
      }
    },
    {
      key: 'language',
      icon: 'common/language/zh',
      label: '語言',
      onClick: () => {
        console.log('語言');
        // TODO: 实现语言切换功能
      }
    },
    {
      key: 'changePassword',
      icon: 'support/user/key',
      label: '修改密碼',
      onClick: () => {
        console.log('修改密碼');
        // TODO: 实现修改密码功能
      }
    },
    {
      key: 'feedback',
      icon: 'feedback',
      label: '產品反饋',
      onClick: () => {
        // 打开邮件客户端
        window.location.href = 'mailto:service@airscend.com?subject=鲁港通产品反馈';
        onClose();
      }
    },
    {
      key: 'accessibility',
      icon: 'common/info',
      label: '輔助使用設計',
      onClick: () => {
        console.log('輔助使用設計');
        // TODO: 实现辅助使用设计弹窗
      }
    },
    {
      key: 'termsOfUse',
      icon: 'book',
      label: '使用條款',
      onClick: () => {
        console.log('使用條款');
        // TODO: 实现使用条款显示
      }
    },
    {
      key: 'privacyPolicy',
      icon: 'book',
      label: '隱私政策',
      onClick: () => {
        console.log('隱私政策');
        // TODO: 实现隐私政策显示
      }
    },
    {
      key: 'dataCollection',
      icon: 'book',
      label: '個人資料收集聲明',
      onClick: () => {
        console.log('個人資料收集聲明');
        // TODO: 实现个人资料收集声明显示
      }
    },
    {
      key: 'logout',
      icon: 'core/chat/sidebar/logout',
      label: '登出',
      onClick: () => {
        onClose();
        openConfirm({ onConfirm: handleLogout })();
      }
    }
  ];

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>設置</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={0} align="stretch">
              {menuItems.map((item, index) => (
                <React.Fragment key={item.key}>
                  <Flex
                    alignItems="center"
                    cursor="pointer"
                    _hover={{ bg: 'myGray.100' }}
                    py={3}
                    px={4}
                    borderRadius="md"
                    gap={3}
                    onClick={() => {
                      item.onClick();
                    }}
                    {...(item.key === 'logout' && { color: 'red.500' })}
                  >
                    <MyIcon name={item.icon} w="20px" h="20px" />
                    <Text fontSize="14px" fontWeight="500">
                      {item.label}
                    </Text>
                  </Flex>
                  {/* 在登出前添加分隔线 */}
                  {index === menuItems.length - 2 && (
                    <Box borderTop="1px solid" borderColor="myGray.200" my={2} />
                  )}
                </React.Fragment>
              ))}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
      <ConfirmModal />
    </>
  );
};

export default UserSettingsPanel;
