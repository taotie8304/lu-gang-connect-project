import React, { useState, type Dispatch } from 'react';
import {
  FormControl,
  Flex,
  Input,
  Button,
  Box,
  InputGroup,
  InputRightElement,
  IconButton
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { LoginPageTypeEnum } from '@/web/support/user/login/constants';
import { postLogin, getPreLogin } from '@/web/support/user/api';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useTranslation } from 'next-i18next';
import FormLayout from './FormLayout';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import { useSearchParams } from 'next/navigation';
import { UserErrEnum } from '@fastgpt/global/common/error/code/user';
import { useRouter } from 'next/router';
import { useMount } from 'ahooks';
import type { LangEnum } from '@fastgpt/global/common/i18n/type';
import type { LoginSuccessResponseType } from '@fastgpt/global/openapi/support/user/account/login/api';
import PolicyTip from './PolicyTip';
import { getRegisterMethods } from '@/web/common/system/utils';
import { getFastGPTSem, onFastGPTLoginSuccess } from '@/web/support/marketing/utils';
import MyIcon from '@fastgpt/web/components/common/Icon';

type LoginSuccessHandler = (res: LoginSuccessResponseType) => void | Promise<void>;

interface Props {
  setPageType: Dispatch<`${LoginPageTypeEnum}`>;
  loginSuccess: LoginSuccessHandler;
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
  const registerMethods = getRegisterMethods(feConfigs);
  const hasRegisterMethod = registerMethods.length > 0;
  const hasFindPasswordMethod = !!feConfigs?.find_password_method?.length;

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormType>();

  // 鲁港通 - 密码显示/隐藏状态
  const [showPassword, setShowPassword] = useState(false);

  const { runAsync: onclickLogin, loading: requesting } = useRequest(
    async ({ username, password }: LoginFormType) => {
      const { code } = await getPreLogin(username);
      const loginResponse = await postLogin({
        username,
        password,
        code,
        fastgpt_sem: getFastGPTSem(),
        language: i18n.language as LangEnum
      });
      await onFastGPTLoginSuccess(loginSuccess, loginResponse);
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

  // 鲁港通 - 移除社区版 root 登录提示，统一使用完整登录提示（本项目已开放注册）
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
        mt={[0, 8]}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !requesting) {
            handleSubmit(onclickLogin)();
          }
        }}
      >
        <FormControl isInvalid={!!errors.username}>
          {/* 鲁港通 - 淡蓝色边框输入框 */}
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
          {/* 鲁港通 - 淡蓝色边框输入框，带密码显示/隐藏功能 */}
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
        <PolicyTip />
        {/* 鲁港通 - 蓝色渐变登录按钮 */}
        <Button
          type="submit"
          mt={6}
          w={'100%'}
          size={'lg'}
          fontWeight={'semibold'}
          bg={'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'}
          color={'white'}
          _hover={{ bg: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
          _active={{ bg: 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)' }}
          isLoading={requesting}
          onClick={handleSubmit(onclickLogin)}
        >
          {t('login:Login')}
        </Button>

        {(hasFindPasswordMethod || hasRegisterMethod) && (
          <Flex
            mt={6}
            align={'center'}
            justifyContent={'center'}
            gap={0}
            color={'blue.600'}
            fontWeight={'medium'}
            h={'16px'}
            lineHeight={'16px'}
          >
            {hasFindPasswordMethod && (
              <Box
                cursor={'pointer'}
                _hover={{ textDecoration: 'underline' }}
                onClick={() => setPageType('forgetPassword')}
                fontSize="mini"
              >
                {t('login:forget_password')}
              </Box>
            )}
            {hasFindPasswordMethod && hasRegisterMethod && (
              <Box display={['block', 'block']} mx={3} h={'12px'} w={'1px'} bg={'myGray.250'}></Box>
            )}
            {hasRegisterMethod && (
              <Box
                cursor={'pointer'}
                _hover={{ textDecoration: 'underline' }}
                onClick={() => setPageType('register')}
                fontSize="mini"
                lineHeight="16px"
              >
                {t('login:register')}
              </Box>
            )}
          </Flex>
        )}
      </Box>
    </FormLayout>
  );
};

export default LoginForm;
