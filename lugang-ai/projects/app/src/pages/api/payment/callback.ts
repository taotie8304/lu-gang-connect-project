/**
 * 鲁港通 - 支付回调处理 API
 * 处理支付平台的回调通知
 * Requirements: 10.4, 10.5
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { addLog } from '@fastgpt/service/common/system/log';
import { verifyPaymentCallback } from '@fastgpt/service/support/payment/payment';
import type { PaymentCallback } from '@fastgpt/service/support/payment/types';
import { PaymentStatus } from '@fastgpt/service/support/payment/types';

/**
 * 支付回调处理
 * Requirement 10.4: 验证支付回调并更新用户余额
 * Requirement 10.5: 处理支付成功和失败情况
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return jsonRes(res, { code: 405, error: 'Method not allowed' });
    }

    // 解析回调数据
    const callbackData = req.body as PaymentCallback;

    addLog.info('鲁港通收到支付回调', {
      order_id: callbackData.order_id,
      status: callbackData.status,
      payment_method: callbackData.payment_method
    });

    // Requirement 10.4: 验证支付回调
    const verification = await verifyPaymentCallback(callbackData);

    if (!verification.is_valid) {
      addLog.warn('鲁港通支付回调验证失败', {
        order_id: callbackData.order_id,
        error: verification.error
      });
      return jsonRes(res, {
        code: 400,
        error: '支付回调验证失败'
      });
    }

    const order = verification.order;
    if (!order) {
      addLog.warn('鲁港通支付回调订单不存在', {
        order_id: callbackData.order_id
      });
      return jsonRes(res, {
        code: 404,
        error: '订单不存在'
      });
    }

    // Requirement 10.5: 处理支付成功
    if (callbackData.status === PaymentStatus.Success) {
      addLog.info('鲁港通支付成功', {
        order_id: order.order_id,
        username: order.username,
        amount: order.amount,
        transaction_id: callbackData.transaction_id
      });

      // 注意：余额更新由鲁港通后端处理
      // 前端只需要确认回调已处理
      return jsonRes(res, {
        data: {
          success: true,
          message: '支付成功',
          order_id: order.order_id
        }
      });
    }

    // Requirement 10.5: 处理支付失败
    if (callbackData.status === PaymentStatus.Failed) {
      addLog.warn('鲁港通支付失败', {
        order_id: order.order_id,
        username: order.username,
        status: callbackData.status
      });

      return jsonRes(res, {
        data: {
          success: false,
          message: '支付失败',
          order_id: order.order_id
        }
      });
    }

    // 其他状态
    addLog.info('鲁港通支付回调处理完成', {
      order_id: order.order_id,
      status: callbackData.status
    });

    return jsonRes(res, {
      data: {
        success: true,
        message: '回调已处理',
        order_id: order.order_id,
        status: callbackData.status
      }
    });
  } catch (error: any) {
    addLog.error('鲁港通支付回调处理失败', error);
    return jsonRes(res, {
      code: 500,
      error: error.message || '支付回调处理失败'
    });
  }
}
