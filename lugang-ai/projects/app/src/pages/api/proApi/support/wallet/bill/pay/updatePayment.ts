// 鲁港通 - 更新支付方式（本地顶替商业版 proApi 通道）
// 第一期仅支持支付宝：切换其他支付方式时给出可操作的中文提示
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoBill } from '@fastgpt/service/support/wallet/bill/schema';
import { BillPayWayEnum } from '@fastgpt/global/support/wallet/bill/constants';
import { UpdatePaymentPropsSchema } from '@fastgpt/global/openapi/support/wallet/bill/api';
import type { UpdateBillResponseType } from '@fastgpt/global/openapi/support/wallet/bill/api';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<UpdateBillResponseType> {
  const { teamId } = await authCert({ req, authToken: true });

  const { billId, payWay } = UpdatePaymentPropsSchema.parse(req.body);

  if (payWay !== BillPayWayEnum.alipay) {
    throw new Error('目前仅支持支付宝支付，请使用支付宝扫码付款');
  }

  const bill = await MongoBill.findOne({ _id: billId, teamId }).lean();
  if (!bill) {
    throw new Error('订单不存在或无权操作');
  }
  if (!bill.qrCode) {
    throw new Error('该订单收款码已失效，请重新发起购买');
  }

  return { qrCode: bill.qrCode };
}

export default NextAPI(handler);
