import React, { useState, type Dispatch } from 'react';
import { FormControl, Flex, Input, Button, Box, InputGroup, InputRightElement, IconButton } from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { LoginPageTypeEnum } from '@/web/support/user/login/constants';
import { postLoginSimple } from '@/web/support/user/api';
import type { LoginSuccessResponse } from '@/global/support/api/userRes';
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
import MyIcon from '@fastgpt/web/components/common/Icon';

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
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormType>();

  // 鲁港通 - 简化登录流程，移除验证码机制
  const { runAsync: onclickLogin, loading: requesting } = useRequest2(
    async ({ username, password }: LoginFormType) => {
      loginSuccess(
        await postLoginSimple({
          username,
          password,
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

  // 鲁港通 - 移除社区版判断，统一使用完整登录提示
  const placeholder = [t('common:support.user.login.Username')]
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
          {/* 鲁港通：淡蓝色边框输入框，带密码显示/隐藏功能 */}
          <InputGroup size={'lg'}>
            <Input
              bg={'white'}
              type={showPassword ? 'text' : 'password'}
              borderColor={'blue.200'}
              _hover={{ borderColor: 'blue.300' }}
              _focus={{ borderColor: 'blue.500', boxShadow: '0 0 0 1px #3B82F6' }}
              placeholder={t('common:support.user.login.Password')}
              {...register('password', {
                required: true,
                maxLength: {
                  value: 60,
                  message: t('login:password_condition')
                }
              })}
            />
            <InputRightElement>
              <IconButton
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                variant="ghost"
                size="sm"
                icon={<MyIcon name={showPassword ? 'visible' : 'invisible'} w="18px" />}
                onClick={() => setShowPassword(!showPassword)}
                _hover={{ bg: 'transparent' }}
              />
            </InputRightElement>
          </InputGroup>
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
