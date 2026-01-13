/**
 * 鲁港通 - 鲁港通后端额度查询接口
 * GET /api/integration/oneapi/quota
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { getOneApiUserByUsername, getOneApiUserQuota } from '@/service/integration/oneapi';
import { jsonRes } from '@fastgpt/service/common/response';

export type QuotaResponse = {
  quota: number;
  usedQuota: number;
  remainingQuota: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return jsonRes(res, {
      code: 405,
      error: 'Method not allowed',
    });
  }

  try {
    // 验证用户身份
    const { tmbId, userId } = await authCert({ req, authToken: true });

    if (!userId) {
      return jsonRes(res, {
        code: 401,
        error: 'Unauthorized',
      });
    }

    // 获取用户信息（需要从数据库获取用户邮箱）
    // 这里假设用户名就是邮箱
    const { MongoUser } = await import('@fastgpt/service/support/user/schema');
    const user = await MongoUser.findById(userId).lean();

    if (!user) {
      return jsonRes(res, {
        code: 404,
        error: 'User not found',
      });
    }

    // 通过用户名查询鲁港通后端用户
    const oneApiUserResult = await getOneApiUserByUsername(user.username);

    if (!oneApiUserResult.success || !oneApiUserResult.data) {
      // 如果鲁港通后端中没有该用户，返回默认值
      return jsonRes(res, {
        data: {
          quota: 0,
          usedQuota: 0,
          remainingQuota: 0,
        } as QuotaResponse,
      });
    }

    const oneApiUser = oneApiUserResult.data;

    // 计算剩余额度
    const remainingQuota = Math.max(0, oneApiUser.quota - oneApiUser.used_quota);

    return jsonRes(res, {
      data: {
        quota: oneApiUser.quota,
        usedQuota: oneApiUser.used_quota,
        remainingQuota,
      } as QuotaResponse,
    });
  } catch (error: any) {
    return jsonRes(res, {
      code: 500,
      error: error.message || 'Internal server error',
    });
  }
}
