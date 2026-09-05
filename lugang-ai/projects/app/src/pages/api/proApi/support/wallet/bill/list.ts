// 鲁港通 - 订单列表（本地顶替商业版 proApi 通道，账户中心订单页数据源）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { getBillList } from '@/service/payment/bill';
import { BillListQuerySchema } from '@fastgpt/global/openapi/support/wallet/bill/api';
import type { GetBillListResponseType, BillItemType } from '@fastgpt/global/openapi/support/wallet/bill/api';
import { BillStatusEnum, BillTypeEnum, BillPayWayEnum } from '@fastgpt/global/support/wallet/bill/constants';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<GetBillListResponseType> {
  const { teamId } = await authCert({ req, authToken: true });

  const { offset, pageSize, type } = BillListQuerySchema.parse(req.body);

  const { list, total } = await getBillList({ teamId, type, offset, pageSize });

  // 鲁港通 - 本地 BillSchemaType（unknown id / 模板字面量枚举 / payWay 可选）与官方 Zod 契约（string id / 原生枚举 / payWay 必填）不一致，边界处转换
  return {
    total,
    list: list.map((bill) => ({
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
      } as unknown as BillItemType['metadata'],
      paidAmount: bill.paidAmount
    }))
  };
}

export default NextAPI(handler);
