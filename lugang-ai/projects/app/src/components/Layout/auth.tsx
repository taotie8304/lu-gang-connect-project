import { useRouter } from 'next/router';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'next-i18next';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useEffect, useState } from 'react';

// 无需登录即可访问的页面
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

/**
 * 鲁港通：管理员专属页面路径前缀
 * 只有 username === 'root' 的用户才能访问这些页面
 * 普通用户访问时会被重定向到聊天界面
 */
const adminOnlyPathPrefixes = [
  '/app',
  '/dashboard',
  '/dataset',
  '/plugin',
  '/toolkit',
  '/account',
  '/admin',
  '/config'
];

/**
 * 鲁港通：检查路径是否为管理员专属页面
 */
const isAdminOnlyPage = (pathname: string): boolean => {
  return adminOnlyPathPrefixes.some(prefix => pathname.startsWith(prefix));
};

const Auth = ({ children }: { children: JSX.Element | React.ReactNode }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const { userInfo, initUserInfo } = useUserStore();
  const [isAuthorized, setIsAuthorized] = useState(false);

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

  // 鲁港通：权限检查和重定向逻辑
  useEffect(() => {
    const pathname = router.pathname;
    
    // 无需登录的页面，直接授权
    if (unAuthPage[pathname]) {
      setIsAuthorized(true);
      return;
    }
    
    // 等待查询完成
    if (!isFetched) {
      setIsAuthorized(false);
      return;
    }

    // 如果用户信息为空，重定向到登录页
    if (!userInfo) {
      setIsAuthorized(false);
      toast({
        status: 'warning',
        title: t('common:support.user.Need to login')
      });
      const currentPath = router.asPath;
      router.replace(`/login?lastRoute=${encodeURIComponent(currentPath)}`);
      return;
    }

    // 鲁港通：检查管理员页面访问权限
    const isAdmin = userInfo.username === 'root';
    const currentPathIsAdminOnly = isAdminOnlyPage(pathname);

    if (currentPathIsAdminOnly && !isAdmin) {
      // 普通用户尝试访问管理员页面，重定向到首页（首页会处理跳转到聊天界面）
      setIsAuthorized(false);
      toast({
        status: 'warning',
        title: '您没有权限访问此页面'
      });
      router.replace('/');
      return;
    }

    // 通过所有检查，授权访问
    setIsAuthorized(true);
  }, [router.pathname, router.asPath, userInfo, isFetched, toast, t]);

  // 只有授权后才渲染子组件
  return isAuthorized ? <>{children}</> : null;
};

export default Auth;
