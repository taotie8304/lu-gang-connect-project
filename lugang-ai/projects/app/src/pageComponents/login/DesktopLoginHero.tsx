/**
 * 鲁港通 - 桌面客户端专属登录页（第 2 批）
 * 左侧《鹊华秋色图》水墨长卷叠加青瓷网格、鎏金光轨与呼吸光晕；右侧玉版宣登录卡。
 * 仅在桌面桥可用时由 pages/login 分流渲染，表单与网页端共用 LoginContainer。
 */
import React, { useEffect, useState } from 'react';
import { Box, Flex, Image, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { useTranslation } from 'next-i18next';
import { LoginContainer } from '@/pageComponents/login';
import I18nLngSelector from '@/components/Select/I18nLngSelector';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import type { LoginSuccessResponseType } from '@fastgpt/global/openapi/support/user/account/login/api';
import styles from './DesktopLoginHero.module.scss';

// 鲁港通 - 与网页端一致的三个特性标签
const HERO_TAG_KEYS = ['hero_tag_1', 'hero_tag_2', 'hero_tag_3'] as const;

const LockGlyph = () => (
  <Box
    as="svg"
    w="13px"
    h="13px"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    flexShrink={0}
    aria-hidden
  >
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Box>
);

type DesktopLoginHeroProps = {
  onSuccess: (e: LoginSuccessResponseType) => any;
};

const DesktopLoginHero = ({ onSuccess }: DesktopLoginHeroProps) => {
  const { t } = useTranslation();
  const { feConfigs } = useSystemStore();
  const [version, setVersion] = useState('');
  const brand = feConfigs?.systemTitle || '鲁港通';

  useEffect(() => {
    // 鲁港通 - 兜底关闭上一位用户遗留的内置浏览器面板，并读取真实客户端版本
    void window.lugangDesktop?.closePanel().catch(() => undefined);
    window.lugangDesktop
      ?.getVersion()
      .then((info) => setVersion(info.appVersion))
      .catch(() => undefined);
  }, []);

  // 鲁港通 - 桌面标题栏占住顶部 36px：高度跟随可视区用 100%，避免底部被裁掉
  return (
    <Flex minH="100%" w="full" bg="#06121F" overflow="hidden" userSelect="none">
      {/* 左：水墨长卷艺术区 */}
      <Box
        position="relative"
        w="52%"
        flexShrink={0}
        overflow="hidden"
        display={{ base: 'none', lg: 'block' }}
      >
        <Box
          position="absolute"
          inset={0}
          bgImage="url(/imgs/hero-quehua.jpg)"
          bgSize="cover"
          bgPosition="center"
          opacity={0.85}
          aria-hidden
          sx={{ filter: 'saturate(0.82) contrast(1.05)' }}
        />
        <Box
          position="absolute"
          inset={0}
          bgImage="linear-gradient(180deg, rgba(6,18,31,0.62) 0%, rgba(6,18,31,0.16) 32%, rgba(6,18,31,0.30) 62%, rgba(6,18,31,0.92) 100%)"
          aria-hidden
        />
        <Box
          position="absolute"
          inset={0}
          bgImage="linear-gradient(90deg, rgba(6,18,31,0.55) 0%, rgba(6,18,31,0.08) 42%, #06121F 100%)"
          aria-hidden
        />

        {/* 青瓷网格 */}
        <Box
          position="absolute"
          inset={0}
          opacity={0.75}
          aria-hidden
          sx={{
            backgroundImage:
              'linear-gradient(rgba(79,184,166,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(79,184,166,0.10) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage:
              'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.05) 100%)',
            WebkitMaskImage:
              'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.05) 100%)'
          }}
        />

        {/* 鎏金光轨 */}
        <Box
          className={styles.sweep}
          position="absolute"
          top="-30%"
          left="-35%"
          w="55%"
          h="160%"
          bgImage="linear-gradient(100deg, transparent 0%, rgba(200,169,106,0.20) 45%, rgba(200,169,106,0.04) 58%, transparent 100%)"
          pointerEvents="none"
          aria-hidden
          sx={{ filter: 'blur(28px)' }}
        />

        {/* 呼吸光晕与光点 */}
        <Box
          className={styles.pulse}
          position="absolute"
          right="2%"
          top="14%"
          w="320px"
          h="320px"
          borderRadius="full"
          bgImage="radial-gradient(circle, rgba(79,184,166,0.22) 0%, transparent 68%)"
          pointerEvents="none"
          aria-hidden
        />
        <Box
          className={`${styles.pulse} ${styles.pulseDelay}`}
          position="absolute"
          left="-12%"
          bottom="6%"
          w="360px"
          h="360px"
          borderRadius="full"
          bgImage="radial-gradient(circle, rgba(200,169,106,0.16) 0%, transparent 70%)"
          pointerEvents="none"
          aria-hidden
        />
        <Box
          className={styles.twinkle}
          position="absolute"
          top="27%"
          left="19%"
          w="4px"
          h="4px"
          borderRadius="full"
          bg="#8FDCCB"
          boxShadow="0 0 10px rgba(143,220,203,0.9)"
          aria-hidden
        />
        <Box
          className={styles.twinkleSlow}
          position="absolute"
          top="58%"
          left="34%"
          w="3px"
          h="3px"
          borderRadius="full"
          bg="#C8A96A"
          boxShadow="0 0 10px rgba(200,169,106,0.9)"
          aria-hidden
        />
        <Box
          className={styles.twinkle}
          position="absolute"
          top="74%"
          right="16%"
          w="3px"
          h="3px"
          borderRadius="full"
          bg="#8FDCCB"
          boxShadow="0 0 8px rgba(143,220,203,0.8)"
          aria-hidden
        />

        {/* 内容层 */}
        <Flex
          position="relative"
          zIndex={1}
          direction="column"
          justifyContent="space-between"
          h="full"
          minH="100%"
          px="44px"
          py="36px"
        >
          <Flex alignItems="center" gap="14px">
            <Image src="/icon/logo.png" alt={brand} h="34px" objectFit="contain" />
            <Box w="1px" h="20px" bg="rgba(200,169,106,0.55)" />
            <Text color="#F7F3E8" fontSize="15px" fontWeight="600" letterSpacing="0.18em">
              {brand}
            </Text>
            <Box
              px="9px"
              py="2px"
              borderRadius="full"
              border="1px solid"
              borderColor="rgba(79,184,166,0.55)"
              bg="rgba(79,184,166,0.10)"
              color="#8FDCCB"
              fontSize="10px"
              letterSpacing="0.1em"
              whiteSpace="nowrap"
            >
              {t('login:desktop_badge')}
            </Box>
          </Flex>

          <Flex flex="1" alignItems="center" py="24px">
            <Flex alignItems="flex-start" gap="18px">
              <Flex direction="column" alignItems="center" gap="22px" pt="8px">
                <Text
                  fontSize="17px"
                  fontWeight="500"
                  letterSpacing="0.32em"
                  color="rgba(200,169,106,0.92)"
                  sx={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}
                >
                  {t('login:desktop_vertical_subtitle')}
                </Text>
                <Flex
                  w="52px"
                  h="52px"
                  alignItems="center"
                  justifyContent="center"
                  bg="#B5452F"
                  color="#F7F3E8"
                  border="1px solid"
                  borderColor="rgba(247,243,232,0.4)"
                  borderRadius="8px"
                  fontSize="13px"
                  fontWeight="700"
                  letterSpacing="0.08em"
                  boxShadow="0 8px 22px rgba(181,69,47,0.35)"
                  transform="rotate(-5deg)"
                  title={brand}
                >
                  鲁港通
                </Flex>
              </Flex>
              <Flex direction="column" alignItems="center">
                <Text
                  fontFamily="'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif"
                  fontSize="46px"
                  fontWeight="600"
                  letterSpacing="0.24em"
                  color="#F7F3E8"
                  textShadow="0 4px 30px rgba(0,0,0,0.55)"
                  sx={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}
                >
                  {t('login:desktop_vertical_title')}
                </Text>
                <Box
                  mt="18px"
                  w="2px"
                  h="56px"
                  bgImage="linear-gradient(180deg, #C8A96A, transparent)"
                />
              </Flex>
            </Flex>
          </Flex>

          <Box>
            <Flex gap="10px" flexWrap="wrap" mb="22px">
              {HERO_TAG_KEYS.map((key) => (
                <Flex
                  key={key}
                  alignItems="center"
                  gap="8px"
                  px="14px"
                  py="6px"
                  borderRadius="full"
                  border="1px solid"
                  borderColor="rgba(79,184,166,0.35)"
                  bg="rgba(6,18,31,0.35)"
                  backdropFilter="blur(6px)"
                >
                  <Box
                    w="5px"
                    h="5px"
                    borderRadius="full"
                    bg="#4FB8A6"
                    boxShadow="0 0 8px rgba(79,184,166,0.8)"
                  />
                  <Text fontSize="12px" color="rgba(247,243,232,0.82)" letterSpacing="0.06em">
                    {t(`login:${key}`)}
                  </Text>
                </Flex>
              ))}
            </Flex>
            <Flex alignItems="center" justifyContent="space-between" gap="16px">
              <Text fontSize="11px" color="rgba(247,243,232,0.40)" lineHeight="1.6">
                {t('login:desktop_copyright')}
              </Text>
              <NextLink href="/about">
                <Text
                  fontSize="12px"
                  color="rgba(247,243,232,0.72)"
                  letterSpacing="0.12em"
                  whiteSpace="nowrap"
                  _hover={{ color: '#C8A96A' }}
                >
                  {t('login:nav_about')}
                </Text>
              </NextLink>
            </Flex>
          </Box>
        </Flex>
      </Box>

      {/* 右：玉版宣登录卡 */}
      <Flex
        position="relative"
        flex="1"
        minW="0"
        direction="column"
        alignItems="center"
        justifyContent="center"
        bg="#0C2233"
        px={{ base: '16px', xl: '28px' }}
        py="40px"
        overflow="hidden"
      >
        <Box
          position="absolute"
          inset={0}
          pointerEvents="none"
          aria-hidden
          bgImage="radial-gradient(circle at 18% 8%, rgba(79,184,166,0.16), transparent 44%), radial-gradient(circle at 88% 92%, rgba(200,169,106,0.12), transparent 48%)"
        />
        <Box
          position="absolute"
          inset={0}
          pointerEvents="none"
          aria-hidden
          opacity={0.8}
          sx={{
            backgroundImage:
              'linear-gradient(rgba(79,184,166,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(79,184,166,0.07) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(circle at 50% 46%, rgba(0,0,0,0.85), transparent 78%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 46%, rgba(0,0,0,0.85), transparent 78%)'
          }}
        />
        <Box
          position="absolute"
          top={0}
          bottom={0}
          left={0}
          w="1px"
          pointerEvents="none"
          aria-hidden
          bgImage="linear-gradient(180deg, transparent, rgba(200,169,106,0.55) 30%, rgba(200,169,106,0.55) 70%, transparent)"
        />

        <Box
          position="absolute"
          top="18px"
          right="22px"
          zIndex={2}
          borderRadius="md"
          overflow="hidden"
        >
          <I18nLngSelector />
        </Box>

        <Box position="relative" zIndex={1} w="full" maxW="440px">
          <Box
            position="absolute"
            top="-1px"
            left="50%"
            transform="translateX(-50%)"
            w="128px"
            h="2px"
            bgImage="linear-gradient(90deg, transparent, #C8A96A, transparent)"
            pointerEvents="none"
            aria-hidden
          />
          <Box
            position="relative"
            bg="#F7F3E8"
            borderRadius="22px"
            border="1px solid"
            borderColor="rgba(200,169,106,0.45)"
            boxShadow="0 28px 72px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.85)"
            px={{ base: '20px', xl: '26px' }}
            py={{ base: '28px', xl: '36px' }}
            bgImage="radial-gradient(circle at 12% 0%, rgba(79,184,166,0.10), transparent 52%), radial-gradient(circle at 100% 100%, rgba(200,169,106,0.10), transparent 56%)"
          >
            <Box
              position="absolute"
              top="10px"
              left="10px"
              w="18px"
              h="18px"
              borderTop="1px solid"
              borderLeft="1px solid"
              borderColor="rgba(200,169,106,0.55)"
              borderTopLeftRadius="8px"
              pointerEvents="none"
              aria-hidden
            />
            <Box
              position="absolute"
              bottom="10px"
              right="10px"
              w="18px"
              h="18px"
              borderBottom="1px solid"
              borderRight="1px solid"
              borderColor="rgba(200,169,106,0.55)"
              borderBottomRightRadius="8px"
              pointerEvents="none"
              aria-hidden
            />
            <LoginContainer onSuccess={onSuccess} />
          </Box>

          <Flex
            mt="18px"
            alignItems="center"
            justifyContent="center"
            gap="8px"
            color="rgba(247,243,232,0.62)"
          >
            <LockGlyph />
            <Text fontSize="12px" letterSpacing="0.02em">
              {t('login:desktop_session_note')}
            </Text>
          </Flex>
          {version && (
            <Text
              mt="6px"
              textAlign="center"
              fontSize="11px"
              letterSpacing="0.08em"
              color="rgba(200,169,106,0.55)"
            >
              {t('login:desktop_version', { version })}
            </Text>
          )}
        </Box>
      </Flex>
    </Flex>
  );
};

export default DesktopLoginHero;
