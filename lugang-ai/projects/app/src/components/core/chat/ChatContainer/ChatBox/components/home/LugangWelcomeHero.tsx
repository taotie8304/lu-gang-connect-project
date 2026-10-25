import { Box, Flex } from '@chakra-ui/react';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { useUserStore } from '@/web/support/user/useUserStore';
import { LG } from '@/pageComponents/chat/lugangTheme';

export type HomePromptMode = 'fill' | 'send';

type LugangWelcomeHeroProps = {
  /** fill：写入输入框等待补充；send：直接发送。 */
  onPickPrompt?: (text: string, mode: HomePromptMode) => void;
};

type CapabilityKey = 'people' | 'policy' | 'finance' | 'transport' | 'business' | 'shandong';

// 鲁港通 - 图标沿用预览中的线性小图标，避免为六张卡片引入额外图标依赖
const CapabilityIcon = ({ name }: { name: CapabilityKey }) => {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  switch (name) {
    case 'people':
      return (
        <svg {...common}>
          <path d="M4 21h16" />
          <path d="M6 21V9l6-4 6 4v12" />
          <path d="M10 21v-5h4v5" />
        </svg>
      );
    case 'policy':
      return (
        <svg {...common}>
          <path d="M7 3h7l5 5v13H7z" />
          <polyline points="14 3 14 8 19 8" />
          <line x1="10" y1="13" x2="16" y2="13" />
          <line x1="10" y1="17" x2="14" y2="17" />
        </svg>
      );
    case 'finance':
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M5 21V10h14v11" />
          <path d="M8 10V6l4-3 4 3v4" />
          <path d="M9 14h2M13 14h2M9 17h2M13 17h2" />
        </svg>
      );
    case 'transport':
      return (
        <svg {...common}>
          <circle cx="5" cy="6" r="2.2" />
          <circle cx="19" cy="18" r="2.2" />
          <path d="M7 7.5c5 2 4 7 10 9" />
        </svg>
      );
    case 'business':
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      );
    case 'shandong':
      return (
        <svg {...common}>
          <path d="M3 18l5-7 4 4 3-4 6 7z" />
          <circle cx="17" cy="6" r="2" />
        </svg>
      );
    default:
      return null;
  }
};

const CAPABILITIES: { key: CapabilityKey; tone: 'blue' | 'sand' }[] = [
  { key: 'people', tone: 'blue' },
  { key: 'policy', tone: 'sand' },
  { key: 'finance', tone: 'blue' },
  { key: 'transport', tone: 'blue' },
  { key: 'business', tone: 'sand' },
  { key: 'shandong', tone: 'blue' }
];

const SUGGESTIONS = ['talent', 'mpf', 'airport'] as const;

const toneStyle = {
  blue: { bg: LG.pale, color: LG.mountain, border: 'rgba(111,157,208,0.24)' },
  sand: { bg: '#F4F1E8', color: '#8B7C56', border: 'rgba(183,168,136,0.4)' }
} as const;

/**
 * 鲁港通 - 品牌首屏：问候语 + 六张能力卡 + 建议问题。
 *
 * 首页面板与应用空会话共用这一份内容，避免两处维护两套视觉。
 * 能力卡只把提示词填进输入框，建议问题直接发送。
 */
const LugangWelcomeHero = ({ onPickPrompt }: LugangWelcomeHeroProps) => {
  const { t } = useClientTranslation('chat');
  const userInfo = useUserStore((s) => s.userInfo);
  const userName = userInfo?.team?.memberName || userInfo?.username;

  return (
    <Flex flexDir="column" alignItems="center" w="100%">
      <Flex alignItems="center" gap="8px" mb="14px" color="#5E7C98" lineHeight="1">
        <Box w="22px" h="1px" bgGradient="linear-gradient(90deg, transparent, #8FB4DC)" />
        <Box as="span" fontSize="10.5px" letterSpacing="0.24em">
          {t('chat:home.eyebrow')}
        </Box>
        <Box w="22px" h="1px" bgGradient="linear-gradient(90deg, #8FB4DC, transparent)" />
      </Flex>

      <Box
        fontSize={{ base: '26px', md: '34px' }}
        fontWeight={600}
        color="#1E3346"
        lineHeight="1.25"
        textAlign="center"
      >
        {userName ? (
          <>
            {t('chat:home.greeting_prefix')}
            <Box
              as="em"
              fontStyle="normal"
              color="transparent"
              backgroundImage="linear-gradient(100deg, #4F80B4, #8FB4DC 55%, #A9C7E7)"
              backgroundClip="text"
              style={{ WebkitTextFillColor: 'transparent' }}
            >
              {userName}
            </Box>
          </>
        ) : (
          t('chat:home.greeting_fallback')
        )}
      </Box>

      <Box mt="9px" fontSize="13.5px" color={LG.muted} textAlign="center">
        {t('chat:home.subtitle')}
      </Box>

      <Box
        w="100%"
        mt="26px"
        display="grid"
        gridTemplateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }}
        gap="12px"
      >
        {CAPABILITIES.map(({ key, tone }) => {
          const palette = toneStyle[tone];
          return (
            <Box
              key={key}
              as="button"
              type="button"
              position="relative"
              textAlign="left"
              border="1px solid"
              borderColor={LG.line}
              bgGradient="linear-gradient(180deg, rgba(255,255,255,0.96), rgba(246,250,255,0.92))"
              borderRadius="14px"
              p="14px 14px 13px"
              display="flex"
              flexDir="column"
              gap="7px"
              boxShadow="inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 18px rgba(78,128,178,0.06)"
              transition="0.18s"
              _hover={{
                borderColor: LG.lineStrong,
                transform: 'translateY(-2px)',
                boxShadow: '0 14px 26px rgba(78,128,178,0.14)'
              }}
              onClick={() => onPickPrompt?.(t(`chat:home.capability.${key}.prompt`), 'fill')}
            >
              <Flex
                w="30px"
                h="30px"
                borderRadius="9px"
                alignItems="center"
                justifyContent="center"
                bg={palette.bg}
                color={palette.color}
                border="1px solid"
                borderColor={palette.border}
              >
                <CapabilityIcon name={key} />
              </Flex>
              <Box as="h4" fontSize="13px" fontWeight={600} color={LG.ink} letterSpacing="0.02em">
                {t(`chat:home.capability.${key}.title`)}
              </Box>
              <Box as="p" fontSize="11.5px" lineHeight="1.55" color="#788BA0">
                {t(`chat:home.capability.${key}.desc`)}
              </Box>
              <Box position="absolute" top="14px" right="12px" color="#A3B5C7">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Flex mt="20px" gap="9px" flexWrap="wrap" alignItems="center" justifyContent="center">
        <Box as="span" fontSize="11px" color="#8296AA" letterSpacing="0.08em">
          {t('chat:home.try_label')}
        </Box>
        {SUGGESTIONS.map((key) => {
          const text = t(`chat:home.prompt.${key}`);
          return (
            <Box
              key={key}
              as="button"
              type="button"
              h="28px"
              borderRadius="999px"
              border="1px solid"
              borderColor="rgba(111,157,208,0.3)"
              bg="rgba(255,255,255,0.85)"
              color="#476077"
              fontSize="11.5px"
              px="12px"
              display="inline-flex"
              alignItems="center"
              gap="6px"
              transition="0.16s"
              _hover={{
                borderColor: 'rgba(111,157,208,0.6)',
                color: LG.mountain,
                bg: '#fff'
              }}
              onClick={() => onPickPrompt?.(text, 'send')}
            >
              <Box as="span" color={LG.lake}>
                ✦
              </Box>
              {text}
            </Box>
          );
        })}
      </Flex>
    </Flex>
  );
};

export default LugangWelcomeHero;
