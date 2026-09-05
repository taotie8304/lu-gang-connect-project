// 鲁港通 - 取消订单（本地顶替商业版 proApi 通道，仅未支付订单可取消）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { cancelAlipayBill } from '@/service/payment/bill';
import { CancelBillPropsSchema } from '@fastgpt/global/openapi/support/wallet/bill/api';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<null> {
  const { teamId } = await authCert({ req, authToken: true });

  const { billId } = CancelBillPropsSchema.parse(req.body);

  await cancelAlipayBill({ teamId, billId });

  return null;
}

export default NextAPI(handler);
