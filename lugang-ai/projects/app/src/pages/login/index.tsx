import React, { useCallback } from 'react';
import { useRouter } from 'next/router';
import { serviceSideProps } from '@/web/common/i18n/utils';
import { clearToken } from '@/web/support/user/auth';
import { useMount } from 'ahooks';
// 鲁港通 - N1：登录页改用带水墨画背景+宣传文字的官网首页版本（官方 LoginModal 保留给 chat 页登录门）
import LoginHeroModal from '@/pageComponents/login/LoginHeroModal';
import { postAcceptInvitationLink } from '@/web/support/user/team/api';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useTranslation } from 'next-i18next';
import { useUserStore } from '@/web/support/user/useUserStore';
import { subRoute } from '@fastgpt/web/common/system/utils';
import { validateRedirectUrl } from '@/web/common/utils/uri';
import type { LoginSuccessResponseType } from '@fastgpt/global/openapi/support/user/account/login/api';
import { useLoginRedirectAfterLogin } from '@/web/support/user/loginRedirect';

// 鲁港通 - 默认 AI 助手应用 ID：普通用户登录后直达该应用对话，不再经过工作台
const Login = ({ defaultAppId }: { defaultAppId: string }) => {
  const router = useRouter();
  const { lastRoute = '', lastTmbId = '' } = router.query as {
    lastRoute: string;
    lastTmbId?: string;
  };
  const { t } = useTranslation();
  const { toast } = useToast();
  const { setUserInfo } = useUserStore();
  const resolveLoginRedirect = useLoginRedirectAfterLogin();

  const loginSuccess = useCallback(
    async (res: LoginSuccessResponseType) => {
      const decodeLastRoute = validateRedirectUrl(lastRoute);

      const navigateTo = await (async () => {
        if (res.user.team.status !== 'active') {
          if (decodeLastRoute.includes('/account/team?invitelinkid=')) {
            const id = decodeLastRoute.split('invitelinkid=')[1];
            await postAcceptInvitationLink(id);
            return '/dashboard/agent';
          } else {
            toast({
              status: 'warning',
              title: t('common:not_active_team')
            });
          }
        }
        if (decodeLastRoute.startsWith(`${subRoute}/config`)) {
          return '/dashboard/agent';
        }

        return decodeLastRoute;
      })();

      // 鲁港通 - 普通用户登录后直达默认 AI 助手（团队应用仅管理员可见），管理员保持原跳转逻辑
      const defaultAppRoute =
        res.user.username !== 'root' && defaultAppId
          ? `/chat?appId=${defaultAppId}&pane=ra`
          : '';

      const targetRoute = defaultAppRoute
        ? defaultAppRoute
        : navigateTo
          ? await resolveLoginRedirect({
              user: res.user,
              fallbackRoute: navigateTo,
              lastTmbId
            })
          : undefined;

      setUserInfo(res.user);

      if (targetRoute) {
        router.replace(targetRoute);
      }
    },
    [lastRoute, lastTmbId, defaultAppId, resolveLoginRedirect, router, setUserInfo, t, toast]
  );

  useMount(() => {
    clearToken();
    router.prefetch('/dashboard/agent');
  });

  return <LoginHeroModal onSuccess={loginSuccess} />;
};

export async function getServerSideProps(context: any) {
  return {
    props: {
      // 鲁港通 - 注入默认 AI 助手应用 ID，供普通用户登录后直达
      defaultAppId: process.env.DEFAULT_APP_ID || '',
      ...(await serviceSideProps(context, ['app', 'user', 'login']))
    }
  };
}

export default Login;
