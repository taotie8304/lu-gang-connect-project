import React, { useCallback } from 'react';
import { useRouter } from 'next/router';
import { serviceSideProps } from '@/web/common/i18n/utils';
import { clearToken } from '@/web/support/user/auth';
import { useMount } from 'ahooks';
import LoginModal from '@/pageComponents/login/LoginModal';
import { postAcceptInvitationLink } from '@/web/support/user/team/api';
import type { LoginSuccessResponse } from '@/global/support/api/userRes';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useTranslation } from 'next-i18next';
import { useUserStore } from '@/web/support/user/useUserStore';
import { subRoute } from '@fastgpt/web/common/system/utils';
import { validateRedirectUrl } from '@/web/common/utils/uri';
import { useSystemStore } from '@/web/common/system/useSystemStore';

const Login = () => {
  const router = useRouter();
  const { lastRoute = '' } = router.query as { lastRoute: string };
  const { t } = useTranslation();
  const { toast } = useToast();
  const { setUserInfo } = useUserStore();
  const { feConfigs } = useSystemStore();

  // 鲁港通：根据用户角色获取跳转路径
  // 管理员（团队所有者）直接跳转到管理后台，普通用户跳转到聊天界面
  const getDefaultRoute = useCallback((isOwner: boolean) => {
    // 管理员始终跳转到管理后台
    if (isOwner) {
      return '/dashboard/agent';
    }
    // 普通用户根据配置决定跳转路径
    return feConfigs?.enableUserChatOnly ? '/chat' : '/dashboard/agent';
  }, [feConfigs?.enableUserChatOnly]);

  const loginSuccess = useCallback(
    async (res: LoginSuccessResponse) => {
      setUserInfo(res.user);

      const decodeLastRoute = validateRedirectUrl(lastRoute);
      // 鲁港通：判断是否为管理员（团队所有者）
      const isOwner = res.user.permission?.isOwner ?? false;
      const defaultRoute = getDefaultRoute(isOwner);

      const navigateTo = await (async () => {
        if (res.user.team.status !== 'active') {
          if (decodeLastRoute.includes('/account/team?invitelinkid=')) {
            const id = decodeLastRoute.split('invitelinkid=')[1];
            await postAcceptInvitationLink(id);
            return defaultRoute;
          } else {
            toast({
              status: 'warning',
              title: t('common:not_active_team')
            });
          }
        }
        if (decodeLastRoute.startsWith(`${subRoute}/config`)) {
          return defaultRoute;
        }

        // 鲁港通：管理员始终跳转到管理后台，忽略 lastRoute
        if (isOwner) {
          return defaultRoute;
        }

        // 普通用户：如果没有指定 lastRoute，使用默认路径
        return decodeLastRoute || defaultRoute;
      })();

      navigateTo && router.replace(navigateTo);
    },
    [lastRoute, router, setUserInfo, t, toast, getDefaultRoute]
  );

  useMount(() => {
    clearToken();
    // 预加载两个可能的路由
    router.prefetch('/dashboard/agent');
    router.prefetch('/chat');
  });

  return <LoginModal onSuccess={loginSuccess} />;
};

export async function getServerSideProps(context: any) {
  return {
    props: {
      ...(await serviceSideProps(context, ['app', 'user', 'login']))
    }
  };
}

export default Login;
