import Markdown from '@/components/Markdown';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Flex,
  HStack
} from '@chakra-ui/react';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useTranslation } from 'next-i18next';
import React from 'react';

const reasoningTypography = {
  fontSize: '14px',
  fontStyle: 'normal',
  fontWeight: 400,
  lineHeight: '20px',
  letterSpacing: '0.25px'
};

const RenderReasoningContent = React.memo(function RenderReasoningContent({
  content,
  isChatting,
  isLastResponseValue,
  isDisabled,
  defaultExpanded = isLastResponseValue,
  // 鲁港通 - 紧凑模式：思考内容限高 4 行滚动展示（普通用户），root 不传此 prop 保持完整展开
  compact = false
}: {
  content: string;
  isChatting: boolean;
  isLastResponseValue: boolean;
  isDisabled?: boolean;
  defaultExpanded?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const showAnimation = isChatting && isLastResponseValue;
  // 鲁港通 - 紧凑模式下流式内容自动滚到底部，形成“文字向上翻动”效果
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (compact && showAnimation && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [compact, showAnimation, content]);

  return (
    <Accordion allowToggle defaultIndex={defaultExpanded ? 0 : undefined}>
      <AccordionItem borderTop={'none'} borderBottom={'none'} lineHeight={'24px'}>
        <AccordionButton
          w={'fit-content'}
          h={'24px'}
          minH={'24px'}
          display={'flex'}
          alignItems={'center'}
          lineHeight={'24px'}
          p={0}
          bg={'transparent'}
          border={'none'}
          boxShadow={'none'}
          color={'myGray.600'}
          _hover={{ color: 'myGray.600', bg: 'transparent' }}
          _expanded={{ color: 'myGray.600' }}
        >
          <HStack h={'24px'} lineHeight={'24px'} mr={1} spacing="0">
            <Flex
              w="24px"
              h="24px"
              flexShrink={0}
              alignItems="center"
              justifyContent="center"
              lineHeight={0}
            >
              <MyIcon
                name={'core/chat/deepThinking'}
                w={'20px'}
                h={'20px'}
                fill={'myGray.500'}
                display={'block'}
                verticalAlign={'middle'}
              />
            </Flex>
            <Box fontSize={'16px'} lineHeight={'24px'}>
              {t('chat:ai_reasoning')}
            </Box>
          </HStack>

          <AccordionIcon ml={1} w={'16px'} h={'16px'} color={'myGray.500'} />
        </AccordionButton>
        <AccordionPanel py={0} pr={0} pl={0} mt={2} color={'myGray.500'}>
          <Box position={'relative'} ml={3}>
            <Box
              ref={scrollRef}
              pl={3}
              borderLeft={'1px solid'}
              borderColor={'myGray.200'}
              maxH={compact ? '84px' : undefined}
              overflowY={compact ? 'auto' : undefined}
              sx={{
                '.markdown': {
                  ...reasoningTypography,
                  wordBreak: 'normal',
                  overflowWrap: 'anywhere'
                },
                '.markdown *': {
                  letterSpacing: reasoningTypography.letterSpacing,
                  wordBreak: 'normal',
                  overflowWrap: 'anywhere'
                }
              }}
            >
              <Markdown source={content} showAnimation={showAnimation} isDisabled={isDisabled} />
            </Box>
          </Box>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
});

export default RenderReasoningContent;
