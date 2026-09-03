import React, { useState, type Dispatch } from 'react';
import {
  FormControl,
  Box,
  Input,
  Button,
  InputGroup,
  InputRightElement,
  IconButton
} from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { LoginPageTypeEnum } from '@/web/support/user/login/constants';
import { postRegister } from '@/web/support/user/api';
import { useSendCode } from '@/web/support/user/hooks/useSendCode';
import { useToast } from '@fastgpt/web/hooks/useToast';
import { useSystemStore } from '@/web/common/system/useSystemStore';
import { useTranslation } from 'next-i18next';
import { useRequest } from '@fastgpt/web/hooks/useRequest';
import {
  getBdVId,
  getFastGPTSem,
  getMsclkid,
  onFastGPTLoginSuccess
} from '@/web/support/marketing/utils';
import { checkPasswordRule } from '@fastgpt/global/common/string/password';
import MyIcon from '@fastgpt/web/components/common/Icon';
// 鲁港通 - 手机号判断（复用注册校验工具）
import { isPhone } from '@fastgpt/global/support/user/validation';
import type { LoginSuccessResponseType } from '@fastgpt/global/openapi/support/user/account/login/api';
import type { LangEnum } from '@fastgpt/global/common/i18n/type';
import { getRegisterMethods } from '@/web/common/system/utils';
import { VerificationCodeTypeEnum } from '@fastgpt/global/support/user/account/verification/constants';
import {
  AccountEmailUsernameSchema,
  AccountPhoneUsernameSchema
} from '@fastgpt/global/support/user/account/verification/type';

type LoginSuccessHandler = (res: LoginSuccessResponseType) => void | Promise<void>;

interface Props {
  loginSuccess: LoginSuccessHandler;
  setPageType: Dispatch<`${LoginPageTypeEnum}`>;
}

interface RegisterType {
  username: string;
  password: string;
  password2: string;
  code: string;
  // 鲁港通 - 邮箱注册时必填手机号（同步后端，不发验证码）；手机号注册时必填邮箱（接收验证码）
  phone?: string;
  email?: string;
}

const RegisterForm = ({ setPageType, loginSuccess }: Props) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  // 鲁港通 - 密码显示/隐藏状态
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

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
  const email = watch('email');
  const registerMethods = getRegisterMethods(feConfigs);

  // 鲁港通 - 手机号注册时验证码发到邮箱；邮箱注册时发到邮箱本身
  const isPhoneInput = isPhone(username || '');
  const codeTargetUsername = isPhoneInput ? email || '' : username || '';

  const validateUsername = (value: string) => {
    const method = (() => {
      if (AccountEmailUsernameSchema.safeParse(value).success) return 'email';
      if (AccountPhoneUsernameSchema.safeParse(value).success) return 'phone';
    })();

    if (!method) return t('user:password.email_phone_error');
    return registerMethods.includes(method) || t('common:error.registration_method_not_supported');
  };

  const { SendCodeBox, openCodeAuthModal } = useSendCode({
    type: VerificationCodeTypeEnum.register,
    purpose: 'register',
    validateBeforeSend: validateUsername
  });

  const { runAsync: onclickRegister, loading: requesting } = useRequest(
    async ({ username, password, code, email, phone }: RegisterType) => {
      const loginResponse = await postRegister({
        username,
        code,
        password,
        bd_vid: getBdVId(),
        msclkid: getMsclkid(),
        fastgpt_sem: getFastGPTSem(),
        language: i18n.language as LangEnum,
        // 鲁港通 - 手机号注册传邮箱；邮箱注册传手机号
        ...(isPhone(username) && email ? { email } : {}),
        ...(!isPhone(username) && phone ? { phone } : {})
      });
      await onFastGPTLoginSuccess(loginSuccess, loginResponse);

      toast({
        status: 'success',
        title: t('user:register.success')
      });
    },
    {
      refreshDeps: [i18n.language, loginSuccess, t, toast]
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

  const placeholder = registerMethods
    .map((item) => {
      switch (item) {
        case 'email':
          return t('common:support.user.login.Email');
        case 'phone':
          return t('common:support.user.login.Phone number');
      }
    })
    .join('/');

  // 鲁港通 - 淡蓝色输入框样式
  const inputStyles = {
    bg: 'white',
    borderColor: 'blue.200',
    _hover: { borderColor: 'blue.300' },
    _focus: { borderColor: 'blue.500', boxShadow: '0 0 0 1px #3B82F6' }
  };

  return (
    <>
      {/* 鲁港通 - 淡蓝色渐变标题 */}
      <Box
        fontWeight={'semibold'}
        fontSize={'xl'}
        lineHeight={'30px'}
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
        mt={9}
        onKeyDown={(e) => {
          if (
            !openCodeAuthModal &&
            e.key === 'Enter' &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing &&
            e.keyCode !== 229 &&
            !requesting
          ) {
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
              validate: validateUsername
            })}
          ></Input>
        </FormControl>

        {/* 鲁港通 - 手机号注册时显示邮箱输入框（用于接收验证码） */}
        {isPhoneInput && (
          <FormControl mt={6} isInvalid={!!errors.email}>
            <Input
              {...inputStyles}
              size={'lg'}
              placeholder="请输入邮箱（用于接收验证码）"
              {...register('email', {
                required: '手机号注册需要提供邮箱',
                pattern: {
                  value: /^[A-Za-z0-9]+([_\.][A-Za-z0-9]+)*@([A-Za-z0-9\-]+\.)+[A-Za-z]{2,6}$/,
                  message: '请输入正确的邮箱地址'
                }
              })}
            />
          </FormControl>
        )}

        {/* 鲁港通 - 邮箱注册时显示手机号输入框（必填，同步后端，不发验证码） */}
        {!isPhoneInput && (
          <FormControl mt={6} isInvalid={!!errors.phone}>
            <Input
              {...inputStyles}
              size={'lg'}
              placeholder="请输入手机号"
              {...register('phone', {
                required: '手机号为必填项',
                pattern: {
                  value: /^1[3-9]\d{9}$/,
                  message: '请输入正确的手机号'
                }
              })}
            />
          </FormControl>
        )}

        <FormControl
          mt={6}
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
          <SendCodeBox username={codeTargetUsername} />
        </FormControl>
        <FormControl mt={6} isInvalid={!!errors.password}>
          {/* 鲁港通 - 密码显示/隐藏 */}
          <InputGroup size={'lg'}>
            <Input
              {...inputStyles}
              type={showPassword ? 'text' : 'password'}
              placeholder={t('common:support.user.login.Password')}
              _invalid={{
                borderColor: 'red.500',
                boxShadow: '0 0 0 1px #F04438'
              }}
              {...register('password', {
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
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                variant="ghost"
                size="sm"
                icon={<MyIcon name={showPassword ? 'visible' : 'invisible'} w="18px" />}
                onClick={() => setShowPassword(!showPassword)}
                _hover={{ bg: 'transparent' }}
              />
            </InputRightElement>
          </InputGroup>
          <Box
            mt={2}
            fontSize={'mini'}
            lineHeight={'16px'}
            fontWeight={'medium'}
            letterSpacing={'0.5px'}
            wordBreak={'break-word'}
            color={errors.password ? 'red.600' : 'myGray.400'}
          >
            {t('login:password_tip')}
          </Box>
        </FormControl>
        <FormControl mt={6} isInvalid={!!errors.password2}>
          {/* 鲁港通 - 确认密码显示/隐藏 */}
          <InputGroup size={'lg'}>
            <Input
              {...inputStyles}
              type={showPassword2 ? 'text' : 'password'}
              placeholder={t('user:password.confirm')}
              {...register('password2', {
                validate: (val) =>
                  getValues('password') === val ? true : t('user:password.not_match')
              })}
            />
            <InputRightElement>
              <IconButton
                aria-label={showPassword2 ? '隐藏密码' : '显示密码'}
                variant="ghost"
                size="sm"
                icon={<MyIcon name={showPassword2 ? 'visible' : 'invisible'} w="18px" />}
                onClick={() => setShowPassword2(!showPassword2)}
                _hover={{ bg: 'transparent' }}
              />
            </InputRightElement>
          </InputGroup>
        </FormControl>
        <Button
          type="submit"
          mt={12}
          w={'100%'}
          size={['md', 'md']}
          rounded={['sm', 'md']}
          h={['34px', '40px']}
          fontWeight={'semibold'}
          bg={'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'}
          color={'white'}
          _hover={{ bg: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
          _active={{ bg: 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)' }}
          isLoading={requesting}
          onClick={handleSubmit(onclickRegister, onSubmitErr)}
        >
          {t('user:register.confirm')}
        </Button>
        <Box
          float={'right'}
          fontSize="mini"
          lineHeight={'18px'}
          mt={3}
          fontWeight={'medium'}
          color={'primary.700'}
          cursor={'pointer'}
          _hover={{ textDecoration: 'underline' }}
          onClick={() => setPageType(LoginPageTypeEnum.passwordLogin)}
        >
          {t('user:register.to_login')}
        </Box>
      </Box>
    </>
  );
};

export default RegisterForm;
