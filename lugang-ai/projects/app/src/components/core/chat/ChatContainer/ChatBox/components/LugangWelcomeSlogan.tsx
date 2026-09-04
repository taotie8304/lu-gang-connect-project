import { Box } from '@chakra-ui/react';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import { LUGANG_SLOGAN_FADE_DURATION, useLugangHomeSlogan } from './home/useLugangHomeSlogan';

// 鲁港通 - App 欢迎屏品牌开场：普通话 → 粤语 → 英文 三语循环轮播。
// 视觉层级：浅蓝光晕为背景层（zIndex:0，居中 + 模糊 + 呼吸动画），欢迎语文字居中叠在光晕前面（zIndex:1，品牌蓝渐变字 + 淡入淡出）。
// 仅空会话（无聊天记录）时由 AppChatMain 渲染；管理员为 App 配置的 welcomeText 在其下方独立展示。
const LugangWelcomeSlogan = () => {
  const { t } = useClientTranslation('chat');
  // 轮播常开：App 欢迎屏始终展示品牌三语欢迎语
  const { sloganKey, isVisible } = useLugangHomeSlogan({ enabled: true });

  return (
    <Box
      position="relative"
      w="100%"
      py={8}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      {/* 鲁港通 - 浅色光晕背景层（在文字后面、居中） */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        w={['320px', '480px']}
        h={['160px', '220px']}
        borderRadius="50%"
        background="radial-gradient(ellipse at center, rgba(59,130,246,0.20) 0%, rgba(96,165,250,0.10) 45%, transparent 72%)"
        filter="blur(40px)"
        pointerEvents="none"
        zIndex={0}
        animation="lugangSloganPulse 4s ease-in-out infinite"
        sx={{
          '@keyframes lugangSloganPulse': {
            '0%, 100%': { opacity: 0.7, transform: 'translate(-50%, -50%) scale(1)' },
            '50%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1.06)' }
          }
        }}
      />
      {/* 鲁港通 - 轮播欢迎语文字（居中、叠在光晕前面） */}
      <Box
        position="relative"
        zIndex={1}
        maxW={['100%', '640px']}
        px={4}
        textAlign="center"
        fontFamily='"PingFang SC", sans-serif'
        fontSize={['20px', '28px']}
        fontWeight={500}
        lineHeight={1.5}
        opacity={isVisible ? 1 : 0}
        transition={`opacity ${LUGANG_SLOGAN_FADE_DURATION}ms ease-in-out`}
        background="linear-gradient(135deg, #3B82F6 0%, #60A5FA 50%, #93C5FD 100%)"
        backgroundClip="text"
        sx={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
      >
        {t(`chat:${sloganKey}`)}
      </Box>
    </Box>
  );
};

export default LugangWelcomeSlogan;
