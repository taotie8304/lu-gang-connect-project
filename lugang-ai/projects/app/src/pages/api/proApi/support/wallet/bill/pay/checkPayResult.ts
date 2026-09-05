// 鲁港通 - 查询支付结果（本地顶替商业版 proApi 通道，前端扫码弹窗轮询入口）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { checkBillPayResult } from '@/service/payment/bill';
import { BillStatusEnum } from '@fastgpt/global/support/wallet/bill/constants';
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

  const result = await checkBillPayResult({ teamId, billId: payId });
  // 鲁港通 - 本地 checkBillPayResult 返回模板字面量枚举，官方契约要求原生枚举，边界处转换
  return { ...result, status: result.status as unknown as BillStatusEnum };
}

export default NextAPI(handler);
