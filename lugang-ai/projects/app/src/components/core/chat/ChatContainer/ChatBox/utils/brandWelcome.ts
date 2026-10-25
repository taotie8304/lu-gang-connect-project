import { ChatSourceTypeEnum } from '@fastgpt/global/core/chat/constants';

export type BrandWelcomeGateInput = {
  sourceType: ChatSourceTypeEnum;
  sourceId: string;
  defaultAppId: string;
};

/**
 * 鲁港通 - 品牌首屏只挂在默认 AI 助手（DEFAULT_APP_ID）上。
 * 其他助手有自己的欢迎语，品牌能力卡与建议词的提问口径不应落到它们身上。
 */
export const isBrandWelcomeApp = ({ sourceType, sourceId, defaultAppId }: BrandWelcomeGateInput) =>
  sourceType === ChatSourceTypeEnum.app && !!defaultAppId && sourceId === defaultAppId;
