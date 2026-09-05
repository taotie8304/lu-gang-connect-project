// 鲁港通 - 订单列表（本地顶替商业版 proApi 通道，账户中心订单页数据源）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { getBillList } from '@/service/payment/bill';
import { BillListQuerySchema } from '@fastgpt/global/openapi/support/wallet/bill/api';
import type { GetBillListResponseType } from '@fastgpt/global/openapi/support/wallet/bill/api';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<GetBillListResponseType> {
  const { teamId } = await authCert({ req, authToken: true });

  const { offset, pageSize, type } = BillListQuerySchema.parse(req.body);

  return getBillList({ teamId, type, offset, pageSize });
}

export default NextAPI(handler);
