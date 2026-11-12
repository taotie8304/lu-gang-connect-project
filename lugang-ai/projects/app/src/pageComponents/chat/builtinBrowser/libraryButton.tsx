// 鲁港通 - 个人资料库入口（0.14.0）：
// 挂在聊天输入框右侧按钮组、办事浏览器地球按钮之后；老客户端没有资料库桥时不渲染
import { useContext } from 'react';
import { Flex } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import { BuiltinBrowserContext, useBuiltinBrowserVisible, useIsDesktopBridge } from './context';
import { LG } from '@/pageComponents/chat/lugangTheme';

// 鲁港通 - 老客户端没有 library 对象，只在桌面桥提供该能力时给出入口
export const useLibraryAvailable = (): boolean => {
  const isDesktop = useIsDesktopBridge();
  return isDesktop && typeof window !== 'undefined' && Boolean(window.lugangDesktop?.library);
};

const BuiltinLibraryEntryButton = () => {
  const { t } = useTranslation();
  const isVisible = useBuiltinBrowserVisible();
  const libraryAvailable = useLibraryAvailable();
  const builtinBrowser = useContext(BuiltinBrowserContext);

  if (!isVisible || !builtinBrowser || !libraryAvailable) return null;

  return (
    <Flex
      alignItems={'center'}
      justifyContent={'center'}
      w={'28px'}
      h={'28px'}
      borderRadius={'8px'}
      cursor={'pointer'}
      color={LG.muted}
      _hover={{ bg: LG.pale }}
      onClick={(e) => {
        e.stopPropagation();
        builtinBrowser.openLibrary();
      }}
    >
      <MyTooltip label={t('common:builtin_browser_library_open' as any)}>
        <MyIcon name={'common/folderFill'} w={'18px'} h={'18px'} color={'currentColor'} />
      </MyTooltip>
    </Flex>
  );
};

export default BuiltinLibraryEntryButton;
