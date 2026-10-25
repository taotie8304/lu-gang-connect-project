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
import { useTranslation } from 'next-i18next';
import React, { useState } from 'react';

const RenderProcessingCollapse = React.memo(function RenderProcessingCollapse({
  children,
  label,
  preview,
  isProcessing = true
}: {
  children: React.ReactNode;
  label?: string;
  preview?: React.ReactNode;
  isProcessing?: boolean;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Accordion
      allowToggle
      index={isExpanded ? 0 : -1}
      onChange={(index) => setIsExpanded(Array.isArray(index) ? index.length > 0 : index === 0)}
    >
      <AccordionItem borderTop={'none'} borderBottom={'none'} lineHeight={'24px'}>
        <Box w={'full'} pb={'4px'}>
          <AccordionButton
            w={'fit-content'}
            h={'28px'}
            minH={'28px'}
            display={'inline-flex'}
            alignItems={'center'}
            lineHeight={'28px'}
            px={'10px'}
            py={0}
            borderRadius={'7px'}
            border={'1px dashed'}
            borderColor={'rgba(111,157,208,0.4)'}
            bg={'rgba(231,241,251,0.7)'}
            boxShadow={'none'}
            color={'#4A6F92'}
            fontSize={'11px'}
            _hover={{ bg: 'rgba(231,241,251,0.95)', borderColor: 'rgba(111,157,208,0.6)' }}
            _expanded={{ bg: 'rgba(231,241,251,0.95)', borderColor: 'rgba(111,157,208,0.6)' }}
          >
            <Box
              w={'6px'}
              h={'6px'}
              mr={'6px'}
              borderRadius={'full'}
              bg={'currentColor'}
              opacity={0.6}
              flexShrink={0}
            />
            <HStack h={'28px'} lineHeight={'28px'} spacing="0">
              <Box>
                {isProcessing ? t('chat:processing') : t('chat:processed')}
                {isProcessing && label && (
                  <Box as="span">
                    {' · '}
                    {t(label)}
                    {'...'}
                  </Box>
                )}
              </Box>
            </HStack>

            <AccordionIcon ml={'4px'} w={'14px'} h={'14px'} color={'#6F9DD0'} />
          </AccordionButton>
        </Box>
        {isProcessing && !isExpanded && preview && <Box mt={2}>{preview}</Box>}
        {isExpanded && (
          <AccordionPanel py={0} pr={0} pl={0} mt={2}>
            <Flex flexDirection={'column'} gap={2}>
              {children}
            </Flex>
          </AccordionPanel>
        )}
      </AccordionItem>
    </Accordion>
  );
});

export default RenderProcessingCollapse;
