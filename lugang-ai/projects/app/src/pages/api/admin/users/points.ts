/**
 * 鲁港通 - 管理员调整用户 Credits 接口
 *
 * POST /api/admin/users/points
 * body: { userId, delta, reason }
 *
 * delta 正数增加、负数扣减（非零整数）；扣减不得超过当前余额。
 * 仅 root 可用；root 账号只读；每次调整写入操作流水。
 */

import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { MongoUserPoints } from '@fastgpt/service/support/wallet/points/schema';
import { adjustUserPointsByAdmin } from '@fastgpt/service/support/wallet/points/controller';
import { addAuditLog } from '@fastgpt/service/support/user/audit/util';
import { AdminAuditEventEnum } from '@fastgpt/global/support/user/audit/constants';
import {
  authAdminRoot,
  getAdminOperatorName,
  resolveAdminTargetUser
} from '@/service/admin/userWallet';

export type AdminAdjustUserPointsBody = {
  userId: string;
  delta: number;
  reason: string;
};

export type AdminAdjustUserPointsResponse = {
  surplusPoints: number;
};

async function handler(
  req: ApiRequestProps<AdminAdjustUserPointsBody>,
  _res: ApiResponseType<AdminAdjustUserPointsResponse>
): Promise<AdminAdjustUserPointsResponse> {
  if (req.method !== 'POST') {
    throw new Error('Method not allowed');
  }

  const { tmbId: operatorTmbId } = await authAdminRoot(req);

  const { userId, delta, reason } = req.body ?? ({} as AdminAdjustUserPointsBody);

  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (trimmedReason.length < 2 || trimmedReason.length > 200) {
    throw new Error('请填写 2–200 字的调整原因');
  }
  if (typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0) {
    throw new Error('Credits 调整数量必须为非零整数');
  }

  const { user, member } = await resolveAdminTargetUser(userId);
  if (user.username === 'root') {
    throw new Error('root 账号为只读，不能调整 Credits');
  }

  const teamId = String(member.teamId);
  const tmbId = String(member._id);

  await adjustUserPointsByAdmin({ teamId, tmbId, delta });

  const latest = await MongoUserPoints.findOne({ tmbId }).lean();
  const operatorName = await getAdminOperatorName(operatorTmbId);

  await addAuditLog({
    teamId,
    tmbId,
    event: AdminAuditEventEnum.ADMIN_ADJUST_USER_POINTS,
    params: {
      name: operatorName,
      userName: user.username,
      delta,
      reason: trimmedReason
    }
  });

  return { surplusPoints: latest?.surplusPoints ?? 0 };
}

export default NextAPI(handler);
