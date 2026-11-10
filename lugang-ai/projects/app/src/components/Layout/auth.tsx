import { useRouter } from 'next/router';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'next-i18next';
import { useToast } from '@fastgpt/web/hooks/useToast';

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
  '/price': true,
  // 鲁港通 - 关于页是公开介绍页，未登录也必须可看；漏配白名单会被重定向回登录页（表现为点击「关于」没反应）
  '/about': true,
  // 鲁港通 - 帮助中心（首页 / 文章 / 法律）为公开页面，未登录可访问
  '/help': true,
  '/help/[slug]': true,
  '/help/legal': true
};

const Auth = ({ children }: { children: JSX.Element | React.ReactNode }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const { userInfo, initUserInfo } = useUserStore();
  const isUnAuthPage = unAuthPage[router.pathname] === true;

  useQuery(['initUserInfo'], initUserInfo, {
    enabled: !isUnAuthPage,
    refetchInterval: 10 * 60 * 1000,
    onError() {
      toast({
        status: 'warning',
        title: t('common:support.user.Need to login')
      });
    }
  });

  return !!userInfo || isUnAuthPage ? children : null;
};

export default Auth;
