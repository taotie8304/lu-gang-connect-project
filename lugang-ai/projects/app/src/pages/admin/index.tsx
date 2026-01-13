import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { serviceSideProps } from '@/web/common/i18n/utils';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useTranslation } from 'next-i18next';
import Loading from '@fastgpt/web/components/common/MyLoading';

/**
 * 鲁港通管理后台入口页面
 * 仅管理员可访问，非管理员重定向到聊天界面
 */
const AdminIndex = () => {
  const router = useRouter();
  const { userInfo } = useUserStore();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    // 未登录，跳转到登录页
    if (!userInfo) {
      router.replace('/login?lastRoute=/admin');
      return;
    }

    // 检查是否为管理员
    const isAdmin = userInfo?.team?.permission?.hasManagePer;

    if (isAdmin) {
      // 管理员跳转到管理后台
      router.replace('/dashboard/agent');
    } else {
      // 非管理员显示提示并跳转到聊天界面
      toast({
        status: 'warning',
        title: t('common:permission.no_permission') || '您没有管理员权限'
      });
      router.replace('/chat');
    }
  }, [userInfo, router, toast, t]);

  return <Loading />;
};

export async function getServerSideProps(context: any) {
  return {
    props: {
      ...(await serviceSideProps(context, ['app', 'user']))
    }
  };
}

export default AdminIndex;
