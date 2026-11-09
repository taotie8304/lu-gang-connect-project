import { Box, Flex } from '@chakra-ui/react';
import MySelect from '@fastgpt/web/components/common/MySelect';
import { useI18nLng } from '@fastgpt/web/hooks/useI18n';
import { useTranslation } from 'next-i18next';
import { useCallback, useMemo } from 'react';
import MyIcon from '@fastgpt/web/components/common/Icon';
import type { LangEnum } from '@fastgpt/global/common/i18n/type';
import { langMap } from '@fastgpt/global/common/i18n/type';
import { useUserStore } from '@/web/support/user/useUserStore';
import { useToast } from '@fastgpt/web/hooks/useToast';

const I18nLngSelector = () => {
  const { i18n, t } = useTranslation();
  const { toast } = useToast();
  const { onChangeLng: onChangeLngI18n } = useI18nLng();
  const { userInfo, updateUserInfo } = useUserStore();

  const onChangeLng = useCallback(
    async (lng: `${LangEnum}`) => {
      // 先切换界面语言并结束加载态，用户偏好同步放后台，避免网络慢时下拉一直不可用
      try {
        await onChangeLngI18n(lng);
      } catch (error) {
        console.error('切换语言失败', error);
        toast({
          status: 'error',
          title: t('common:language_switch_failed')
        });
        return;
      }

      if (userInfo?.username) {
        updateUserInfo({ language: lng }).catch((error) => {
          console.error('同步语言偏好失败', error);
        });
      }
    },
    [userInfo?.username, onChangeLngI18n, updateUserInfo, toast, t]
  );

  const list = useMemo(() => {
    return Object.entries(langMap).map(([key, lang]) => ({
      label: (
        <Flex alignItems={'center'}>
          <MyIcon borderRadius={'0'} mr={2} name={lang.avatar as any} w={'1rem'} />
          <Box>{lang.label}</Box>
        </Flex>
      ),
      value: key
    }));
  }, []);

  return (
    <MySelect
      value={i18n.language}
      list={list}
      onChange={(val: any) => {
        const lang = val;
        onChangeLng(lang);
      }}
    />
  );
};

export default I18nLngSelector;
