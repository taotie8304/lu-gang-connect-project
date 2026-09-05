// 鲁港通 - 支付宝当面付异步通知（N4 在线支付）
// 与开放平台「应用网关」配置的回调地址一致：https://www.airscend.com/api/pay/alipay/callback
// 注意：支付宝要求响应纯文本 "success"，不能走统一的 jsonRes 结构
import type { NextApiRequest, NextApiResponse } from 'next';
import { addLog } from '@fastgpt/service/common/system/log';
import { MongoBill } from '@fastgpt/service/support/wallet/bill/schema';
import { BillStatusEnum } from '@fastgpt/global/support/wallet/bill/constants';
import { PRICE_SCALE } from '@fastgpt/global/support/wallet/constants';
import { alipayVerifyNotify } from '@/service/payment/alipay';
import { settleBill } from '@/service/payment/bill';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST' || !req.body || typeof req.body !== 'object') {
      return res.status(200).send('fail');
    }

    const notifyData = req.body as Record<string, string>;
    const outTradeNo = notifyData.out_trade_no;
    if (!outTradeNo) {
      return res.status(200).send('fail');
    }

    // 验签：防止伪造到账通知
    const isValid = await alipayVerifyNotify(notifyData);
    if (!isValid) {
      addLog.warn('支付宝异步通知验签失败', { outTradeNo });
      return res.status(200).send('fail');
    }

    // 非到账类通知（交易关闭等）直接确认
    const tradeStatus = notifyData.trade_status;
    if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
      return res.status(200).send('success');
    }

    const bill = await MongoBill.findOne({ orderId: outTradeNo }).lean();
    if (!bill) {
      addLog.warn('支付宝异步通知找不到本地订单', { outTradeNo });
      return res.status(200).send('fail');
    }
    if (bill.status === BillStatusEnum.SUCCESS) {
      return res.status(200).send('success');
    }

    // 金额核对：通知金额与订单金额不一致时拒绝并留痕（验签已过，多为配置错误）
    const notifyAmount = Number(notifyData.total_amount);
    const billReadPrice = bill.price / PRICE_SCALE;
    if (Number.isFinite(notifyAmount) && Math.abs(notifyAmount - billReadPrice) > 0.01) {
      addLog.error('支付宝异步通知金额与订单不一致，拒绝核销', {
        outTradeNo,
        notifyAmount,
        billReadPrice
      });
      return res.status(200).send('fail');
    }

    await settleBill(bill, notifyData.trade_no);

    addLog.info('支付宝异步通知核销完成', { outTradeNo, tradeNo: notifyData.trade_no });
    return res.status(200).send('success');
  } catch (error) {
    // 返回 fail 让支付宝按官方重试策略（4m/10m/10m/1h/2h/6h/15h）重发通知
    addLog.error('支付宝异步通知处理异常', { error });
    return res.status(200).send('fail');
  }
}
