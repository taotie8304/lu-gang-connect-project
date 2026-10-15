// 鲁港通 - 每日打卡前端接口（Credits 改革批 2）
import { GET, POST } from '@/web/common/api/request';
import type {
  UserCheckinSettleResponse,
  UserCheckinStatusResponse
} from '@fastgpt/global/support/wallet/checkin/type';

export const getCheckinStatus = () =>
  GET<UserCheckinStatusResponse>('/proApi/support/wallet/checkin');

export const postCheckin = () => POST<UserCheckinSettleResponse>('/proApi/support/wallet/checkin');
