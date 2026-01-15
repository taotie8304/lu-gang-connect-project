import { useRouter } from 'next/router';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'next-i18next';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useEffect } from 'react';

const unAuthPage: { [key: string]: boolean } = {
  '/': true,
  '/login': true,
  '/login/provider': true,
  '/login/fastlogin': true,
  '/login/sso': true,
  '/appStore': true,
  '/chat': true,
  '/chat/share': true,
  '/tools/price': true,
  '/price': true
};

const Auth = ({ children }: { children: JSX.Element | React.ReactNode }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const { userInfo, initUserInfo } = useUserStore();

  const { isFetched } = useQuery(
    [router.pathname],
    () => {
      if (unAuthPage[router.pathname] === true) {
        return null;
      } else {
        return initUserInfo();
      }
    },
    {
      refetchInterval: 10 * 60 * 1000,
      retry: false
    }
  );

  // 鲁港通：用户未登录时重定向到登录页
  useEffect(() => {
    if (unAuthPage[router.pathname]) {
      return;
    }
    
    // 等待查询完成
    if (!isFetched) {
      return;
    }

    // 如果用户信息为空，重定向到登录页
    if (!userInfo) {
      toast({
        status: 'warning',
        title: t('common:support.user.Need to login')
      });
      const currentPath = router.asPath;
      router.replace(`/login?lastRoute=${encodeURIComponent(currentPath)}`);
    }
  }, [router, userInfo, isFetched, toast, t]);

  return !!userInfo || unAuthPage[router.pathname] === true ? children : null;
};

export default Auth;
