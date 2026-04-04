/**
 * 鲁港通 - 用户设置面板
 * 普通用户点击头像后显示的设置菜单
 */
import React, { useCallback, useState } from 'react';
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
import LanguageSelector from '@/components/LanguageSelector';
import UpdatePswModal from '@/pageComponents/account/info/UpdatePswModal';
import AccessibilityModal from '@/components/AccessibilityModal';
import SystemContentModal from '@/components/SystemContentModal';
import ActivityListModal from '@/components/ActivityListModal';
import AccountInfoModal from '@/components/AccountInfoModal';
import { SystemContentKeyEnum } from '@fastgpt/global/support/systemContent/constant';

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
  const { t } = useTranslation(['common', 'system_content']);
  const router = useRouter();
  const { setUserInfo } = useUserStore();
  const { openConfirm, ConfirmModal } = useConfirm({ content: t('common:confirm_logout') });

  // 鲁港通：语言选择器状态
  const [isLanguageSelectorOpen, setIsLanguageSelectorOpen] = useState(false);
  
  // 鲁港通：密码修改弹窗状态
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  
  // 鲁港通：辅助使用设计弹窗状态
  const [isAccessibilityModalOpen, setIsAccessibilityModalOpen] = useState(false);

  // 鲁港通：活动中心弹窗状态
  const [isActivityListModalOpen, setIsActivityListModalOpen] = useState(false);

  // 鲁港通：账户信息弹窗状态
  const [isAccountInfoModalOpen, setIsAccountInfoModalOpen] = useState(false);

  // 鲁港通：系统内容弹窗状态
  const [systemContentModal, setSystemContentModal] = useState<{
    isOpen: boolean;
    contentKey: `${SystemContentKeyEnum}` | null;
    title: string;
  }>({
    isOpen: false,
    contentKey: null,
    title: ''
  });

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
      label: t('common:user_settings.activity_center'),
      onClick: () => {
        setIsActivityListModalOpen(true);
      }
    },
    {
      key: 'accountInfo',
      icon: 'support/pay/payRecordLight',
      label: t('common:user_settings.account_info'),
      onClick: () => {
        setIsAccountInfoModalOpen(true);
      }
    },
    {
      key: 'language',
      icon: 'common/language/zh',
      label: t('common:user_settings.language'),
      onClick: () => {
        setIsLanguageSelectorOpen(true);
      }
    },
    {
      key: 'changePassword',
      icon: 'support/user/key',
      label: t('common:user_settings.change_password'),
      onClick: () => {
        setIsPasswordModalOpen(true);
      }
    },
    {
      key: 'feedback',
      icon: 'feedback',
      label: t('common:user_settings.product_feedback'),
      onClick: () => {
        // 打开邮件客户端
        window.location.href = 'mailto:service@airscend.com?subject=鲁港通产品反馈';
        onClose();
      }
    },
    {
      key: 'accessibility',
      icon: 'common/info',
      label: t('common:user_settings.accessibility'),
      onClick: () => {
        setIsAccessibilityModalOpen(true);
      }
    },
    {
      key: 'termsOfUse',
      icon: 'book',
      label: t('system_content:terms_of_use'),
      onClick: () => {
        setSystemContentModal({
          isOpen: true,
          contentKey: SystemContentKeyEnum.termsOfUse,
          title: t('system_content:terms_of_use')
        });
      }
    },
    {
      key: 'privacyPolicy',
      icon: 'book',
      label: t('system_content:privacy_policy'),
      onClick: () => {
        setSystemContentModal({
          isOpen: true,
          contentKey: SystemContentKeyEnum.privacyPolicy,
          title: t('system_content:privacy_policy')
        });
      }
    },
    {
      key: 'dataCollection',
      icon: 'book',
      label: t('system_content:data_collection'),
      onClick: () => {
        setSystemContentModal({
          isOpen: true,
          contentKey: SystemContentKeyEnum.dataCollection,
          title: t('system_content:data_collection')
        });
      }
    },
    {
      key: 'logout',
      icon: 'core/chat/sidebar/logout',
      label: t('common:user_settings.logout'),
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
          <ModalHeader>{t('common:user_settings.title')}</ModalHeader>
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
      {/* 鲁港通：语言选择器 */}
      <LanguageSelector
        isOpen={isLanguageSelectorOpen}
        onClose={() => setIsLanguageSelectorOpen(false)}
      />
      {/* 鲁港通：密码修改弹窗 */}
      {isPasswordModalOpen && (
        <UpdatePswModal onClose={() => setIsPasswordModalOpen(false)} />
      )}
      {/* 鲁港通：辅助使用设计弹窗 */}
      <AccessibilityModal
        isOpen={isAccessibilityModalOpen}
        onClose={() => setIsAccessibilityModalOpen(false)}
      />
      {/* 鲁港通：活动中心弹窗 */}
      <ActivityListModal
        isOpen={isActivityListModalOpen}
        onClose={() => setIsActivityListModalOpen(false)}
      />
      {/* 鲁港通：系统内容弹窗 */}
      {systemContentModal.isOpen && systemContentModal.contentKey && (
        <SystemContentModal
          isOpen={systemContentModal.isOpen}
          onClose={() =>
            setSystemContentModal({ isOpen: false, contentKey: null, title: '' })
          }
          contentKey={systemContentModal.contentKey}
          title={systemContentModal.title}
        />
      )}
      {/* 鲁港通：账户信息弹窗 */}
      <AccountInfoModal
        isOpen={isAccountInfoModalOpen}
        onClose={() => setIsAccountInfoModalOpen(false)}
      />
    </>
  );
};

export default UserSettingsPanel;
