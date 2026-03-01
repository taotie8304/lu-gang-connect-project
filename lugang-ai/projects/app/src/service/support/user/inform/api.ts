// 鲁港通 - 用户通知 API
import { POST } from '@fastgpt/service/common/api/plusRequest';
import { type SendInform2UserProps } from '@fastgpt/global/support/user/inform/type';
import { FastGPTProUrl } from '@fastgpt/service/common/system/constants';

// 鲁港通 - 发送单个通知给用户
export function sendOneInform(data: SendInform2UserProps) {
  // 鲁港通 - 未配置商业版时直接返回
  if (!FastGPTProUrl) return;
  return POST('/support/user/inform/create', data);
}
