// 鲁港通 - 优惠券列表（本地顶替商业版 proApi 通道；本地未启用优惠券体系，恒返回空列表）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import type { DiscountCouponListResponseType } from '@fastgpt/global/openapi/support/wallet/discountCoupon/api';

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<DiscountCouponListResponseType> {
  await authCert({ req, authToken: true });

  return [];
}

export default NextAPI(handler);
