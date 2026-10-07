/**
 * 鲁港通 - 用户设置面板（C7a 骨架）。
 * 非 root 普通用户点击头像后打开的设置菜单。开源版普通用户无法进入 account/dashboard 后台，
 * 故在此集中提供语言切换、修改密码、工单反馈、辅助使用设计、登出等基础入口。
 *
 * C7a 仅实现 5 个「零依赖」入口（全部复用官方组件/常量，无需新后端）。
 * D10（商业化）与 D11（系统内容多语言）依赖的入口已在 menuItems 中预留插入点注释，待对应域实现后补入。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ModalBody, Flex, Text, Box } from '@chakra-ui/react';
import { useRouter } from 'next/router';
import MyModal from '@fastgpt/web/components/common/MyModal';
import MyIcon from '@fastgpt/web/components/common/Icon';
import type { IconNameType } from '@fastgpt/web/components/common/Icon/type';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useConfirm } from '@fastgpt/web/hooks/useConfirm';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import Badge from '@/components/Badge';
import { useUserStore } from '@/web/support/user/useUserStore';
import { clearToken } from '@/web/support/user/auth';
import { getTicketUnreadCount } from '@/web/support/ticket/api';
import UpdatePswModal from '@/pageComponents/account/info/UpdatePswModal';
import AccessibilityModal from '@/components/AccessibilityModal';
import SystemContentModal from '@/components/SystemContentModal';
import { SystemContentKeyEnum } from '@fastgpt/global/support/systemContent/constant';
import LanguageMenuItems from '@/pageComponents/chat/LanguageSelector/LanguageMenuItems';
import { useChatLanguageSwitch } from '@/pageComponents/chat/LanguageSelector/useChatLanguageSwitch';

type UserSettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

type SettingsMenuItem = {
  key: string;
  icon: IconNameType;
  label: string;
  onClick: () => void;
};

const UserSettingsPanel = ({ isOpen, onClose }: UserSettingsPanelProps) => {
  const { t } = useClientTranslation();
  const router = useRouter();
  const { setUserInfo } = useUserStore();
  const { openConfirm, ConfirmModal } = useConfirm({ content: t('common:confirm_logout') });
  const { currentLang, onChangeLanguage } = useChatLanguageSwitch('account');

  // 鲁港通 - 修改密码/辅助使用弹窗、语言子列表展开状态
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isAccessibilityModalOpen, setIsAccessibilityModalOpen] = useState(false);
  const [isLanguageExpanded, setIsLanguageExpanded] = useState(false);

  // 鲁港通 - D11 系统内容弹窗状态（使用条款/隐私政策/资料收集声明）
  const [systemContentModal, setSystemContentModal] = useState<{
    isOpen: boolean;
    contentKey: `${SystemContentKeyEnum}` | null;
    title: string;
  }>({ isOpen: false, contentKey: null, title: '' });

  // 鲁港通 - 批2-C：工单未读红点（面板常挂载，每次打开时刷新一次）
  const { data: ticketUnreadData, refresh: refreshTicketUnread } = useRequest(getTicketUnreadCount, {
    manual: false,
    errorToast: ''
  });
  const ticketUnread = ticketUnreadData?.count ?? 0;
  useEffect(() => {
    if (isOpen) refreshTicketUnread();
  }, [isOpen, refreshTicketUnread]);

  const handleLogout = useCallback(() => {
    setUserInfo(null);
    clearToken();
    router.replace('/login');
  }, [setUserInfo, router]);

  // 鲁港通 - 批2-C：产品反馈升级为站内工单系统，点击直达「我的工单」页（不再走邮箱）。
  const handleTicketFeedback = useCallback(() => {
    onClose();
    router.push('/account/myTickets');
  }, [onClose, router]);

  // 鲁港通 - 设置菜单入口。D11 已补入使用条款/隐私政策/资料收集声明（走 SystemContentModal + /api/system/content/[key]，正文按 getLocale 多语言）。
  // D10 商业化一期：订阅套餐 / 我的订单 / 用量明细 三个入口前置（普通用户付款与消费可见性的唯一入口）。
  // TODO(D10 商业化二期)：在此数组补充「活动中心 activityCenter」「账户信息 accountInfo」——
  //   依赖 /api/user/profile、One API 额度/活动接口与 AccountInfoModal、ActivityListModal 组件（4.16.2 尚缺，须新建）。
  const menuItems: SettingsMenuItem[] = [
    {
      key: 'subscription',
      icon: 'support/account/plans',
      label: t('common:user_settings.my_subscription'),
      onClick: () => {
        onClose();
        router.push('/price');
      }
    },
    {
      key: 'myOrders',
      icon: 'common/billing',
      label: t('common:user_settings.my_orders'),
      onClick: () => {
        onClose();
        router.push('/account/bill');
      }
    },
    {
      key: 'usageDetail',
      icon: 'chart',
      label: t('common:user_settings.usage_detail'),
      onClick: () => {
        onClose();
        router.push('/account/usage');
      }
    },
    {
      key: 'language',
      icon: 'common/language/zh',
      label: t('common:user_settings.language'),
      onClick: () => setIsLanguageExpanded(!isLanguageExpanded)
    },
    {
      key: 'changePassword',
      icon: 'core/workflow/inputType/password',
      label: t('common:user_settings.change_password'),
      onClick: () => setIsPasswordModalOpen(true)
    },
    {
      key: 'ticketFeedback',
      icon: 'common/quickActionFeedback',
      label: t('common:user_settings.ticket_feedback'),
      onClick: handleTicketFeedback
    },
    {
      key: 'accessibility',
      icon: 'common/info',
      label: t('common:user_settings.accessibility'),
      onClick: () => setIsAccessibilityModalOpen(true)
    },
    // 鲁港通 - D11 系统内容（法律条款）三项，点击打开 SystemContentModal
    {
      key: 'termsOfUse',
      icon: 'book',
      label: t('common:system_content.terms_of_use'),
      onClick: () =>
        setSystemContentModal({
          isOpen: true,
          contentKey: SystemContentKeyEnum.termsOfUse,
          title: t('common:system_content.terms_of_use')
        })
    },
    {
      key: 'privacyPolicy',
      icon: 'book',
      label: t('common:system_content.privacy_policy'),
      onClick: () =>
        setSystemContentModal({
          isOpen: true,
          contentKey: SystemContentKeyEnum.privacyPolicy,
          title: t('common:system_content.privacy_policy')
        })
    },
    {
      key: 'dataCollection',
      icon: 'book',
      label: t('common:system_content.data_collection'),
      onClick: () =>
        setSystemContentModal({
          isOpen: true,
          contentKey: SystemContentKeyEnum.dataCollection,
          title: t('common:system_content.data_collection')
        })
    },
    // 鲁港通 - N4 支付法律文档两项（付费服务协议 / 支付隐私政策），与上方法律条款同机制
    {
      key: 'paidServiceAgreement',
      icon: 'book',
      label: t('common:system_content.paid_service_agreement'),
      onClick: () =>
        setSystemContentModal({
          isOpen: true,
          contentKey: SystemContentKeyEnum.paidServiceAgreement,
          title: t('common:system_content.paid_service_agreement')
        })
    },
    {
      key: 'paymentPrivacyPolicy',
      icon: 'book',
      label: t('common:system_content.payment_privacy_policy'),
      onClick: () =>
        setSystemContentModal({
          isOpen: true,
          contentKey: SystemContentKeyEnum.paymentPrivacyPolicy,
          title: t('common:system_content.payment_privacy_policy')
        })
    },
    {
      key: 'logout',
      icon: 'core/chat/sidebar/logout',
      label: t('common:logout'),
      onClick: () => {
        onClose();
        openConfirm({ onConfirm: handleLogout })();
      }
    }
  ];

  return (
    <>
      <MyModal isOpen={isOpen} onClose={onClose} title={t('common:user_settings.title')} size="md">
        <ModalBody py={4}>
          <Flex direction="column" gap={1}>
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
                  onClick={item.onClick}
                  {...(item.key === 'logout' ? { color: 'red.500' } : {})}
                >
                  <Badge count={item.key === 'ticketFeedback' ? ticketUnread : 0} max={99}>
                    <MyIcon name={item.icon} w="20px" h="20px" />
                  </Badge>
                  <Text fontSize="14px" fontWeight="500">
                    {item.label}
                  </Text>
                </Flex>

                {/* 鲁港通 - 语言项展开时内联官方语言列表（复用 LanguageMenuItems，无需嵌套弹窗） */}
                {item.key === 'language' && isLanguageExpanded && (
                  <Box pl={12} pr={4} pb={2}>
                    <LanguageMenuItems
                      currentLang={currentLang}
                      variant="list"
                      onSelect={(lng) => onChangeLanguage(lng, () => setIsLanguageExpanded(false))}
                    />
                  </Box>
                )}

                {/* 鲁港通 - 登出前分隔线 */}
                {index === menuItems.length - 2 && (
                  <Box borderTop="1px solid" borderColor="myGray.200" my={2} />
                )}
              </React.Fragment>
            ))}
          </Flex>
        </ModalBody>
      </MyModal>

      <ConfirmModal />

      {/* 鲁港通 - 修改密码（复用官方 UpdatePswModal） */}
      {isPasswordModalOpen && <UpdatePswModal onClose={() => setIsPasswordModalOpen(false)} />}

      {/* 鲁港通 - 辅助使用设计弹窗 */}
      <AccessibilityModal
        isOpen={isAccessibilityModalOpen}
        onClose={() => setIsAccessibilityModalOpen(false)}
      />

      {/* 鲁港通 - D11 系统内容弹窗（使用条款/隐私政策/资料收集声明） */}
      {systemContentModal.isOpen && systemContentModal.contentKey && (
        <SystemContentModal
          isOpen={systemContentModal.isOpen}
          onClose={() => setSystemContentModal({ isOpen: false, contentKey: null, title: '' })}
          contentKey={systemContentModal.contentKey}
          title={systemContentModal.title}
        />
      )}
    </>
  );
};

export default UserSettingsPanel;
