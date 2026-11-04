'use client';
import React from 'react';
import { Box, Flex } from '@chakra-ui/react';
import { useClientTranslation } from '@fastgpt/web/i18n/useClientTranslation';
import MemoriesPanel from '@/components/UserSettingsPanel/MemoriesPanel';
import {
  accountContentScrollStyles,
  accountPageRootStyles,
  accountTitleTextStyles
} from '../styles';

const Memories = () => {
  const { t } = useClientTranslation('account');

  return (
    <Flex {...accountPageRootStyles} flexDirection={'column'}>
      <Flex
        h={['56px', '64px']}
        flexShrink={0}
        px={[4, 6]}
        alignItems={'center'}
        borderBottom={'1px solid'}
        borderColor={'myGray.200'}
      >
        <Box as={'h1'} {...accountTitleTextStyles}>
          {t('account:memories')}
        </Box>
      </Flex>

      <Box px={[4, 6]} pt={[4, 6]} pb={[4, 6]} {...accountContentScrollStyles}>
        <Flex maxW={'760px'} w={'100%'} mx={'auto'} flexDirection={'column'} gap={4}>
          <MemoriesPanel />
        </Flex>
      </Box>
    </Flex>
  );
};

export default Memories;
