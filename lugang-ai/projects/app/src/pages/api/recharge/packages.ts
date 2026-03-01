/**
 * 鲁港通 - 获取充值套餐列表 API
 * 返回可用的充值套餐
 * Requirements: 10.1
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { addLog } from '@fastgpt/service/common/system/log';
import { getRechargePackages } from '@fastgpt/service/support/user/integration/recharge';
import { authUserPer } from '@fastgpt/service/support/permission/auth/user';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      return jsonRes(res, { code: 405, error: 'Method not allowed' });
    }

    // 验证用户身份
    await authUserPer({
      req,
      authToken: true,
      per: 'r'
    });

    // Requirement 10.1: 从鲁港通后端获取充值套餐列表
    const packages = await getRechargePackages();

    if (!packages || packages.length === 0) {
      addLog.warn('鲁港通后端充值套餐查询返回空');
      return jsonRes(res, {
        data: []
      });
    }

    addLog.info('鲁港通充值套餐查询成功', { count: packages.length });

    return jsonRes(res, {
      data: packages
    });
  } catch (error: any) {
    addLog.error('鲁港通充值套餐查询失败', error);
    return jsonRes(res, {
      code: 500,
      error: error.message || '获取充值套餐失败'
    });
  }
}
