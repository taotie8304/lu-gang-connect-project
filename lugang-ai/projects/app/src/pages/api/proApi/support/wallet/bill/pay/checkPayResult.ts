// 鲁港通 - 查询支付结果（本地顶替商业版 proApi 通道，前端扫码弹窗轮询入口）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { checkBillPayResult } from '@/service/payment/bill';
import type { CheckPayResultResponseType } from '@fastgpt/global/openapi/support/wallet/bill/api';

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<CheckPayResultResponseType> {
  const { teamId } = await authCert({ req, authToken: true });

  const payId = String(req.query?.payId || '');
  if (!payId) {
    throw new Error('缺少订单 ID，请刷新页面后重试');
  }

  return checkBillPayResult({ teamId, billId: payId });
}

export default NextAPI(handler);
