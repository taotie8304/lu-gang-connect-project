// 鲁港通 - 订单详情（本地顶替商业版 proApi 通道；优惠券/发票信息为商业版能力，本地返回空）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { MongoBill } from '@fastgpt/service/support/wallet/bill/schema';
import { BillStatusEnum, BillTypeEnum, BillPayWayEnum } from '@fastgpt/global/support/wallet/bill/constants';
import { BillDetailQuerySchema } from '@fastgpt/global/openapi/support/wallet/bill/api';
import type { BillDetailResponseType } from '@fastgpt/global/openapi/support/wallet/bill/api';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<BillDetailResponseType | null> {
  const { teamId } = await authCert({ req, authToken: true });

  const { billId } = BillDetailQuerySchema.parse(req.query);

  const bill = await MongoBill.findOne({ _id: billId, teamId }).lean();
  if (!bill) {
    return null;
  }

  // 鲁港通 - 本地 BillSchemaType（unknown id / 模板字面量枚举 / payWay 可选）与官方 Zod 契约（string id / 原生枚举 / payWay 必填）不一致，边界处转换
  return {
    _id: String(bill._id),
    teamId: String(bill.teamId),
    tmbId: String(bill.tmbId),
    createTime: bill.createTime,
    orderId: bill.orderId,
    status: bill.status as unknown as BillStatusEnum,
    type: bill.type as unknown as BillTypeEnum,
    price: bill.price,
    metadata: {
      ...bill.metadata,
      payWay: bill.metadata.payWay ?? bill.payWay
    } as unknown as BillDetailResponseType['metadata'],
    paidAmount: bill.paidAmount
  };
}

export default NextAPI(handler);
