/**
 * 鲁港通 - 官网首页登录页（N1）
 * 整页《鹊华秋色图》水墨画背景 + 深色渐变遮罩 + 平台宣传文字 + 悬浮登录卡片。
 * 融合自 api.airscend.com 首页宣传内容；登录交互完全复用官方 LoginContainer，不影响原有功能。
 * 官方 LoginModal 保持不动（chat 页登录门继续使用官方样式）。
 */
import React from 'react';
import { Box, Flex, Image, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { LoginContainer } from '@/pageComponents/login';
import I18nLngSelector from '@/components/Select/I18nLngSelector';
import { useSystem } from '@fastgpt/web/hooks/useSystem';
import { useTranslation } from 'next-i18next';
import { type LoginSuccessResponseType } from '@fastgpt/global/openapi/support/user/account/login/api';

type LoginHeroModalProps = {
  onSuccess: (e: LoginSuccessResponseType) => any;
};

// 鲁港通 - 三个特性标签（政策精准直达 / 跨境全域服务 / 人才双向奔赴）
const HERO_TAG_KEYS = ['hero_tag_1', 'hero_tag_2', 'hero_tag_3'] as const;

const LoginHeroModal = ({ onSuccess }: LoginHeroModalProps) => {
  const { isPc } = useSystem();
  const { t } = useTranslation();

  return (
    <Flex
      position="relative"
      flexDirection="column"
      minH="100vh"
      w="full"
      bg="#0a1628"
      userSelect="none"
      overflowX="hidden"
    >
      {/* 背景层：《鹊华秋色图》水墨画 + 深色渐变遮罩（保证文字与卡片可读） */}
      <Box
        position="absolute"
        inset={0}
        zIndex={0}
        pointerEvents="none"
        bgImage={'url(/imgs/hero-quehua.jpg)'}
        bgRepeat="no-repeat"
        bgPosition="center"
        bgSize="cover"
      />
      <Box
        position="absolute"
        inset={0}
        zIndex={0}
        pointerEvents="none"
        bgImage={
          'linear-gradient(180deg, rgba(8,18,35,0.62) 0%, rgba(5,12,24,0.48) 45%, rgba(5,10,20,0.72) 100%)'
        }
      />

      {/* 顶部导航：logo + 关于入口 + 语言切换 */}
      <Flex
        position="relative"
        zIndex={2}
        w="full"
        justifyContent="space-between"
        alignItems="center"
        px={['16px', '32px']}
        py={['12px', '16px']}
      >
        <Image
          src="/icon/logo.png"
          alt={t('login:hero_title')}
          h={['30px', '40px']}
          objectFit="contain"
        />
        <Flex alignItems="center" gap={['14px', '24px']}>
          <NextLink href="/about">
            <Text
              color="rgba(255,255,255,0.9)"
              fontSize="14px"
              fontWeight="medium"
              _hover={{ color: 'white' }}
              cursor="pointer"
            >
              {t('login:nav_about')}
            </Text>
          </NextLink>
          {isPc && <I18nLngSelector />}
        </Flex>
      </Flex>

      {/* 中央区：平台宣传文字 + 悬浮登录卡片 */}
      <Flex
        position="relative"
        zIndex={1}
        flex="1 0 auto"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        px={['12px', '32px']}
        py={['20px', '36px']}
      >
        {/* 宣传文字块 */}
        <Flex
          flexDirection="column"
          alignItems="center"
          textAlign="center"
          color="white"
          maxW="920px"
          mb={['20px', '36px']}
        >
          <Text
            as="h1"
            fontSize={['28px', '50px']}
            fontWeight="700"
            letterSpacing="0.02em"
            textShadow="0 2px 16px rgba(0,0,0,0.5)"
            lineHeight="1.25"
          >
            {t('login:hero_title')}
          </Text>
          <Text
            as="h4"
            fontSize={['15px', '22px']}
            fontWeight="500"
            color="rgba(255,255,255,0.92)"
            mt={['10px', '16px']}
            textShadow="0 1px 10px rgba(0,0,0,0.5)"
            lineHeight="1.5"
          >
            {t('login:hero_slogan')}
          </Text>

          {/* 两段平台介绍：PC 显示，移动端收纳以保证登录表单可达 */}
          <Box display={['none', 'block']} mt="22px">
            <Text
              fontSize="17px"
              color="rgba(255,255,255,0.88)"
              lineHeight="1.8"
              textShadow="0 1px 8px rgba(0,0,0,0.5)"
            >
              {t('login:hero_intro_1')}
            </Text>
            <Text
              fontSize="17px"
              color="rgba(255,255,255,0.88)"
              lineHeight="1.8"
              mt="10px"
              textShadow="0 1px 8px rgba(0,0,0,0.5)"
            >
              {t('login:hero_intro_2')}
            </Text>
          </Box>

          {/* 三个特性标签：PC 显示 */}
          <Flex display={['none', 'flex']} mt="26px" gap="14px" flexWrap="wrap" justify="center">
            {HERO_TAG_KEYS.map((key) => (
              <Box
                key={key}
                px="20px"
                py="7px"
                borderRadius="full"
                bg="rgba(255,255,255,0.14)"
                border="1px solid rgba(255,255,255,0.35)"
                backdropFilter="blur(4px)"
                color="white"
                fontSize="14px"
                letterSpacing="0.04em"
              >
                {t(`login:${key}`)}
              </Box>
            ))}
          </Flex>
        </Flex>

        {/* 悬浮登录卡片：白色毛玻璃 + 深阴影，叠于水墨画之上 */}
        <Flex
          flexDirection="column"
          w={['100%', '560px']}
          bg="rgba(255,255,255,0.96)"
          backdropFilter="blur(12px)"
          borderRadius={['16px', '24px']}
          px={['8', '90px']}
          py={['34px', '90px']}
          boxShadow={[
            '0 8px 32px rgba(0,0,0,0.35)',
            '0 24px 64px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)'
          ]}
          position="relative"
          zIndex={1}
        >
          <LoginContainer onSuccess={onSuccess} />
        </Flex>
      </Flex>

      {/* 页脚：版本与版权（PC 显示） */}
      <Box display={['none', 'block']} position="relative" zIndex={1} pb="18px" textAlign="center">
        <Text fontSize="12px" color="rgba(255,255,255,0.6)">
          {t('login:hero_footer_built')}
        </Text>
        <Text fontSize="12px" color="rgba(255,255,255,0.6)" mt="2px">
          {t('login:hero_footer_copyright')}
        </Text>
      </Box>
    </Flex>
  );
};

export default LoginHeroModal;
