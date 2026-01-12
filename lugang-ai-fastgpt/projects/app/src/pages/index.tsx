import { serviceSideProps } from '@/web/common/i18n/utils';
import React, { useEffect } from 'react';
import Loading from '@fastgpt/web/components/common/MyLoading';
import { useRouter } from 'next/router';
import { useSystemStore } from '@/web/common/system/useSystemStore';

const Index = () => {
  const router = useRouter();
  const { feConfigs } = useSystemStore();

  useEffect(() => {
    // 鲁港通：启用纯聊天模式时，直接跳转到聊天界面
    if (feConfigs?.enableUserChatOnly) {
      router.push('/chat');
    } else {
      router.push('/dashboard/agent');
    }
  }, [router, feConfigs?.enableUserChatOnly]);

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
