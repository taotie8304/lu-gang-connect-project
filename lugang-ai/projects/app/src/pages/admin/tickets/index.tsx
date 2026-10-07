'use client';
/**
 * 鲁港通 - 工单管理页面（仅 root）
 *
 * 管理台统一处理用户工单：概览统计、队列筛选搜索、对话流回复与状态流转。
 * 守卫口径与后端 isRoot 一致（username === 'root'），保证入口与接口权限对齐。
 */
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serviceSideProps } from '@/web/common/i18n/utils';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useToast } from '@fastgpt/web/hooks/useToast';
import MyBox from '@fastgpt/web/components/common/MyBox';
import AdminTickets from '@/pageComponents/admin/tickets';

const AdminTicketsPage = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { userInfo } = useUserStore();
  const { toast } = useToast();

  const isRoot = userInfo?.username === 'root';

  useEffect(() => {
    if (!userInfo) {
      router.replace('/login?lastRoute=/admin/tickets');
      return;
    }
    if (!isRoot) {
      toast({ status: 'warning', title: t('common:admin_user.no_permission') });
      router.replace('/chat');
    }
  }, [userInfo, router, toast, isRoot, t]);

  return (
    <MyBox h="100%" p={6} bg="white">
      <AdminTickets />
    </MyBox>
  );
};

export async function getServerSideProps(context: any) {
  return {
    props: {
      ...(await serviceSideProps(context, ['app', 'user', 'ticket']))
    }
  };
}

export default AdminTicketsPage;
