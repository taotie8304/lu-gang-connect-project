// 鲁港通 - Web 官网首页入口：挂载 v4 营销首页，登录表单内嵌首屏工作台
import React from 'react';
import { type LoginSuccessResponseType } from '@fastgpt/global/openapi/support/user/account/login/api';
import HomePage from './home';

type LoginHeroModalProps = {
  onSuccess: (e: LoginSuccessResponseType) => any;
};

const LoginHeroModal = ({ onSuccess }: LoginHeroModalProps) => <HomePage onSuccess={onSuccess} />;

export default LoginHeroModal;
