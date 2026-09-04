/**
 * 鲁港通 - 关于页（N2）
 * 完整复刻 api.airscend.com/about 的 9 大板块内容与深蓝夜色视觉风格：
 * Hero / 南下 / 北上 / 使命宣言 / 发展历程 / 创始人领航 / 战略合作伙伴 / 联系我们 / 版权。
 * 静态营销页，无需登录即可访问；文案全部走 login 命名空间 i18n key（about_* 前缀）。
 */
import React from 'react';
import { Box, Flex, Image, Text, SimpleGrid, VStack, HStack, Divider, Link } from '@chakra-ui/react';
import NextLink from 'next/link';
import { useTranslation } from 'next-i18next';
import I18nLngSelector from '@/components/Select/I18nLngSelector';

// 鲁港通 - 南下/北上各 3 张卡片
const DIRECTION_CARDS = {
  south: [
    { emoji: '🛡️', title: 'login:about_south_card1_title', text: 'login:about_south_card1_text' },
    { emoji: '👨‍👩‍👧', title: 'login:about_south_card2_title', text: 'login:about_south_card2_text' },
    { emoji: '📈', title: 'login:about_south_card3_title', text: 'login:about_south_card3_text' }
  ],
  north: [
    { emoji: '🦾', title: 'login:about_north_card1_title', text: 'login:about_north_card1_text' },
    { emoji: '🧬', title: 'login:about_north_card2_title', text: 'login:about_north_card2_text' },
    { emoji: '🎓', title: 'login:about_north_card3_title', text: 'login:about_north_card3_text' }
  ]
} as const;

// 鲁港通 - Hero 三张定位卡片
const HERO_CARDS = [
  { emoji: '🏛️', key: 'login:about_hero_card1' },
  { emoji: '🧭', key: 'login:about_hero_card2' },
  { emoji: '⚙️', key: 'login:about_hero_card3' }
] as const;

// 鲁港通 - 创始人社会职务（6 张星标卡片）
const FOUNDER_POSTS = [
  'login:about_founder_post1',
  'login:about_founder_post2',
  'login:about_founder_post3',
  'login:about_founder_post4',
  'login:about_founder_post5',
  'login:about_founder_post6'
] as const;

// 鲁港通 - 核心社团（4 张卡片）
const COMMUNITIES = [
  'login:about_partners_c1',
  'login:about_partners_c2',
  'login:about_partners_c3',
  'login:about_partners_c4'
] as const;

// 鲁港通 - 政府及官方机构（沿用原站官方 Logo 外链，与 api.airscend.com 保持一致）
const GOV_PARTNERS = [
  {
    logo: 'https://www.yinghelawyer.com/uploads/upfiles/image/20220228/1646015503924161.png',
    name: 'login:about_partners_gov1_name',
    desc: 'login:about_partners_gov1_desc'
  },
  {
    logo: 'https://clologin.edb.gov.hk/adfs/portal/logo/logo.png',
    name: 'login:about_partners_gov2_name',
    desc: 'login:about_partners_gov2_desc'
  },
  {
    logo: 'https://www.weventure.gov.hk/EDay2024/media/images/home/HYAB-Logo-TC.png',
    name: 'login:about_partners_gov3_name',
    desc: 'login:about_partners_gov3_desc'
  },
  {
    logo: 'https://www.tourism.gov.hk/images/about_us_hktb_logo.png',
    name: 'login:about_partners_gov4_name',
    desc: 'login:about_partners_gov4_desc'
  }
] as const;

// 鲁港通 - 区块容器：深蓝底色交替 + 垂直留白
const Section = ({
  bg,
  children
}: {
  bg: '#0d2137' | '#0a1628' | 'transparent';
  children?: React.ReactNode;
}) => (
  <Box as="section" bg={bg === 'transparent' ? undefined : bg} px={['16px', '48px']} py={['48px', '72px']}>
    <VStack spacing={['28px', '40px']} maxW="1200px" mx="auto" alignItems="stretch">
      {children}
    </VStack>
  </Box>
);

// 鲁港通 - 区块大标题（居中，带图标）
const SectionTitle = ({ icon, children }: { icon: string; children?: React.ReactNode }) => (
  <Text
    as="h2"
    fontSize={['24px', '34px']}
    fontWeight="700"
    color="white"
    textAlign="center"
    lineHeight="1.4"
  >
    {icon} {children}
  </Text>
);

// 鲁港通 - 内容卡片（深蓝底白字，圆角 + 柔和描边）
const ContentCard = ({ children }: { children?: React.ReactNode }) => (
  <Box
    p={['20px', '28px']}
    borderRadius="16px"
    bg="rgba(255,255,255,0.06)"
    border="1px solid rgba(255,255,255,0.14)"
    backdropFilter="blur(4px)"
  >
    {children}
  </Box>
);

const AboutPage = () => {
  const { t } = useTranslation();

  return (
    <Flex flexDirection="column" bg="#0a1628" minH="100vh" w="full" overflowX="hidden">
      {/* 顶部导航：logo + 返回登录 + 语言切换 */}
      <Flex
        position="sticky"
        top={0}
        zIndex={10}
        w="full"
        justifyContent="space-between"
        alignItems="center"
        px={['16px', '32px']}
        py={['12px', '16px']}
        bg="rgba(5,13,24,0.85)"
        backdropFilter="blur(8px)"
      >
        <NextLink href="/login">
          <Image src="/icon/logo.png" alt={t('login:hero_title')} h={['30px', '40px']} objectFit="contain" cursor="pointer" />
        </NextLink>
        <Flex alignItems="center" gap={['14px', '24px']}>
          <NextLink href="/login">
            <Text color="rgba(255,255,255,0.9)" fontSize="14px" fontWeight="medium" _hover={{ color: 'white' }} cursor="pointer">
              {t('login:nav_back_login')}
            </Text>
          </NextLink>
          <I18nLngSelector />
        </Flex>
      </Flex>

      {/* 1. Hero：水墨画背景 + 蓝色渐变遮罩 */}
      <Box position="relative" px={['16px', '48px']} py={['64px', '110px']}>
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
            'linear-gradient(135deg, rgba(10,22,40,0.85) 0%, rgba(26,35,126,0.75) 100%)'
          }
        />
        <VStack
          position="relative"
          zIndex={1}
          spacing={['18px', '24px']}
          maxW="1000px"
          mx="auto"
          textAlign="center"
        >
          <Text as="h1" fontSize={['28px', '46px']} fontWeight="700" color="white" lineHeight="1.3">
            {t('login:hero_title')}
          </Text>
          <Text as="h4" fontSize={['15px', '21px']} fontWeight="500" color="rgba(255,255,255,0.92)">
            {t('login:about_hero_slogan')}
          </Text>
          <Text fontSize={['14px', '17px']} color="rgba(255,255,255,0.88)" maxW="820px" lineHeight="1.8">
            {t('login:about_hero_p1')}
          </Text>
          <Text fontSize={['14px', '17px']} color="rgba(255,255,255,0.88)" maxW="820px" lineHeight="1.8">
            {t('login:about_hero_p2')}
          </Text>
          <Text as="h5" fontSize={['16px', '20px']} fontWeight="600" color="white" pt={['8px', '16px']}>
            {t('login:about_hero_commit')}
          </Text>
          <SimpleGrid columns={[1, 3]} spacing={['14px', '24px']} w={['100%', '900px']}>
            {HERO_CARDS.map((card) => (
              <ContentCard key={card.key}>
                <VStack spacing="10px">
                  <Text fontSize="28px">{card.emoji}</Text>
                  <Text fontSize={['15px', '17px']} fontWeight="600" color="white" textAlign="center">
                    {t(card.key)}
                  </Text>
                </VStack>
              </ContentCard>
            ))}
          </SimpleGrid>
        </VStack>
      </Box>

      {/* 2. 南下：助鲁企出海，融全球格局 */}
      <Section bg="#0d2137">
        <SectionTitle icon="⬇️">{t('login:about_south_title')}</SectionTitle>
        <Text
          as="h6"
          fontSize={['14px', '16px']}
          color="rgb(255,213,79)"
          textAlign="center"
          fontWeight="500"
        >
          {t('login:about_south_mission')}
        </Text>
        <SimpleGrid columns={[1, 3]} spacing={['16px', '24px']}>
          {DIRECTION_CARDS.south.map((card) => (
            <ContentCard key={card.title}>
              <VStack alignItems="flex-start" spacing="12px">
                <Text fontSize="24px">{card.emoji}</Text>
                <Text as="h5" fontSize="17px" fontWeight="600" color="white">
                  {t(card.title)}
                </Text>
                <Text fontSize="14px" color="rgba(255,255,255,0.82)" lineHeight="1.8">
                  {t(card.text)}
                </Text>
              </VStack>
            </ContentCard>
          ))}
        </SimpleGrid>
      </Section>

      {/* 3. 北上：引港资入鲁，聚创新动能 */}
      <Section bg="#0a1628">
        <SectionTitle icon="⬆️">{t('login:about_north_title')}</SectionTitle>
        <Text
          as="h6"
          fontSize={['14px', '16px']}
          color="rgb(255,213,79)"
          textAlign="center"
          fontWeight="500"
        >
          {t('login:about_north_mission')}
        </Text>
        <SimpleGrid columns={[1, 3]} spacing={['16px', '24px']}>
          {DIRECTION_CARDS.north.map((card) => (
            <ContentCard key={card.title}>
              <VStack alignItems="flex-start" spacing="12px">
                <Text fontSize="24px">{card.emoji}</Text>
                <Text as="h5" fontSize="17px" fontWeight="600" color="white">
                  {t(card.title)}
                </Text>
                <Text fontSize="14px" color="rgba(255,255,255,0.82)" lineHeight="1.8">
                  {t(card.text)}
                </Text>
              </VStack>
            </ContentCard>
          ))}
        </SimpleGrid>
      </Section>

      {/* 4. 使命宣言（蓝色渐变） */}
      <Box
        px={['16px', '48px']}
        py={['48px', '72px']}
        bgImage={'linear-gradient(135deg, #1a237e 0%, #0d47a1 50%, #1565c0 100%)'}
      >
        <VStack spacing={['20px', '28px']} maxW="1000px" mx="auto" textAlign="center">
          <Text as="h3" fontSize={['22px', '32px']} fontWeight="700" color="white" lineHeight="1.5">
            ❤️ {t('login:about_mission_title1')}
            <br />
            {t('login:about_mission_title2')}
          </Text>
          <Divider borderColor="rgba(255,255,255,0.3)" maxW="240px" />
          <Text fontSize={['14px', '17px']} color="rgba(255,255,255,0.92)" lineHeight="1.8">
            {t('login:about_mission_p1')}
          </Text>
          <Text as="h5" fontSize={['15px', '18px']} fontWeight="600" color="white">
            {t('login:about_mission_promise_label')}
          </Text>
          <Text fontSize={['14px', '17px']} color="rgba(255,255,255,0.92)" lineHeight="1.8">
            {t('login:about_mission_p2')}
          </Text>
          <ContentCard>
            <Text fontSize={['15px', '18px']} fontWeight="600" color="white" py="6px">
              🎉 {t('login:about_mission_card')}
            </Text>
          </ContentCard>
        </VStack>
      </Box>

      {/* 5. 发展历程（白色卡片） */}
      <Section bg="#0d2137">
        <SectionTitle icon="🕒">{t('login:about_history_title')}</SectionTitle>
        <Box
          p={['24px', '40px']}
          borderRadius="16px"
          bg="white"
          maxW="900px"
          mx="auto"
        >
          <VStack spacing="16px" alignItems="flex-start">
            <Text as="h4" fontSize={['18px', '22px']} fontWeight="700" color="#0d2137">
              {t('login:about_history_year')}
            </Text>
            <Text fontSize={['14px', '16px']} color="#374151" lineHeight="1.9">
              {t('login:about_history_p1')}
            </Text>
            <Text fontSize={['14px', '16px']} color="#374151" lineHeight="1.9">
              {t('login:about_history_p2')}
            </Text>
            <Box
              w="full"
              p="16px"
              borderRadius="10px"
              bg="#eef2ff"
              borderLeft="4px solid #1565c0"
            >
              <Text fontSize={['14px', '16px']} fontWeight="600" color="#0d47a1" lineHeight="1.8">
                {t('login:about_history_highlight')}
              </Text>
            </Box>
          </VStack>
        </Box>
      </Section>

      {/* 6. 创始人领航 */}
      <Section bg="#0a1628">
        <SectionTitle icon="👤">{t('login:about_founder_title')}</SectionTitle>
        <Box
          p={['24px', '40px']}
          borderRadius="16px"
          bg="rgba(255,255,255,0.06)"
          border="1px solid rgba(255,255,255,0.14)"
          maxW="1000px"
          mx="auto"
        >
          <VStack spacing={['20px', '28px']} alignItems={['center', 'flex-start']}>
            <VStack spacing="6px" alignItems={['center', 'flex-start']}>
              <Text as="h4" fontSize={['20px', '26px']} fontWeight="700" color="white">
                {t('login:about_founder_name')}
              </Text>
              <Text as="h6" fontSize={['13px', '15px']} color="rgb(255,213,79)" fontWeight="500">
                {t('login:about_founder_role')}
              </Text>
            </VStack>
            <Text as="h4" fontSize={['15px', '18px']} fontWeight="600" color="white">
              {t('login:about_founder_posts_title')}
            </Text>
            <SimpleGrid columns={[1, 2, 3]} spacing={['10px', '16px']} w="full">
              {FOUNDER_POSTS.map((post) => (
                <ContentCard key={post}>
                  <HStack spacing="10px">
                    <Text fontSize="16px">⭐</Text>
                    <Text fontSize="14px" color="white" fontWeight="500">
                      {t(post)}
                    </Text>
                  </HStack>
                </ContentCard>
              ))}
            </SimpleGrid>
            <Text as="h4" fontSize={['15px', '18px']} fontWeight="600" color="white">
              {t('login:about_founder_advantage_title')}
            </Text>
            <Text fontSize={['14px', '16px']} color="rgba(255,255,255,0.85)" lineHeight="1.9">
              {t('login:about_founder_advantage_p1')}
            </Text>
            <Text fontSize={['14px', '16px']} color="rgba(255,255,255,0.85)" lineHeight="1.9">
              {t('login:about_founder_advantage_p2')}
            </Text>
          </VStack>
        </Box>
      </Section>

      {/* 7. 战略合作伙伴 */}
      <Section bg="#0d2137">
        <SectionTitle icon="🤝">{t('login:about_partners_title')}</SectionTitle>
        <Text as="h5" fontSize={['14px', '17px']} color="rgb(255,213,79)" textAlign="center" fontWeight="500">
          {t('login:about_partners_sub')}
        </Text>
        <Text fontSize={['14px', '16px']} color="rgba(255,255,255,0.85)" textAlign="center" maxW="820px" mx="auto" lineHeight="1.8">
          {t('login:about_partners_p')}
        </Text>
        <Divider borderColor="rgba(255,255,255,0.2)" />
        <Text as="h4" fontSize={['15px', '18px']} fontWeight="600" color="white">
          👥 {t('login:about_partners_community_title')}
        </Text>
        <SimpleGrid columns={[1, 2, 4]} spacing={['12px', '16px']}>
          {COMMUNITIES.map((key) => (
            <ContentCard key={key}>
              <Text fontSize="15px" fontWeight="600" color="white" textAlign="center">
                {t(key)}
              </Text>
            </ContentCard>
          ))}
        </SimpleGrid>
        <Text fontSize="13px" color="rgba(255,255,255,0.6)" textAlign="center">
          {t('login:about_partners_community_note')}
        </Text>
        <Text as="h4" fontSize={['15px', '18px']} fontWeight="600" color="white" pt={['8px', '16px']}>
          🏦 {t('login:about_partners_gov_title')}
        </Text>
        <SimpleGrid columns={[1, 2, 4]} spacing={['12px', '16px']}>
          {GOV_PARTNERS.map((partner) => (
            <ContentCard key={partner.name}>
              <VStack spacing="12px">
                <Image
                  src={partner.logo}
                  alt={t(partner.name)}
                  maxH="60px"
                  objectFit="contain"
                  bg="white"
                  borderRadius="8px"
                  p="6px"
                />
                <Text fontSize="15px" fontWeight="600" color="white" textAlign="center">
                  {t(partner.name)}
                </Text>
                <Text fontSize="13px" color="rgba(255,255,255,0.75)" textAlign="center" lineHeight="1.7">
                  {t(partner.desc)}
                </Text>
              </VStack>
            </ContentCard>
          ))}
        </SimpleGrid>
      </Section>

      {/* 8. 联系我们 */}
      <Section bg="#0a1628">
        <SectionTitle icon="📍">{t('login:about_contact_title')}</SectionTitle>
        <ContentCard>
          <VStack spacing="10px" py="8px">
            <Text as="h5" fontSize={['15px', '18px']} fontWeight="600" color="white">
              {t('login:about_contact_addr_label')}
            </Text>
            <Text fontSize={['14px', '16px']} color="rgba(255,255,255,0.9)">
              {t('login:about_contact_addr_cn')}
            </Text>
            <Text fontSize="14px" color="rgba(255,255,255,0.7)">
              6/F, Gamsun Commercial Centre, 333 Nathan Road, Kowloon, Hong Kong
            </Text>
          </VStack>
        </ContentCard>
      </Section>

      {/* 9. 底部信息条 + 页脚 */}
      <Box bg="#050d18" px="16px" py="28px">
        <VStack spacing="6px" maxW="1000px" mx="auto" textAlign="center">
          <Text fontSize="13px" color="rgba(255,255,255,0.65)">
            {t('login:about_footer_support')}
          </Text>
          <Text fontSize="12px" color="rgba(255,255,255,0.55)">
            {t('login:hero_footer_copyright')}
          </Text>
          <Link
            as={NextLink}
            href="/login"
            fontSize="12px"
            color="rgba(255,255,255,0.45)"
            _hover={{ color: 'white' }}
            pt="6px"
          >
            ← {t('login:nav_back_login')}
          </Link>
        </VStack>
      </Box>
    </Flex>
  );
};

export default AboutPage;
