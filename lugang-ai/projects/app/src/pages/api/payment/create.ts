/**
 * 鲁港通 - 创建支付订单 API
 * 发起支付流程
 * Requirements: 10.2, 10.3
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { jsonRes } from '@fastgpt/service/common/response';
import { addLog } from '@fastgpt/service/common/system/log';
import { createPaymentOrder } from '@fastgpt/service/support/payment/payment';
import { authUserPer } from '@fastgpt/service/support/permission/auth/user';
import type { PaymentRequest } from '@fastgpt/service/support/payment/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return jsonRes(res, { code: 405, error: 'Method not allowed' });
    }

    // 验证用户身份
    const { tmbId, userInfo } = await authUserPer({
      req,
      authToken: true,
      per: 'w'
    });

    const { package_id, payment_method, return_url, notify_url } = req.body as PaymentRequest & {
      return_url?: string;
      notify_url?: string;
    };

    // 验证参数
    if (!package_id || !payment_method) {
      return jsonRes(res, {
        code: 400,
        error: '缺少必要参数'
      });
    }

    // Requirement 10.2: 创建支付订单
    const paymentResponse = await createPaymentOrder(userInfo.username, {
      package_id,
      payment_method,
      return_url,
      notify_url
    });

    if (!paymentResponse) {
      addLog.warn('鲁港通支付订单创建失败', {
        username: userInfo.username,
        package_id
      });
      return jsonRes(res, {
        code: 500,
        error: '创建支付订单失败，请稍后再试'
      });
    }

    addLog.info('鲁港通支付订单创建成功', {
      username: userInfo.username,
      package_id,
      payment_method,
      order_id: paymentResponse.order_id
    });

    return jsonRes(res, {
      data: paymentResponse
    });
  } catch (error: any) {
    addLog.error('鲁港通支付订单创建失败', error);
    return jsonRes(res, {
      code: 500,
      error: error.message || '创建支付订单失败'
    });
  }
}
