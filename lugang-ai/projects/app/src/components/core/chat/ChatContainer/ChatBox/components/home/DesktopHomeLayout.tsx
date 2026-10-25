import type { ReactNode } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import { useContextSelector } from 'use-context-selector';
import { ChatBoxContext } from '../../Provider';
import QuickApps from './QuickApps';
import LugangWelcomeHero, { type HomePromptMode } from './LugangWelcomeHero';

type DesktopHomeLayoutProps = {
  inputSlot: ReactNode;
  /** fill：写入输入框等待补充；send：直接发送（无外部变量时才会发生）。 */
  onPickPrompt?: (text: string, mode: HomePromptMode) => void;
};

const DesktopHomeLayout = ({ inputSlot, onPickPrompt }: DesktopHomeLayoutProps) => {
  const quickAppList = useContextSelector(ChatBoxContext, (v) => v.quickAppList);

  return (
    <Flex flex="1 0 0" h={0} w="100%" flexDir="column" overflowY="auto">
      <Flex flexDir="column" alignItems="center" w="100%" my="auto" py="18px">
        <LugangWelcomeHero onPickPrompt={onPickPrompt} />

        {quickAppList && quickAppList.length > 0 && (
          <Box mt="16px" w="100%">
            <QuickApps />
          </Box>
        )}

        <Box mt="20px" w="100%">
          {inputSlot}
        </Box>
      </Flex>
    </Flex>
  );
};

export default DesktopHomeLayout;
