import React, { useState, useEffect } from 'react';
import { useContextSelector } from 'use-context-selector';
import { ChatBoxContext } from '../../Provider';
import { DEFAULT_LOGO_BANNER_URL } from '@/pageComponents/chat/constants';
import { Box, Flex, Image } from '@chakra-ui/react';
import { useSystemStore } from '@/web/common/system/useSystemStore';

// 鲁港通默认欢迎语配置
const LUGANG_SLOGANS: Record<string, string> = {
  'zh-CN': '你好，我是鲁港通跨境AI服务助手，请问今天我可以帮您做些什么呢？',
  'zh-Hant': '你好，請問今日有咩可以幫到你呀？',
  'en': 'Hello, I am Lugang Connect AI Assistant. How can I help you today?'
};

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
      {/* 光晕背景效果 - 仅在纯聊天模式下显示 */}
      {enableUserChatOnly && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          w={['300px', '500px']}
          h={['200px', '300px']}
          borderRadius="50%"
          background="radial-gradient(ellipse at center, rgba(147, 197, 253, 0.3) 0%, rgba(147, 197, 253, 0.1) 40%, transparent 70%)"
          filter="blur(40px)"
          pointerEvents="none"
          zIndex={0}
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
      
      {/* 欢迎语 - 带渐变效果 */}
      {enableUserChatOnly ? (
        <Box
          fontSize={['md', 'lg']}
          fontWeight="500"
          textAlign="center"
          px={4}
          py={2}
          position="relative"
          zIndex={1}
          background="linear-gradient(135deg, #ec4899 0%, #f97316 50%, #8b5cf6 100%)"
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
    </Flex>
  );
};

export default WelcomeHomeBox;
