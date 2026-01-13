import React, { type Dispatch } from 'react';
import { FormControl, Box, Input, Button } from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { LoginPageTypeEnum } from '@/web/support/user/login/constants';
import { postRegister } from '@/web/support/user/api';
import { useSendCode } from '@/web/support/user/hooks/useSendCode';
import type { LoginSuccessResponse } from '@/global/support/api/userRes';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useTranslation } from 'next-i18next';
import { useRequest2 } from '@fastgpt/web/hooks/useRequest';
import {
  getBdVId,
  getFastGPTSem,
  getInviterId,
  getMsclkid,
  getSourceDomain,
  removeFastGPTSem
} from '@/web/support/marketing/utils';
import { checkPasswordRule } from '@fastgpt/global/common/string/password';

interface Props {
  loginSuccess: (e: LoginSuccessResponse) => void;
  setPageType: Dispatch<`${LoginPageTypeEnum}`>;
}

interface RegisterType {
  username: string;
  password: string;
  password2: string;
  code: string;
}

const RegisterForm = ({ setPageType, loginSuccess }: Props) => {
  const { toast } = useToast();
  const { t } = useTranslation();

  const { feConfigs } = useSystemStore();
  const {
    register,
    handleSubmit,
    getValues,
    watch,
    formState: { errors }
  } = useForm<RegisterType>({
    mode: 'onBlur'
  });
  const username = watch('username');

  const { SendCodeBox, openCodeAuthModal } = useSendCode({ type: 'register' });

  const { runAsync: onclickRegister, loading: requesting } = useRequest2(
    async ({ username, password, code }: RegisterType) => {
      loginSuccess(
        await postRegister({
          username,
          code,
          password,
          inviterId: getInviterId(),
          bd_vid: getBdVId(),
          msclkid: getMsclkid(),
          fastgpt_sem: getFastGPTSem(),
          sourceDomain: getSourceDomain()
        })
      );
      removeFastGPTSem();

      toast({
        status: 'success',
        title: t('user:register.success')
      });
    },
    {
      refreshDeps: [loginSuccess, t, toast]
    }
  );
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

  const placeholder = feConfigs?.register_method
    ?.map((item) => {
      switch (item) {
        case 'email':
          return t('common:support.user.login.Email');
        case 'phone':
          return t('common:support.user.login.Phone number');
      }
    })
    .join('/');

  // 鲁港通：淡蓝色输入框样式
  const inputStyles = {
    bg: 'white',
    borderColor: 'blue.200',
    _hover: { borderColor: 'blue.300' },
    _focus: { borderColor: 'blue.500', boxShadow: '0 0 0 1px #3B82F6' }
  };

  return (
    <>
      {/* 鲁港通：淡蓝色渐变标题 */}
      <Box 
        fontWeight={'semibold'} 
        fontSize={'xl'} 
        textAlign={'center'} 
        background="linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)"
        backgroundClip="text"
        sx={{
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}
      >
        {t('user:register.register_account', { account: feConfigs?.systemTitle })}
      </Box>
      <Box
        mt={8}
        onKeyDown={(e) => {
          if (!openCodeAuthModal && e.key === 'Enter' && !e.shiftKey && !requesting) {
            handleSubmit(onclickRegister, onSubmitErr)();
          }
        }}
      >
        <FormControl isInvalid={!!errors.username}>
          <Input
            {...inputStyles}
            size={'lg'}
            placeholder={placeholder}
            {...register('username', {
              required: t('user:password.email_phone_void'),
              pattern: {
                value:
                  /(^1[3456789]\d{9}$)|(^[A-Za-z0-9]+([_\.][A-Za-z0-9]+)*@([A-Za-z0-9\-]+\.)+[A-Za-z]{2,6}$)/,
                message: t('user:password.email_phone_error')
              }
            })}
          ></Input>
        </FormControl>
        <FormControl
          mt={5}
          isInvalid={!!errors.code}
          display={'flex'}
          alignItems={'center'}
          position={'relative'}
        >
          <Input
            size={'lg'}
            {...inputStyles}
            flex={1}
            maxLength={8}
            placeholder={t('user:password.verification_code')}
            {...register('code', {
              required: t('user:password.code_required')
            })}
          ></Input>
          <SendCodeBox username={username} />
        </FormControl>
        <FormControl mt={5} isInvalid={!!errors.password}>
          <Input
            {...inputStyles}
            size={'lg'}
            type={'password'}
            placeholder={t('login:password_tip')}
            {...register('password', {
              required: true,
              validate: (val) => {
                if (!checkPasswordRule(val)) {
                  return t('login:password_tip');
                }
                return true;
              }
            })}
          ></Input>
        </FormControl>
        <FormControl mt={5} isInvalid={!!errors.password2}>
          <Input
            {...inputStyles}
            size={'lg'}
            type={'password'}
            placeholder={t('user:password.confirm')}
            {...register('password2', {
              validate: (val) =>
                getValues('password') === val ? true : t('user:password.not_match')
            })}
          />
        </FormControl>
        {/* 鲁港通：蓝色注册按钮 */}
        <Button
          type="submit"
          mt={8}
          w={'100%'}
          size={['md', 'lg']}
          h={[10, 12]}
          fontWeight={'semibold'}
          bg={'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'}
          color={'white'}
          _hover={{ bg: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
          _active={{ bg: 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)' }}
          borderRadius={'lg'}
          isLoading={requesting}
          onClick={handleSubmit(onclickRegister, onSubmitErr)}
        >
          {t('user:register.confirm')}
        </Button>
        <Box
          float={'right'}
          fontSize="sm"
          mt={4}
          fontWeight={'medium'}
          color={'blue.600'}
          cursor={'pointer'}
          _hover={{ textDecoration: 'underline', color: 'blue.700' }}
          onClick={() => setPageType(LoginPageTypeEnum.passwordLogin)}
        >
          {t('user:register.to_login')}
        </Box>
      </Box>
    </>
  );
};

export default RegisterForm;
