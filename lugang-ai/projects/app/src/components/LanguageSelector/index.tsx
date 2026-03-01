/**
 * 鲁港通 - 语言选择组件
 * 用于用户设置面板中的语言切换功能
 */
import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  Flex,
  Text,
  Box
} from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import { LangEnum, langMap } from '@fastgpt/global/common/i18n/type';
import { useI18nLng } from '@fastgpt/web/hooks/useI18n';
import { useUserStore } from '@/web/support/user/useUserStore';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { useToast } from '@fastgpt/web/hooks/useToast';

interface LanguageSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { onChangeLng } = useI18nLng();
  const { userInfo, updateUserInfo } = useUserStore();
  const { toast } = useToast();

  // 鲁港通：获取当前语言
  const currentLanguage = userInfo?.language || LangEnum.zh_CN;

  // 鲁港通：可用语言列表
  const languages = [
    {
      key: LangEnum.zh_CN,
      label: langMap[LangEnum.zh_CN].label,
      icon: langMap[LangEnum.zh_CN].avatar
    },
    {
      key: LangEnum.zh_Hant,
      label: langMap[LangEnum.zh_Hant].label,
      icon: langMap[LangEnum.zh_Hant].avatar
    },
    {
      key: LangEnum.en,
      label: langMap[LangEnum.en].label,
      icon: langMap[LangEnum.en].avatar
    }
  ];

  // 鲁港通：处理语言切换
  const handleLanguageChange = async (lang: LangEnum) => {
    try {
      // 切换界面语言
      await onChangeLng(lang);

      // 保存到用户配置
      await updateUserInfo({ language: lang });

      toast({
        title: t('common:language_switch_success'),
        status: 'success'
      });

      onClose();
    } catch (error) {
      console.error('鲁港通：语言切换失败', error);
      toast({
        title: t('common:language_switch_failed'),
        status: 'error'
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t('common:select_language')}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={2} align="stretch">
            {languages.map((lang) => (
              <Flex
                key={lang.key}
                alignItems="center"
                cursor="pointer"
                _hover={{ bg: 'myGray.100' }}
                bg={currentLanguage === lang.key ? 'primary.50' : 'transparent'}
                py={3}
                px={4}
                borderRadius="md"
                gap={3}
                onClick={() => handleLanguageChange(lang.key)}
                position="relative"
              >
                <MyIcon name={lang.icon as any} w="24px" h="24px" />
                <Text fontSize="14px" fontWeight="500">
                  {lang.label}
                </Text>
                {currentLanguage === lang.key && (
                  <Box position="absolute" right={4}>
                    <MyIcon name="common/check" w="16px" h="16px" color="primary.600" />
                  </Box>
                )}
              </Flex>
            ))}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default LanguageSelector;
