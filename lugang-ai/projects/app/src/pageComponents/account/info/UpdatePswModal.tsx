import React, { useState } from 'react';
import { ModalBody, Box, Flex, Input, ModalFooter, Button, InputGroup, InputRightElement, IconButton } from '@chakra-ui/react';
import MyModal from '@fastgpt/web/components/common/MyModal';
import { useTranslation } from 'next-i18next';
import { useForm } from 'react-hook-form';
import { useRequest2 } from '@fastgpt/web/hooks/useRequest';
import { updatePasswordByOld } from '@/web/support/user/api';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { checkPasswordRule } from '@fastgpt/global/common/string/password';
import MyIcon from '@fastgpt/web/components/common/Icon';

type FormType = {
  oldPsw: string;
  newPsw: string;
  confirmPsw: string;
};

const UpdatePswModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // 鲁港通：密码显示/隐藏状态
  const [showOldPsw, setShowOldPsw] = useState(false);
  const [showNewPsw, setShowNewPsw] = useState(false);
  const [showConfirmPsw, setShowConfirmPsw] = useState(false);

  const { register, handleSubmit, getValues } = useForm<FormType>({
    defaultValues: {
      oldPsw: '',
      newPsw: '',
      confirmPsw: ''
    }
  });

  const { runAsync: onSubmit, loading: isLoading } = useRequest2(updatePasswordByOld, {
    onSuccess() {
      onClose();
    },
    successToast: t('account_info:password_update_success'),
    errorToast: t('account_info:password_update_error')
  });
  const onSubmitErr = (err: Record<string, any>) => {
    const val = Object.values(err)[0];
    if (!val) return;
    if (val.message) {
      toast({
        status: 'warning',
        title: val.message,
        duration: 3000,
        isClosable: true
      });
    }
  };

  return (
    <MyModal
      isOpen
      onClose={onClose}
      iconSrc="/imgs/modal/password.svg"
      title={t('account_info:update_password')}
    >
      <ModalBody>
        {/* 鲁港通：旧密码输入框，带眼睛图标 */}
        <Flex alignItems={'center'}>
          <Box flex={'0 0 70px'} fontSize={'sm'}>
            {t('account_info:old_password') + ':'}
          </Box>
          <InputGroup flex={1}>
            <Input type={showOldPsw ? 'text' : 'password'} {...register('oldPsw', { required: true })} />
            <InputRightElement>
              <IconButton
                aria-label={showOldPsw ? '隐藏密码' : '显示密码'}
                variant="ghost"
                size="sm"
                icon={<MyIcon name={showOldPsw ? 'visible' : 'invisible'} w="18px" />}
                onClick={() => setShowOldPsw(!showOldPsw)}
                _hover={{ bg: 'transparent' }}
              />
            </InputRightElement>
          </InputGroup>
        </Flex>
        {/* 鲁港通：新密码输入框，带眼睛图标 */}
        <Flex alignItems={'center'} mt={5}>
          <Box flex={'0 0 70px'} fontSize={'sm'}>
            {t('account_info:new_password') + ':'}
          </Box>
          <InputGroup flex={1}>
            <Input
              type={showNewPsw ? 'text' : 'password'}
              placeholder={t('account_info:password_tip')}
              {...register('newPsw', {
                required: true,
                validate: (val) => {
                  if (!checkPasswordRule(val)) {
                    return t('login:password_tip');
                  }
                  return true;
                }
              })}
            />
            <InputRightElement>
              <IconButton
                aria-label={showNewPsw ? '隐藏密码' : '显示密码'}
                variant="ghost"
                size="sm"
                icon={<MyIcon name={showNewPsw ? 'visible' : 'invisible'} w="18px" />}
                onClick={() => setShowNewPsw(!showNewPsw)}
                _hover={{ bg: 'transparent' }}
              />
            </InputRightElement>
          </InputGroup>
        </Flex>
        {/* 鲁港通：确认密码输入框，带眼睛图标 */}
        <Flex alignItems={'center'} mt={5}>
          <Box flex={'0 0 70px'} fontSize={'sm'}>
            {t('account_info:confirm_password') + ':'}
          </Box>
          <InputGroup flex={1}>
            <Input
              type={showConfirmPsw ? 'text' : 'password'}
              placeholder={t('user:password.confirm')}
              {...register('confirmPsw', {
                required: true,
                validate: (val) => (getValues('newPsw') === val ? true : t('user:password.not_match'))
              })}
            />
            <InputRightElement>
              <IconButton
                aria-label={showConfirmPsw ? '隐藏密码' : '显示密码'}
                variant="ghost"
                size="sm"
                icon={<MyIcon name={showConfirmPsw ? 'visible' : 'invisible'} w="18px" />}
                onClick={() => setShowConfirmPsw(!showConfirmPsw)}
                _hover={{ bg: 'transparent' }}
              />
            </InputRightElement>
          </InputGroup>
        </Flex>
      </ModalBody>
      <ModalFooter>
        <Button mr={3} variant={'whiteBase'} onClick={onClose}>
          {t('account_info:cancel')}
        </Button>
        <Button isLoading={isLoading} onClick={handleSubmit((data) => onSubmit(data), onSubmitErr)}>
          {t('account_info:confirm')}
        </Button>
      </ModalFooter>
    </MyModal>
  );
};

export default UpdatePswModal;
