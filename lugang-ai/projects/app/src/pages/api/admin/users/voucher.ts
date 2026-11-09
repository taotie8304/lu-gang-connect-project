/**
 * 鲁港通 - 管理员发放代金券接口
 *
 * POST /api/admin/users/voucher
 * body: { userId, amountYuan, note? }
 *
 * 按元发放（最多两位小数，单次上限 ¥100,000），目标用户取最近登录的团队成员身份。
 * 仅 root 可用；root 账号只读；每次发放写入操作流水。
 */

import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { issueVouchers } from '@fastgpt/service/support/wallet/voucher/controller';
import { addAuditLog } from '@fastgpt/service/support/user/audit/util';
import { AdminAuditEventEnum } from '@fastgpt/global/support/user/audit/constants';
import {
  authAdminRoot,
  getAdminOperatorName,
  resolveAdminTargetUser
} from '@/service/admin/userWallet';

/** 单次发放上限（元） */
export const ADMIN_VOUCHER_MAX_YUAN = 100000;

export type AdminIssueVoucherBody = {
  userId: string;
  amountYuan: number;
  note?: string;
};

export type AdminIssueVoucherResponse = {
  success: boolean;
};

async function handler(
  req: ApiRequestProps<AdminIssueVoucherBody>,
  _res: ApiResponseType<AdminIssueVoucherResponse>
): Promise<AdminIssueVoucherResponse> {
  if (req.method !== 'POST') {
    throw new Error('Method not allowed');
  }

  const { tmbId: operatorTmbId } = await authAdminRoot(req);

  const { userId, amountYuan, note } = req.body ?? ({} as AdminIssueVoucherBody);

  if (typeof amountYuan !== 'number' || !Number.isFinite(amountYuan) || amountYuan <= 0) {
    throw new Error('代金券金额必须大于 0');
  }
  if (amountYuan > ADMIN_VOUCHER_MAX_YUAN) {
    throw new Error('单次发放金额不能超过 ¥100,000');
  }
  const cents = amountYuan * 100;
  if (Math.abs(cents - Math.round(cents)) > 1e-6) {
    throw new Error('代金券金额最多保留两位小数');
  }
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  if (trimmedNote.length > 200) {
    throw new Error('备注不能超过 200 字');
  }

  const { user, member } = await resolveAdminTargetUser(userId);
  if (user.username === 'root') {
    throw new Error('root 账号为只读，不能发放代金券');
  }

  const teamId = String(member.teamId);
  const tmbId = String(member._id);

  await issueVouchers({
    teamId,
    tmbIds: [tmbId],
    amountYuan,
    note: trimmedNote,
    issuedBy: operatorTmbId || 'root'
  });

  const operatorName = await getAdminOperatorName(operatorTmbId);

  await addAuditLog({
    teamId,
    tmbId,
    event: AdminAuditEventEnum.ADMIN_ISSUE_USER_VOUCHER,
    params: {
      name: operatorName,
      userName: user.username,
      amountYuan,
      note: trimmedNote
    }
  });

  return { success: true };
}

export default NextAPI(handler);
