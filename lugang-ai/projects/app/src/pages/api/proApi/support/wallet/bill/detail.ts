// 鲁港通 - 订单详情（本地顶替商业版 proApi 通道；优惠券/发票信息为商业版能力，本地返回空）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoBill } from '@fastgpt/service/support/wallet/bill/schema';
import { BillDetailQuerySchema } from '@fastgpt/global/openapi/support/wallet/bill/api';
import type { BillDetailResponseType } from '@fastgpt/global/openapi/support/wallet/bill/api';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<BillDetailResponseType | null> {
  const { teamId } = await authCert({ req, authToken: true });

  const { billId } = BillDetailQuerySchema.parse(req.query);

  const bill = await MongoBill.findOne({ _id: billId, teamId }).lean();
  if (!bill) {
    return null;
  }

  return {
    _id: bill._id,
    teamId: bill.teamId,
    tmbId: bill.tmbId,
    createTime: bill.createTime,
    orderId: bill.orderId,
    status: bill.status,
    type: bill.type,
    price: bill.price,
    metadata: bill.metadata,
    paidAmount: bill.paidAmount
  };
}

export default NextAPI(handler);
