import { type AuthFrequencyLimitProps } from '@fastgpt/global/common/frequenctLimit/type';
import { POST } from '@fastgpt/service/common/api/plusRequest';

// 鲁港通 - 启用频率限制功能
export const authFrequencyLimit = (data: AuthFrequencyLimitProps) => {
  return POST('/common/freequencyLimit/auth', data).catch(() => undefined);
};
