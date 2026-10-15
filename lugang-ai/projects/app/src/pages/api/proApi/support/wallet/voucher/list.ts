// 鲁港通 - 用户持券列表（Credits 改革批 3：充值选券弹窗数据源，金额已换算为元）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { getUserVouchers } from '@fastgpt/service/support/wallet/voucher/controller';
import type { VoucherItemType } from '@fastgpt/global/support/wallet/voucher/type';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<VoucherItemType[]> {
  const { tmbId } = await authCert({ req, authToken: true });

  return getUserVouchers({ tmbId: String(tmbId) });
}

export default NextAPI(handler);
