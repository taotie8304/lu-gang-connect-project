import { serviceSideProps } from '@/web/common/i18n/utils';
import React, { useEffect, useState, useRef } from 'react';
import Loading from '@fastgpt/web/components/common/MyLoading';
import { useRouter } from 'next/router';
import { useUserStore } from '@/web/support/user/useUserStore';
import { Box, Text, Button, VStack } from '@chakra-ui/react';

/**
 * 鲁港通 - 首页路由组件
 * 根据用户角色决定跳转路径：
 * - 管理员 (root): 跳转到管理后台
 * - 普通用户: 跳转到默认 AI 助手聊天界面
 */
const Index = () => {
  const router = useRouter();
  const { userInfo, initUserInfo } = useUserStore();
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const hasInitialized = useRef(false);

  // 初始化用户信息
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const init = async () => {
      await initUserInfo();
      setIsReady(true);
    };

    init();
  }, [initUserInfo]);

  // 路由跳转逻辑
  useEffect(() => {
    // 等待初始化完成
    if (!isReady) {
      return;
    }

    // 如果用户未登录，跳转到登录页
    if (!userInfo) {
      router.replace('/login');
      return;
    }

    // 鲁港通：判断是否为管理员
    // 只有 username === 'root' 的用户才是管理员
    const isAdmin = userInfo.username === 'root';
    
    if (isAdmin) {
      // 管理员进入管理后台
      router.replace('/dashboard/agent');
      return;
    }

    // 普通用户：跳转到默认的 AI 助手分享链接
    const defaultShareId = process.env.NEXT_PUBLIC_DEFAULT_SHARE_ID;
    
    if (defaultShareId) {
      router.replace(`/chat/share?shareId=${defaultShareId}`);
    } else {
      // 如果没有配置默认分享链接，显示错误提示
      setError('系统尚未配置默认 AI 助手，请联系管理员。');
    }
  }, [router, userInfo, isReady]);

  // 显示错误提示
  if (error) {
    return (
      <Box 
        h="100vh" 
        display="flex" 
        alignItems="center" 
        justifyContent="center"
        bg="gray.50"
      >
        <VStack spacing={4} p={8} bg="white" borderRadius="lg" shadow="md">
          <Text fontSize="lg" color="gray.600">{error}</Text>
          <Text fontSize="sm" color="gray.400">
            联系邮箱：service@airscend.com
          </Text>
          <Button 
            colorScheme="blue" 
            onClick={() => {
              // 清除登录状态并跳转到登录页
              router.replace('/login');
            }}
          >
            返回登录
          </Button>
        </VStack>
      </Box>
    );
  }

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
