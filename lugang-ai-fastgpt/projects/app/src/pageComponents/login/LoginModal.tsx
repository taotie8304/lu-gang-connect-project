import React from 'react';
import { Box, Flex, Image } from '@chakra-ui/react';
import { LoginContainer } from '@/pageComponents/login';
import I18nLngSelector from '@/components/Select/I18nLngSelector';
import { useSystem } from '@fastgpt/web/hooks/useSystem';
import { getWebReqUrl } from '@fastgpt/web/common/system/utils';
import type { LoginSuccessResponse } from '@/global/support/api/userRes';

type LoginModalProps = {
  onSuccess: (e: LoginSuccessResponse) => any;
};

const LoginModal = ({ onSuccess }: LoginModalProps) => {
  const { isPc } = useSystem();

  return (
    <Flex
      alignItems={'center'}
      justifyContent={'center'}
      // 鲁港通：淡蓝色渐变背景（替代原有粉红色）
      bg={[
        'linear-gradient(135deg, #EBF4FF 0%, #DBEAFE 50%, #BFDBFE 100%)',
        'linear-gradient(135deg, #EBF4FF 0%, #DBEAFE 50%, #BFDBFE 100%)'
      ]}
      userSelect={'none'}
      h={'100%'}
      position="relative"
      overflow="hidden"
    >
      {/* 鲁港通：淡蓝色光晕装饰效果 */}
      <Box
        position="absolute"
        top="-20%"
        right="-10%"
        w="500px"
        h="500px"
        borderRadius="50%"
        background="radial-gradient(ellipse at center, rgba(59, 130, 246, 0.15) 0%, transparent 70%)"
        filter="blur(60px)"
        pointerEvents="none"
      />
      <Box
        position="absolute"
        bottom="-15%"
        left="-5%"
        w="400px"
        h="400px"
        borderRadius="50%"
        background="radial-gradient(ellipse at center, rgba(96, 165, 250, 0.12) 0%, transparent 70%)"
        filter="blur(50px)"
        pointerEvents="none"
      />

      {/* Language selector - login page */}
      {isPc && (
        <Box position="absolute" top="24px" right="24px" zIndex={10}>
          <I18nLngSelector />
        </Box>
      )}

      <Flex
        flexDirection={'column'}
        w={['100%', '480px']}
        h={['100%', 'auto']}
        minH={['100%', '580px']}
        bg={'white'}
        px={['6', '48px']}
        py={['32px', '48px']}
        borderRadius={[0, '24px']}
        // 鲁港通：淡蓝色阴影效果
        boxShadow={[
          '',
          '0px 25px 50px -12px rgba(59, 130, 246, 0.25), 0px 0px 1px 0px rgba(59, 130, 246, 0.10)'
        ]}
        position="relative"
        zIndex={1}
      >
        <LoginContainer onSuccess={onSuccess} />
      </Flex>

      {/* 鲁港通：PC端右侧品牌展示区域 */}
      {isPc && (
        <Flex
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          ml={16}
          maxW="400px"
          display={['none', 'none', 'flex']}
        >
          <Image
            src={getWebReqUrl('/imgs/chat/lugang_banner.svg')}
            alt="鲁港通"
            maxW="280px"
            mb={6}
          />
          <Box
            fontSize="xl"
            fontWeight="600"
            color="#1E40AF"
            textAlign="center"
            mb={3}
          >
            鲁港通跨境AI智能平台
          </Box>
          <Box
            fontSize="md"
            color="#3B82F6"
            textAlign="center"
            maxW="320px"
            lineHeight="1.6"
          >
            连接鲁港，智慧跨境
            <br />
            为您提供专业的跨境AI服务
          </Box>
        </Flex>
      )}
    </Flex>
  );
};

export default LoginModal;
