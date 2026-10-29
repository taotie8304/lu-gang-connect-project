'use client';
/**
 * 鲁港通 - 桌面客户端运维页（仅 root）
 *
 * 集中管理桌面端：AI 操控开关、设备绑定与崩溃报告。
 * 守卫口径与后端 isRoot 一致（username === 'root'），保证入口与接口权限对齐。
 */
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serviceSideProps } from '@/web/common/i18n/utils';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useToast } from '@fastgpt/web/hooks/useToast';
import MyBox from '@fastgpt/web/components/common/MyBox';
import AdminDesktop from '@/pageComponents/admin/desktop';

const AdminDesktopPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { userInfo } = useUserStore();
  const { toast } = useToast();

  const isRoot = userInfo?.username === 'root';

  useEffect(() => {
    if (!userInfo) {
      router.replace('/login?lastRoute=/admin/desktop');
      return;
    }
    if (!isRoot) {
      toast({ status: 'warning', title: t('common:admin_user.no_permission') });
      router.replace('/chat');
    }
  }, [userInfo, router, toast, isRoot, t]);

  return (
    <MyBox h="100%" p={6} bg="white">
      <AdminDesktop />
    </MyBox>
  );
};

export async function getServerSideProps(context: any) {
  return {
    props: {
      ...(await serviceSideProps(context, ['app', 'user']))
    }
  };
}

export default AdminDesktopPage;
