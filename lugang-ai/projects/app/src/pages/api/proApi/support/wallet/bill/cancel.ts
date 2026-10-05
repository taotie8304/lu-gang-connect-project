// 鲁港通 - 取消订单（本地顶替商业版 proApi 通道，仅未支付订单可取消）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { cancelAlipayBill } from '@/service/payment/bill';
import { CancelBillPropsSchema } from '@fastgpt/global/openapi/support/wallet/bill/api';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<null> {
  const { teamId, tmbId, isRoot } = await authCert({ req, authToken: true });

  const { billId } = CancelBillPropsSchema.parse(req.body);

  // 鲁港通 - 个人积分账户：普通用户仅能取消自己的订单，管理员可取消团队全部订单
  await cancelAlipayBill({ teamId, billId, tmbId: isRoot ? undefined : String(tmbId) });

  return null;
}

export default NextAPI(handler);
