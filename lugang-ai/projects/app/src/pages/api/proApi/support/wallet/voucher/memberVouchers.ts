// 鲁港通 - 管理员查看指定成员持券（Credits 改革批 3：发券/持券弹窗数据源）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { getMemberVouchers } from '@fastgpt/service/support/wallet/voucher/controller';
import type { VoucherItemType } from '@fastgpt/global/support/wallet/voucher/type';
import { Types } from 'mongoose';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<VoucherItemType[]> {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });

  const tmbId = String(req.query?.tmbId || '');
  if (!Types.ObjectId.isValid(tmbId)) {
    throw new Error('用户不存在，请刷新后重试');
  }

  return getMemberVouchers({ teamId: String(teamId), tmbId });
}

export default NextAPI(handler);
