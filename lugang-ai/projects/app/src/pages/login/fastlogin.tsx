import React, { useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import type { LoginSuccessResponse } from '@/global/support/api/userRes.d';
import { useUserStore } from '@/web/support/user/useUserStore';
import { clearToken } from '@/web/support/user/auth';
import { postFastLogin } from '@/web/support/user/api';
import { useToast } from '@fastgpt/web/hooks/useToast';
import Loading from '@fastgpt/web/components/common/MyLoading';
import { serviceSideProps } from '@/web/common/i18n/utils';
import { getErrText } from '@fastgpt/global/common/error/utils';
import { useTranslation } from 'next-i18next';

const FastLogin = ({
  code,
  token
}: {
  code: string;
  token: string;
}) => {
  const { setUserInfo } = useUserStore();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();

  // 鲁港通：根据用户角色获取默认跳转路径
  const getDefaultRoute = useCallback((username: string) => {
    const isAdmin = username === 'root';
    if (isAdmin) {
      return '/dashboard/agent';
    }
    // 普通用户跳转到默认分享链接
    const defaultShareId = process.env.NEXT_PUBLIC_DEFAULT_SHARE_ID;
    if (defaultShareId) {
      return `/chat/share?shareId=${defaultShareId}`;
    }
    return '/';
  }, []);

  const loginSuccess = useCallback(
    (res: LoginSuccessResponse) => {
      setUserInfo(res.user);

      // 鲁港通：根据用户角色决定跳转路径
      const isAdmin = res.user.username === 'root';
      const targetUrl = isAdmin 
        ? '/dashboard/agent' 
        : getDefaultRoute(res.user.username);

      setTimeout(() => {
        router.push(targetUrl);
      }, 100);
    },
    [setUserInfo, router, getDefaultRoute]
  );

  const authCode = useCallback(
    async (code: string, token: string) => {
      try {
        const res = await postFastLogin({
          code,
          token
        });
        if (!res) {
          toast({
            status: 'warning',
            title: t('common:support.user.login.error')
          });
          return setTimeout(() => {
            router.replace('/login');
          }, 1000);
        }
        loginSuccess(res);
      } catch (error) {
        toast({
          status: 'warning',
          title: getErrText(error, t('common:support.user.login.error'))
        });
        setTimeout(() => {
          router.replace('/login');
        }, 1000);
      }
    },
    [loginSuccess, router, t, toast]
  );

  useEffect(() => {
    clearToken();
    router.prefetch('/dashboard/agent');
    router.prefetch('/chat');
    authCode(code, token);
  }, [authCode, code, router, token]);

  return <Loading />;
};

export async function getServerSideProps(content: any) {
  return {
    props: {
      code: content?.query?.code || '',
      token: content?.query?.token || '',
      ...(await serviceSideProps(content))
    }
  };
}

export default FastLogin;
