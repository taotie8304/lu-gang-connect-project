/**
 * 鲁港通 - 获取用户账户信息 API
 * 返回用户的订阅和余额信息
 * Requirements: 9.1, 9.2, 9.3
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { addLog } from '@fastgpt/service/common/system/log';
import { getUserAccountInfo } from '@fastgpt/service/support/user/integration/subscription';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      return jsonRes(res, { code: 405, error: 'Method not allowed' });
    }

    // 验证用户身份
    const { tmbId } = await authUserPer({
      req,
      authToken: true,
      per: ReadPermissionVal
    });

    const { username } = req.query as { username: string };

    if (!username) {
      return jsonRes(res, { code: 400, error: '缺少用户名参数' });
    }

    // Requirement 9.1: 从鲁港通后端获取订阅和余额信息
    const accountInfo = await getUserAccountInfo(username);

    if (!accountInfo) {
      addLog.warn('鲁港通后端账户信息查询失败', { username });
      return jsonRes(res, {
        code: 404,
        error: '无法获取账户信息，请稍后再试'
      });
    }

    addLog.info('鲁港通账户信息查询成功', { username });

    return jsonRes(res, {
      data: accountInfo
    });
  } catch (error: any) {
    addLog.error('鲁港通账户信息查询失败', error);
    return jsonRes(res, {
      code: 500,
      error: error.message || '获取账户信息失败'
    });
  }
}
