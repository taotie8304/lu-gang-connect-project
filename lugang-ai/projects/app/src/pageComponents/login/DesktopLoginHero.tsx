/**
 * 鲁港通 - 桌面客户端专属登录页（#704 同步首页 v4 品牌视觉）
 * 左侧米色纸张艺术区：衬线大标题、政策浮签与史莱姆吉祥物；右侧玉版宣登录卡。
 * 仅在桌面桥可用时由 pages/login 分流渲染，表单与网页端共用 LoginContainer。
 */
import React, { useEffect, useState } from 'react';
import { Box, Flex, Image, Text } from '@chakra-ui/react';
import NextLink from 'next/link';
import { useTranslation } from 'next-i18next';
import { LoginContainer } from '@/pageComponents/login';
import ThinkingFace from '@/components/common/ThinkingFace';
import I18nLngSelector from '@/components/Select/I18nLngSelector';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import type {
  HomeHeroCopy,
  HomeLoginCopy
} from '@/pageComponents/login/home/homeData';
import { HOME_BRAND_NAME, HOME_BRAND_SUB } from '@/pageComponents/login/home/homeData';
import type { LoginSuccessResponseType } from '@fastgpt/global/openapi/support/user/account/login/api';
import styles from './DesktopLoginHero.module.scss';

// 鲁港通 - 首页 v4 品牌色板（与 HOME_CSS 保持一致）
const PAPER = '#f7f4ec';
const PAPER_2 = '#f2eee3';
const CARD = '#fffdf8';
const INK = '#1e1d1a';
const MUTED = '#6f6a5e';
const FAINT = '#8f897b';
const LINE = 'rgba(30, 29, 26, 0.12)';
const LINE_2 = 'rgba(30, 29, 26, 0.18)';
const GOLD = '#a9853f';
const SERIF =
  "'Songti SC', 'Noto Serif SC', 'Source Han Serif SC', 'STSong', 'SimSun', Georgia, serif";

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

const Mascot = ({ say }: { say: string }) => (
  <Box position="relative" w="190px" flexShrink={0} aria-hidden>
    <Box className={styles.mascotSay}>{say}</Box>
    <Box className={styles.bob}>
      <Box position="relative">
        <Image
          src="/imgs/home-mascot-base.webp"
          alt=""
          w="100%"
          draggable={false}
          sx={{ filter: 'drop-shadow(0 22px 34px rgba(30,123,255,0.22))' }}
        />
        {[
          { left: '38.28%', top: '47.69%' },
          { left: '62.19%', top: '47.59%' }
        ].map((eye) => (
          <Box
            key={eye.left}
            position="absolute"
            left={eye.left}
            top={eye.top}
            w="6.3%"
            h="8.1%"
            borderRadius="50%"
            bg="#fff"
            boxShadow="inset -2px -3px 0 rgba(170,224,250,0.5), inset 0 0 0 1.5px rgba(36,148,208,0.8)"
            transform="translate(-50%, -50%)"
            className={styles.eye}
          />
        ))}
      </Box>
    </Box>
  </Box>
);

const FLOAT_CLASSES = [styles.float1, styles.float2, styles.float3];

type DesktopLoginHeroProps = {
  onSuccess: (e: LoginSuccessResponseType) => any;
};

const DesktopLoginHero = ({ onSuccess }: DesktopLoginHeroProps) => {
  const { t } = useTranslation();
  const { t: tHome } = useTranslation('home');
  const { feConfigs } = useSystemStore();
  const [version, setVersion] = useState('');
  const brand = feConfigs?.systemTitle || HOME_BRAND_NAME;

  // 鲁港通 - 文案按段落整体取回，与首页 v4 共用同一份 hero/login 文案
  const tHomeSection = tHome as unknown as (
    key: string,
    options: { returnObjects: true }
  ) => unknown;
  const hero = tHomeSection('hero', { returnObjects: true }) as HomeHeroCopy;
  const loginCopy = tHomeSection('login', { returnObjects: true }) as HomeLoginCopy;

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
    <Flex minH="100%" w="full" bg={PAPER} overflow="hidden" userSelect="none" color={INK}>
      {/* 左：v4 米色纸张品牌区 */}
      <Box
        position="relative"
        w="52%"
        flexShrink={0}
        overflow="hidden"
        display={{ base: 'none', lg: 'flex' }}
        flexDirection="column"
        bg={PAPER}
      >
        <Box
          position="absolute"
          inset={0}
          pointerEvents="none"
          aria-hidden
          bgImage="radial-gradient(ellipse 62% 48% at 8% 6%, rgba(30,123,255,0.10), transparent 62%), radial-gradient(ellipse 56% 42% at 96% 78%, rgba(63,156,140,0.10), transparent 64%), radial-gradient(ellipse 40% 34% at 52% 108%, rgba(169,133,63,0.08), transparent 70%)"
        />
        <Box
          position="absolute"
          inset={0}
          pointerEvents="none"
          aria-hidden
          opacity={0.42}
          sx={{
            backgroundImage: 'radial-gradient(rgba(30,29,26,0.16) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 66% 62% at 46% 42%, #000 6%, transparent 76%)',
            WebkitMaskImage: 'radial-gradient(ellipse 66% 62% at 46% 42%, #000 6%, transparent 76%)'
          }}
        />
        <Box
          className={styles.orbA}
          position="absolute"
          left="-8%"
          top="18%"
          w="340px"
          h="340px"
          borderRadius="50%"
          bg="rgba(30,123,255,0.14)"
          pointerEvents="none"
          aria-hidden
          sx={{ filter: 'blur(46px)' }}
        />
        <Box
          className={styles.orbB}
          position="absolute"
          right="-6%"
          bottom="4%"
          w="300px"
          h="300px"
          borderRadius="50%"
          bg="rgba(63,156,140,0.13)"
          pointerEvents="none"
          aria-hidden
          sx={{ filter: 'blur(44px)' }}
        />

        {hero.floats.slice(0, 3).map((word, index) => (
          <Box
            key={word}
            className={`${styles.float} ${FLOAT_CLASSES[index] ?? ''}`}
            position="absolute"
            display={{ base: 'none', xl: 'block' }}
            px="13px"
            py="7px"
            borderRadius="full"
            bg="rgba(255,253,248,0.82)"
            border="1px solid"
            borderColor={LINE}
            boxShadow="0 8px 22px rgba(30,29,26,0.05)"
            fontSize="11px"
            color={MUTED}
            letterSpacing="0.05em"
            pointerEvents="none"
            aria-hidden
            zIndex={0}
          >
            {word}
          </Box>
        ))}

        <Flex
          position="relative"
          zIndex={1}
          direction="column"
          justifyContent="space-between"
          h="full"
          minH="100%"
          px={{ lg: '44px', xl: '56px' }}
          py={{ lg: '32px', xl: '40px' }}
        >
          <Flex alignItems="center" gap="12px">
            <ThinkingFace size={34} />
            <Box>
              <Text fontSize="17px" fontWeight="600" letterSpacing="0.12em" lineHeight="1.2">
                {brand}
              </Text>
              <Text fontSize="8.5px" color={FAINT} letterSpacing="0.26em" mt="2px">
                {HOME_BRAND_SUB}
              </Text>
            </Box>
            <Box w="1px" h="22px" bg={LINE_2} ml="4px" />
            <Box
              px="10px"
              py="3px"
              borderRadius="full"
              border="1px solid"
              borderColor="rgba(30,123,255,0.28)"
              bg="rgba(30,123,255,0.07)"
              color="#1863cc"
              fontSize="10px"
              letterSpacing="0.12em"
              whiteSpace="nowrap"
            >
              {t('login:desktop_badge')}
            </Box>
          </Flex>

          <Box maxW="560px" py="24px">
            <Flex
              alignItems="center"
              gap="14px"
              color={FAINT}
              fontSize="11.5px"
              letterSpacing="0.2em"
            >
              <Box w="28px" h="1px" bg="rgba(30,29,26,0.22)" />
              {hero.eyebrow}
            </Flex>
            <Text
              as="h1"
              mt="22px"
              fontFamily={SERIF}
              fontSize={{ lg: '34px', xl: 'clamp(38px, 3.4vw, 50px)' }}
              fontWeight="600"
              lineHeight="1.16"
              letterSpacing="0.015em"
            >
              {hero.titleTop}
              <br />
              <Box as="span" position="relative" display="inline-block">
                <Box
                  position="absolute"
                  left="2%"
                  right="2%"
                  bottom="0.06em"
                  h="0.09em"
                  borderRadius="full"
                  bg="linear-gradient(90deg, rgba(30,123,255,0.22), rgba(63,156,140,0.18))"
                  zIndex={-1}
                  aria-hidden
                />
                {hero.titleAccent}
              </Box>
            </Text>
            <Text
              mt="20px"
              maxW="520px"
              fontSize={{ lg: '14px', xl: '15px' }}
              lineHeight="1.95"
              color={MUTED}
            >
              {hero.lede}
            </Text>
            <Flex
              mt="24px"
              flexWrap="wrap"
              gap="10px 20px"
              fontSize="11.5px"
              color={FAINT}
              letterSpacing="0.05em"
            >
              {hero.meta.map((item, index) => (
                <Flex key={item} alignItems="center" gap="7px">
                  {index > 0 && (
                    <Box w="3px" h="3px" borderRadius="full" bg="currentColor" opacity={0.6} />
                  )}
                  {item}
                </Flex>
              ))}
            </Flex>
          </Box>

          <Flex alignItems="flex-end" justifyContent="space-between" gap="20px">
            <Box maxW="300px">
              <Text fontSize="11px" color="rgba(30,29,26,0.42)" lineHeight="1.7">
                {t('login:desktop_copyright')}
              </Text>
              <NextLink href="/about">
                <Text
                  display="inline-block"
                  mt="10px"
                  fontSize="12px"
                  color={MUTED}
                  letterSpacing="0.12em"
                  whiteSpace="nowrap"
                  _hover={{ color: INK }}
                >
                  {t('login:nav_about')}
                </Text>
              </NextLink>
            </Box>
            <Mascot say={hero.mascotSay} />
          </Flex>
        </Flex>
      </Box>

      {/* 右：v4 玉版宣登录卡 */}
      <Flex
        position="relative"
        flex="1"
        minW="0"
        direction="column"
        alignItems="center"
        justifyContent="center"
        bg={PAPER_2}
        px={{ base: '16px', xl: '32px' }}
        py="40px"
        overflowY="auto"
      >
        <Box
          position="absolute"
          inset={0}
          pointerEvents="none"
          aria-hidden
          bgImage="radial-gradient(ellipse 58% 44% at 18% 4%, rgba(30,123,255,0.08), transparent 64%), radial-gradient(ellipse 52% 40% at 92% 96%, rgba(63,156,140,0.09), transparent 66%)"
        />
        <Box
          position="absolute"
          inset={0}
          pointerEvents="none"
          aria-hidden
          opacity={0.3}
          sx={{
            backgroundImage: 'radial-gradient(rgba(30,29,26,0.14) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
            maskImage: 'radial-gradient(ellipse 62% 56% at 50% 46%, #000 6%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(ellipse 62% 56% at 50% 46%, #000 6%, transparent 78%)'
          }}
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

        <Box position="relative" zIndex={1} w="full" maxW="430px">
          <Box
            bg={CARD}
            borderRadius="22px"
            border="1px solid"
            borderColor={LINE_2}
            boxShadow="0 2px 6px rgba(30,29,26,0.05), 0 18px 48px rgba(30,29,26,0.09)"
            px={{ base: '22px', xl: '28px' }}
            py={{ base: '28px', xl: '34px' }}
          >
            <Text
              as="h2"
              fontFamily={SERIF}
              fontSize="25px"
              fontWeight="600"
              letterSpacing="0.03em"
            >
              {loginCopy.title}
            </Text>
            <Text mt="6px" fontSize="12.5px" color={FAINT}>
              {loginCopy.sub}
            </Text>
            <Box mt="18px" fontSize="14px" lineHeight="1.5" className={styles.loginBody}>
              <LoginContainer onSuccess={onSuccess} />
            </Box>
          </Box>

          <Flex mt="18px" alignItems="center" justifyContent="center" gap="8px" color={MUTED}>
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
              color={GOLD}
              opacity={0.75}
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
