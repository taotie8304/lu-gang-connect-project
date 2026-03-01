/**
 * 鲁港通 - 查询支付状态 API
 * 用于前端轮询检查支付结果
 * Requirements: 10.4, 10.5
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { addLog } from '@fastgpt/service/common/system/log';
import { getPaymentOrder } from '@fastgpt/service/support/payment/payment';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { PaymentStatus } from '@fastgpt/service/support/payment/types';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';

/**
 * 查询支付订单状态
 * Requirement 10.5: 允许前端查询支付结果
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      return jsonRes(res, { code: 405, error: 'Method not allowed' });
    }

    // 验证用户身份
    const { tmbId, tmb } = await authUserPer({
      req,
      authToken: true,
      per: ReadPermissionVal
    });

    const { order_id } = req.query;

    if (!order_id || typeof order_id !== 'string') {
      return jsonRes(res, {
        code: 400,
        error: '缺少订单 ID'
      });
    }

    // 查询订单状态
    const order = await getPaymentOrder(order_id);

    if (!order) {
      addLog.warn('鲁港通支付订单查询失败', {
        username: tmb.username,
        order_id
      });
      return jsonRes(res, {
        code: 404,
        error: '订单不存在'
      });
    }

    // 验证订单所属用户
    if (order.username !== tmb.username) {
      addLog.warn('鲁港通支付订单用户不匹配', {
        username: tmb.username,
        order_username: order.username,
        order_id
      });
      return jsonRes(res, {
        code: 403,
        error: '无权访问此订单'
      });
    }

    addLog.info('鲁港通支付订单状态查询成功', {
      username: tmb.username,
      order_id,
      status: order.status
    });

    return jsonRes(res, {
      data: {
        order_id: order.order_id,
        status: order.status,
        amount: order.amount,
        payment_method: order.payment_method,
        created_at: order.created_at,
        paid_at: order.paid_at,
        expired_at: order.expired_at,
        is_success: order.status === PaymentStatus.Success,
        is_failed: order.status === PaymentStatus.Failed,
        is_pending: order.status === PaymentStatus.Pending
      }
    });
  } catch (error: any) {
    addLog.error('鲁港通支付订单状态查询失败', error);
    return jsonRes(res, {
      code: 500,
      error: error.message || '查询支付状态失败'
    });
  }
}
