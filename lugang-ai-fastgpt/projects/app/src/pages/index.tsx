import { serviceSideProps } from '@/web/common/i18n/utils';
import React, { useEffect } from 'react';
import Loading from '@fastgpt/web/components/common/MyLoading';
import { useRouter } from 'next/router';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useUserStore } from '@/web/support/user/useUserStore';

const Index = () => {
  const router = useRouter();
  const { feConfigs } = useSystemStore();
  const { userInfo } = useUserStore();

  useEffect(() => {
    // 鲁港通：根据用户角色决定跳转路径
    // 如果用户未登录，跳转到登录页
    if (!userInfo) {
      router.replace('/login');
      return;
    }

    // 管理员（团队所有者）直接跳转到管理后台
    const isOwner = userInfo.permission?.isOwner ?? false;
    if (isOwner) {
      router.replace('/dashboard/agent');
      return;
    }

    // 普通用户：根据配置决定跳转路径
    if (feConfigs?.enableUserChatOnly) {
      router.replace('/chat');
    } else {
      router.replace('/dashboard/agent');
    }
  }, [router, feConfigs?.enableUserChatOnly, userInfo]);

  return <Loading />;
};

export async function getServerSideProps(content: any) {
  return {
    props: {
      ...(await serviceSideProps(content))
    }
  };
}

export default Index;
