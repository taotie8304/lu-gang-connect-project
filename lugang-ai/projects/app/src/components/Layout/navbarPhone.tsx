import React, { useMemo } from 'react';
import { useRouter } from 'next/router';
import { Flex, Box } from '@chakra-ui/react';
import { useChatStore } from '@/web/core/chat/context/useChatStore';
import { useTranslation } from 'next-i18next';
import Badge from '../Badge';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useSystemStore } from '@/web/common/system/useSystemStore';

// 鲁港通 - 导航项类型（显式标注，避免 t() 返回值被推断为 never 导致 filteredList 重新赋值报 “string 不能赋给 never”）
type NavbarItem = {
  label: string;
  icon: string;
  activeIcon: string;
  link: string;
  activeLink: string[];
  unread: number;
  showForUser: boolean;
};

const NavbarPhone = ({ unread }: { unread: number }) => {
  const router = useRouter();
  const { userInfo } = useUserStore();
  const { feConfigs } = useSystemStore();
  const { t } = useTranslation();
  const { lastChatAppId, lastPane } = useChatStore();

  // 鲁港通 - 判断是否为管理员（团队所有者）
  const isOwner = userInfo?.team?.permission?.isOwner ?? false;
  // 鲁港通 - 是否启用纯聊天模式
  const enableUserChatOnly = !!feConfigs?.enableUserChatOnly;
  // 鲁港通 - 普通用户在纯聊天模式下隐藏管理功能
  const showAdminFeatures = isOwner || !enableUserChatOnly;

  const navbarList = useMemo(
    () => {
      const baseList: NavbarItem[] = [
        {
          label: t('common:navbar.Chat'),
          icon: 'core/chat/chatLight',
          activeIcon: 'core/chat/chatFill',
          link: `/chat?appId=${lastChatAppId}&pane=${lastPane}`,
          activeLink: ['/chat'],
          unread: 0,
          showForUser: true // 鲁港通 - 普通用户可见
        },
        {
          label: t('common:navbar.Studio'),
          icon: 'core/app/aiLight',
          activeIcon: 'core/app/aiFill',
          link: `/dashboard/agent`,
          activeLink: [
            '/dashboard/agent',
            '/app/detail',
            '/dashboard/tool',
            '/dashboard/tool/marketplace',
            '/dashboard/systemTool',
            '/dashboard/templateMarket',
            '/dashboard/mcpServer',
            '/dashboard/evaluation',
            '/dashboard/evaluation/create'
          ],
          unread: 0,
          showForUser: false // 鲁港通 - 仅管理员可见
        },
        {
          label: t('common:navbar.Datasets'),
          icon: 'core/dataset/datasetLight',
          activeIcon: 'core/dataset/datasetFill',
          link: `/dataset/list`,
          activeLink: ['/dataset/list', '/dataset/detail'],
          unread: 0,
          showForUser: false // 鲁港通 - 仅管理员可见
        },
        {
          label: t('common:navbar.Account'),
          icon: 'support/user/userLight',
          activeIcon: 'support/user/userFill',
          link: '/account/info',
          activeLink: [
            '/account/bill',
            '/account/info',
            '/account/team',
            '/account/usage',
            '/account/apikey',
            '/account/setting',
            '/account/inform',
            '/account/model'
          ],
          unread,
          showForUser: true // 鲁港通 - 普通用户可见
        }
      ];

      // 鲁港通 - 根据用户角色过滤导航项
      let filteredList = showAdminFeatures ? baseList : baseList.filter((item) => item.showForUser);

      // 鲁港通 - root 用户添加用户管理入口和配置入口
      if (userInfo?.username === 'root') {
        filteredList = [
          ...filteredList,
          {
            label: '用户管理',
            icon: 'support/team/memberLight',
            activeIcon: 'support/team/memberFill',
            link: '/admin/users',
            activeLink: ['/admin/users'],
            unread: 0,
            showForUser: false
          },
          {
            label: t('common:navbar.Config'),
            icon: 'support/config/configLight',
            activeIcon: 'support/config/configFill',
            link: '/config/plugin/tool',
            activeLink: ['/config/plugin/tool', '/config/plugin/marketplace', '/config/model'],
            unread: 0,
            showForUser: false
          }
        ];
      }

      return filteredList;
    },
    [lastChatAppId, lastPane, t, unread, userInfo?.username, showAdminFeatures]
  );

  return (
    <>
      <Flex
        alignItems={'center'}
        h={'100%'}
        justifyContent={'space-between'}
        backgroundColor={'white'}
        position={'relative'}
        px={4}
      >
        {navbarList.map((item) => (
          <Flex
            position={'relative'}
            key={item.link}
            cursor={'pointer'}
            borderRadius={'md'}
            textAlign={'center'}
            alignItems={'center'}
            h={'100%'}
            pt={1}
            px={3}
            transform={'scale(0.9)'}
            {...(item.activeLink.includes(router.pathname)
              ? {
                  color: 'primary.600'
                }
              : {
                  color: 'myGray.500'
                })}
            onClick={() => {
              if (item.link === router.asPath) return;
              if (item.link.startsWith('/chat')) {
                window.open(item.link, '_blank');
                return;
              }
              router.push(item.link);
            }}
          >
            <Badge isDot count={item.unread}>
              <MyIcon
                name={
                  (item.activeLink.includes(router.pathname) ? item.activeIcon : item.icon) as any
                }
                width={'20px'}
                height={'20px'}
              />
              <Box fontSize={'12px'}>{item.label}</Box>
            </Badge>
          </Flex>
        ))}
      </Flex>
    </>
  );
};

export default NavbarPhone;
