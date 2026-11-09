/**
 * 鲁港通 - 管理员用户钱包聚合接口
 *
 * GET /api/admin/users/wallet?userId=...
 *
 * 返回指定用户的 Credits 账户、持券列表与管理员操作流水（时间倒序，最多 50 条）。
 * 仅 root 可用；只读操作，不触发积分账户懒初始化。
 */

import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { MongoUserPoints } from '@fastgpt/service/support/wallet/points/schema';
import { getMemberVouchers } from '@fastgpt/service/support/wallet/voucher/controller';
import { MongoTeamAudit } from '@fastgpt/service/support/user/audit/schema';
import { AdminAuditEventEnum } from '@fastgpt/global/support/user/audit/constants';
import { StandardSubLevelEnum } from '@fastgpt/global/support/wallet/sub/constants';
import type { VoucherItemType } from '@fastgpt/global/support/wallet/voucher/type';
import { authAdminRoot, resolveAdminTargetUser } from '@/service/admin/userWallet';

export type AdminUserWalletQuery = {
  userId?: string;
};

export type AdminUserWalletLogItem = {
  _id: string;
  event: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
};

export type AdminUserWalletResponse = {
  tmbId: string;
  teamId: string;
  points: {
    surplusPoints: number;
    totalPoints: number;
    currentSubLevel: string;
    currentMode?: string;
    expiredTime?: Date;
  };
  vouchers: VoucherItemType[];
  logs: AdminUserWalletLogItem[];
};

async function handler(
  req: ApiRequestProps<Record<string, never>, AdminUserWalletQuery>,
  _res: ApiResponseType<AdminUserWalletResponse>
): Promise<AdminUserWalletResponse> {
  await authAdminRoot(req);

  const { member } = await resolveAdminTargetUser(req.query.userId);
  const teamId = String(member.teamId);
  const tmbId = String(member._id);

  const [account, vouchers, logs] = await Promise.all([
    MongoUserPoints.findOne({ tmbId }).lean(),
    getMemberVouchers({ teamId, tmbId }),
    MongoTeamAudit.find({
      teamId,
      tmbId,
      event: {
        $in: [
          AdminAuditEventEnum.ADMIN_ADJUST_USER_POINTS,
          AdminAuditEventEnum.ADMIN_ISSUE_USER_VOUCHER
        ]
      }
    })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean()
  ]);

  return {
    tmbId,
    teamId,
    points: {
      surplusPoints: account?.surplusPoints ?? 0,
      totalPoints: account?.totalPoints ?? 0,
      currentSubLevel: account?.currentSubLevel ?? StandardSubLevelEnum.free,
      currentMode: account?.currentMode,
      expiredTime: account?.expiredTime ?? undefined
    },
    vouchers,
    logs: logs.map((log) => ({
      _id: String(log._id),
      event: log.event,
      timestamp: log.timestamp,
      metadata: log.metadata as Record<string, unknown> | undefined
    }))
  };
}

export default NextAPI(handler);
