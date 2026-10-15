// 鲁港通 - 管理员发放代金券（Credits 改革批 3：用户管理页发券入口，支持单选/批量）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { issueVouchers } from '@fastgpt/service/support/wallet/voucher/controller';
import type {
  IssueVoucherProps,
  IssueVoucherResponse
} from '@fastgpt/global/support/wallet/voucher/type';
import { Types } from 'mongoose';

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<IssueVoucherResponse> {
  // 鲁港通 - 与成员管理同口径：仅团队管理员可发券
  const { teamId, tmbId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });

  const { tmbIds, amountYuan, note } = req.body as IssueVoucherProps;

  if (!Array.isArray(tmbIds) || tmbIds.length === 0) {
    throw new Error('请至少选择一名用户');
  }
  if (typeof amountYuan !== 'number' || !Number.isFinite(amountYuan)) {
    throw new Error('请输入正确的代金券金额');
  }
  if (tmbIds.some((id) => !Types.ObjectId.isValid(String(id)))) {
    throw new Error('部分用户不存在或不在当前团队，请刷新后重试');
  }

  return issueVouchers({
    teamId: String(teamId),
    tmbIds: tmbIds.map(String),
    amountYuan,
    note,
    issuedBy: String(tmbId)
  });
}

export default NextAPI(handler);
