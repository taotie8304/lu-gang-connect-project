import React, { useState, useEffect } from 'react';
import { useContextSelector } from 'use-context-selector';
import { ChatBoxContext } from '../../Provider';
import { DEFAULT_LOGO_BANNER_URL } from '@/pageComponents/chat/constants';
import { Box, Flex, Image, Grid, Button } from '@chakra-ui/react';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import MyIcon from '@fastgpt/web/components/common/Icon';

// 鲁港通默认欢迎语配置（普通话/粤语交替）
const LUGANG_SLOGANS: Record<string, string> = {
  'zh-CN': '你好，我是鲁港通跨境AI服务助手，请问今天我可以帮您做些什么呢？',
  'zh-Hant': '你好，請問今日有咩可以幫到你呀？',
  'en': 'Hello, I am Lugang Connect AI Assistant. How can I help you today?'
};

// 鲁港通快捷功能按钮配置
const LUGANG_QUICK_ACTIONS = [
  {
    id: 'translate',
    icon: 'core/chat/chatLight',
    label: '翻译助手',
    labelHant: '翻譯助手',
    prompt: '请帮我翻译以下内容：'
  },
  {
    id: 'business',
    icon: 'core/app/aiLight',
    label: '商务咨询',
    labelHant: '商務諮詢',
    prompt: '我想咨询关于跨境商务的问题：'
  },
  {
    id: 'policy',
    icon: 'core/dataset/datasetLight',
    label: '政策解读',
    labelHant: '政策解讀',
    prompt: '请帮我解读以下政策：'
  },
  {
    id: 'culture',
    icon: 'support/user/userLight',
    label: '文化交流',
    labelHant: '文化交流',
    prompt: '我想了解关于鲁港文化交流的信息：'
  }
];

const WelcomeHomeBox = () => {
  const wideLogo = useContextSelector(ChatBoxContext, (v) => v.wideLogo);
  const slogan = useContextSelector(ChatBoxContext, (v) => v.slogan);
  const { feConfigs } = useSystemStore();
  
  // 是否启用鲁港通纯聊天模式
  const enableUserChatOnly = !!feConfigs?.enableUserChatOnly;
  
  // 语言切换状态（普通话/粤语交替）
  const [currentLang, setCurrentLang] = useState<string>('zh-CN');
  const [isVisible, setIsVisible] = useState(true);
  
  // 语言切换效果
  useEffect(() => {
    if (!enableUserChatOnly) return;
    
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentLang((prev) => prev === 'zh-CN' ? 'zh-Hant' : 'zh-CN');
        setIsVisible(true);
      }, 300);
    }, 4000); // 每4秒切换一次
    
    return () => clearInterval(interval);
  }, [enableUserChatOnly]);
  
  // 获取当前显示的欢迎语
  const displaySlogan = enableUserChatOnly 
    ? LUGANG_SLOGANS[currentLang] 
    : slogan;

  return (
    <Flex flexDir="column" justifyContent="flex-end" alignItems="center" gap={4} position="relative">
      {/* 淡蓝色光晕背景效果 - 仅在纯聊天模式下显示 */}
      {enableUserChatOnly && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          w={['300px', '500px']}
          h={['200px', '300px']}
          borderRadius="50%"
          background="radial-gradient(ellipse at center, rgba(59, 130, 246, 0.25) 0%, rgba(96, 165, 250, 0.15) 40%, transparent 70%)"
          filter="blur(40px)"
          pointerEvents="none"
          zIndex={0}
          animation="pulse 4s ease-in-out infinite"
          sx={{
            '@keyframes pulse': {
              '0%, 100%': { opacity: 0.8, transform: 'translate(-50%, -50%) scale(1)' },
              '50%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1.05)' }
            }
          }}
        />
      )}
      
      {/* Logo */}
      <Image
        alt="logo"
        maxW={['200px', '300px']}
        src={wideLogo || DEFAULT_LOGO_BANNER_URL}
        fallbackSrc={DEFAULT_LOGO_BANNER_URL}
        position="relative"
        zIndex={1}
      />
      
      {/* 欢迎语 - 淡蓝色渐变效果 */}
      {enableUserChatOnly ? (
        <Box
          fontSize={['md', 'lg']}
          fontWeight="500"
          textAlign="center"
          px={4}
          py={2}
          position="relative"
          zIndex={1}
          background="linear-gradient(135deg, #3B82F6 0%, #60A5FA 50%, #93C5FD 100%)"
          backgroundClip="text"
          sx={{
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
          opacity={isVisible ? 1 : 0}
          transition="opacity 0.3s ease-in-out"
        >
          {displaySlogan}
        </Box>
      ) : (
        <Box color="myGray.500" position="relative" zIndex={1}>
          {slogan}
        </Box>
      )}

      {/* 鲁港通快捷功能按钮 - 仅在纯聊天模式下显示 */}
      {enableUserChatOnly && (
        <Grid
          templateColumns={['repeat(2, 1fr)', 'repeat(4, 1fr)']}
          gap={3}
          mt={4}
          position="relative"
          zIndex={1}
          w={['100%', 'auto']}
          maxW="600px"
          px={4}
        >
          {LUGANG_QUICK_ACTIONS.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              size="md"
              h="auto"
              py={3}
              px={4}
              borderColor="blue.200"
              borderRadius="xl"
              bg="white"
              _hover={{
                bg: 'blue.50',
                borderColor: 'blue.400',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)'
              }}
              transition="all 0.2s ease"
              flexDir="column"
              gap={1}
            >
              <MyIcon
                name={action.icon as any}
                w="20px"
                h="20px"
                color="blue.500"
              />
              <Box
                fontSize="xs"
                fontWeight="500"
                color="gray.700"
              >
                {currentLang === 'zh-Hant' ? action.labelHant : action.label}
              </Box>
            </Button>
          ))}
        </Grid>
      )}
    </Flex>
  );
};

export default WelcomeHomeBox;
