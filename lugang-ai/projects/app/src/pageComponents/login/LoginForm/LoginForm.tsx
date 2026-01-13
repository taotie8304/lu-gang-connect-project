import React, { useEffect, type Dispatch } from 'react';
import { FormControl, Flex, Input, Button, Box } from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { LoginPageTypeEnum } from '@/web/support/user/login/constants';
import { postLogin, getPreLogin } from '@/web/support/user/api';
import type { LoginSuccessResponse } from '@/global/support/api/userRes';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useTranslation } from 'next-i18next';
import FormLayout from './FormLayout';
import { useRequest2 } from '@fastgpt/web/hooks/useRequest';
import PolicyTip from './PolicyTip';
import { useSearchParams } from 'next/navigation';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { useRouter } from 'next/router';
import { useMount } from 'ahooks';
import type { LangEnum } from '@fastgpt/global/common/i18n/type';

interface Props {
  setPageType: Dispatch<`${LoginPageTypeEnum}`>;
  loginSuccess: (e: LoginSuccessResponse) => void;
}

interface LoginFormType {
  username: string;
  password: string;
}

const LoginForm = ({ setPageType, loginSuccess }: Props) => {
  const { t, i18n } = useTranslation();
  const { feConfigs } = useSystemStore();
  const query = useSearchParams();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormType>();

  const { runAsync: onclickLogin, loading: requesting } = useRequest2(
    async ({ username, password }: LoginFormType) => {
      const { code } = await getPreLogin(username);
      loginSuccess(
        await postLogin({
          username,
          password,
          code,
          language: i18n.language as LangEnum
        })
      );
    },
    {
      refreshDeps: [loginSuccess],
      successToast: t('login:login_success'),
      onError: (error: any) => {
        // 密码错误，需要清空 query 参数
        if (error.statusText === UserErrEnum.account_psw_error) {
          router.replace(
            router.pathname,
            {
              query: {
                ...router.query,
                u: '',
                p: ''
              }
            },
            {
              shallow: false
            }
          );
        }
      }
    }
  );

  const isCommunityVersion = !!(feConfigs?.register_method && !feConfigs?.isPlus);

  const placeholder = (() => {
    if (isCommunityVersion) {
      return t('login:use_root_login');
    }
    return [t('common:support.user.login.Username')]
      .concat(
        feConfigs?.login_method?.map((item) => {
          switch (item) {
            case 'email':
              return t('common:support.user.login.Email');
            case 'phone':
              return t('common:support.user.login.Phone number');
          }
        }) ?? []
      )
      .join('/');
  })();

  useMount(() => {
    const username = query.get('u');
    const password = query.get('p');
    if (username && password) {
      onclickLogin({
        username,
        password
      });
    }
  });

  return (
    <FormLayout setPageType={setPageType} pageType={LoginPageTypeEnum.passwordLogin}>
      <Box
        mt={8}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !requesting) {
            handleSubmit(onclickLogin)();
          }
        }}
      >
        <FormControl isInvalid={!!errors.username}>
          {/* 鲁港通：淡蓝色边框输入框 */}
          <Input
            bg={'white'}
            size={'lg'}
            placeholder={placeholder}
            borderColor={'blue.200'}
            _hover={{ borderColor: 'blue.300' }}
            _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px #3B82F6' }}
            {...register('username', {
              required: true
            })}
          ></Input>
        </FormControl>
        <FormControl mt={6} isInvalid={!!errors.password}>
          {/* 鲁港通：淡蓝色边框输入框 */}
          <Input
            bg={'white'}
            size={'lg'}
            type={'password'}
            borderColor={'blue.200'}
            _hover={{ borderColor: 'blue.300' }}
            _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px #3B82F6' }}
            placeholder={
              isCommunityVersion
                ? t('login:root_password_placeholder')
                : t('common:support.user.login.Password')
            }
            {...register('password', {
              required: true,
              maxLength: {
                value: 60,
                message: t('login:password_condition')
              }
            })}
          ></Input>
        </FormControl>
        <PolicyTip isCenter={false} />

        {/* 鲁港通：蓝色登录按钮 */}
        <Button
          type="submit"
          my={[5, 6]}
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
          onClick={handleSubmit(onclickLogin)}
        >
          {t('login:Login')}
        </Button>

        <Flex
          align={'center'}
          justifyContent={['flex-end', 'center']}
          color={'blue.600'}
          fontWeight={'medium'}
        >
          {feConfigs?.find_password_method && feConfigs.find_password_method.length > 0 && (
            <Box
              cursor={'pointer'}
              _hover={{ textDecoration: 'underline', color: 'blue.700' }}
              onClick={() => setPageType('forgetPassword')}
              fontSize="sm"
            >
              {t('login:forget_password')}
            </Box>
          )}
          {feConfigs?.register_method && feConfigs.register_method.length > 0 && (
            <Flex alignItems={'center'}>
              <Box mx={3} h={'12px'} w={'1px'} bg={'blue.200'}></Box>
              <Box
                cursor={'pointer'}
                _hover={{ textDecoration: 'underline', color: 'blue.700' }}
                onClick={() => setPageType('register')}
                fontSize="sm"
              >
                {t('login:register')}
              </Box>
            </Flex>
          )}
        </Flex>
      </Box>
    </FormLayout>
  );
};

export default LoginForm;
