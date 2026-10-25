// 鲁港通 - 办事浏览器入口按钮（内置浏览器 P1）：
// 挂在聊天输入框右侧按钮组（文件按钮之前），点击展开右侧浏览器面板
import { useContext } from 'react';
import { Flex } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import { BuiltinBrowserContext, useBuiltinBrowserVisible } from './context';
import { LG } from '@/pageComponents/chat/lugangTheme';

const BuiltinBrowserEntryButton = () => {
  const { t } = useTranslation();
  const isVisible = useBuiltinBrowserVisible();
  const builtinBrowser = useContext(BuiltinBrowserContext);

  if (!isVisible || !builtinBrowser) return null;

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
        if (!builtinBrowser.isOpen) builtinBrowser.openPanel();
      }}
    >
      <MyTooltip label={t('common:builtin_browser_open')}>
        <MyIcon name={'common/globalLine'} w={'18px'} h={'18px'} color={'currentColor'} />
      </MyTooltip>
    </Flex>
  );
};

export default BuiltinBrowserEntryButton;
