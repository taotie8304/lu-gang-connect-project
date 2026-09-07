import { AppTypeEnum } from '@fastgpt/global/core/app/constants';
import type { InitChatResponseType } from '@fastgpt/global/openapi/core/chat/controler/api';

export const defaultChatData = {
  chatId: '',
  appId: '',
  app: {
    name: 'Loading',
    avatar: '/icon/logo.png', // 鲁港通 - 品牌默认头像（升级易被官方 logo.svg 覆盖）
    intro: '',
    canUse: false,
    type: AppTypeEnum.simple,
    pluginInputs: []
  },
  title: '',
  variables: {}
} satisfies InitChatResponseType;
