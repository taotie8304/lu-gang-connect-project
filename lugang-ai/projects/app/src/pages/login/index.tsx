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

const Login = ({ defaultShareId }: { defaultShareId: string }) => {
  const router = useRouter();
  const { lastRoute = '' } = router.query as { lastRoute: string };
  const { t } = useTranslation();
  const { toast } = useToast();
  const { setUserInfo } = useUserStore();

  // 鲁港通：根据用户角色获取跳转路径
  // 管理员 (username === 'root') 跳转到管理后台，普通用户跳转到聊天界面
  const getDefaultRoute = useCallback((username: string) => {
    // 只有 root 用户才是管理员
    const isAdmin = username === 'root';
    if (isAdmin) {
      return '/dashboard/agent';
    }
    // 普通用户跳转到默认分享链接
    if (defaultShareId) {
      return `/chat/share?shareId=${defaultShareId}`;
    }
    // 如果没有配置分享链接，回退到首页让首页处理
    return '/';
  }, [defaultShareId]);

  const loginSuccess = useCallback(
    async (res: LoginSuccessResponse) => {
      setUserInfo(res.user);

      const decodeLastRoute = validateRedirectUrl(lastRoute);
      // 鲁港通：使用 username 判断是否为管理员
      const isAdmin = res.user.username === 'root';
      const defaultRoute = getDefaultRoute(res.user.username);

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
        if (isAdmin) {
          return defaultRoute;
        }

        // 普通用户：直接使用默认路径（分享链接）
        return defaultRoute;
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
      // 鲁港通：从服务端环境变量获取默认分享链接 ID
      defaultShareId: process.env.DEFAULT_SHARE_ID || '',
      ...(await serviceSideProps(context, ['app', 'user', 'login']))
    }
  };
}

export default Login;
