// 鲁港通 - 场景模板入口按钮（内置浏览器 P2）：
// 与办事浏览器入口同构，点击展开右栏面板并聚焦场景区
import { useContext } from 'react';
import { Flex } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import MyIcon from '@fastgpt/web/components/common/Icon';
import MyTooltip from '@fastgpt/web/components/common/MyTooltip';
import { BuiltinBrowserContext, useBuiltinBrowserVisible } from './context';
import { LG } from '@/pageComponents/chat/lugangTheme';

const BuiltinBrowserScenarioButton = () => {
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
        builtinBrowser.openScenario();
      }}
    >
      <MyTooltip label={t('common:builtin_browser_scenario_entry')}>
        <MyIcon name={'common/list'} w={'18px'} h={'18px'} color={'currentColor'} />
      </MyTooltip>
    </Flex>
  );
};

export default BuiltinBrowserScenarioButton;
