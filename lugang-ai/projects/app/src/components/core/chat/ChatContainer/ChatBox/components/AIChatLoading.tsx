import React from 'react';
import { Box, Flex, type SpinnerProps } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import ThinkingFace from '@/components/common/ThinkingFace';

// 鲁港通 - 沿用原有 size 参数口径（对齐 ParticleLoading 的像素档位），默认 48
const faceSizeMap: Record<string, number> = { xs: 24, sm: 32, md: 48, lg: 64, xl: 80 };

const AIChatLoading = ({ text, size = 'lg' }: { text?: string; size?: SpinnerProps['size'] }) => {
  const { t } = useTranslation();
  const loadingText = text ?? t('chat:ai_chat_loading');
  const faceSize = faceSizeMap[String(size)] ?? 48;

  return (
    <Flex alignItems={'center'} justifyContent={'flex-start'} gap={2}>
      <ThinkingFace size={faceSize} />
      {loadingText && (
        <Box color={'myGray.600'} fontSize={'16px'} lineHeight={'24px'} fontWeight={'normal'}>
          {loadingText}
        </Box>
      )}
    </Flex>
  );
};

export default React.memo(AIChatLoading);
