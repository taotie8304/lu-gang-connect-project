// 鲁港通 - 个人积分账户前端接口
import { GET } from '@/web/common/api/request';
import type { UserPointsDetailType } from '@fastgpt/global/support/wallet/points/type';

export const getUserPointsDetail = () =>
  GET<UserPointsDetailType>('/proApi/support/wallet/points/detail');
