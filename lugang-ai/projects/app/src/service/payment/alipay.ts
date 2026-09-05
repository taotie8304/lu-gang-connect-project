// 鲁港通 - 支付宝当面付客户端（N4 在线支付）
// 普通公钥模式：应用私钥 + 支付宝公钥，凭证全部走环境变量
import AlipaySdk from 'alipay-sdk';
import { addLog } from '@fastgpt/service/common/system/log';

const ALIPAY_DEFAULT_GATEWAY = 'https://openapi.alipay.com/gateway.do';

const getAppId = () => process.env.ALIPAY_APP_ID;
const getAppPrivateKey = () => process.env.ALIPAY_APP_PRIVATE_KEY;
const getAlipayPublicKey = () => process.env.ALIPAY_PUBLIC_KEY;
const getGatewayUrl = () => process.env.ALIPAY_GATEWAY_URL || ALIPAY_DEFAULT_GATEWAY;
/** 支付宝异步通知地址（需公网可达），与开放平台「应用网关」配置保持一致 */
export const getAlipayNotifyUrl = () =>
  process.env.ALIPAY_NOTIFY_URL || 'https://www.airscend.com/api/pay/alipay/callback';

/** 支付宝凭证是否已配置（未配置时购买入口直接报可操作的中文错误） */
export const isAlipayConfigured = () =>
  Boolean(getAppId() && getAppPrivateKey() && getAlipayPublicKey());

let alipayClient: AlipaySdk | undefined;

const getClient = (): AlipaySdk => {
  if (!isAlipayConfigured()) {
    throw new Error('支付功能尚未配置，请联系管理员在服务端配置支付宝凭证后重试');
  }
  if (!alipayClient) {
    alipayClient = new AlipaySdk({
      appId: getAppId()!,
      privateKey: getAppPrivateKey()!,
      alipayPublicKey: getAlipayPublicKey()!,
      gateway: getGatewayUrl()
    });
  }
  return alipayClient;
};

/**
 * 当面付预下单：生成收款二维码内容。
 * @param outTradeNo 商户订单号（本地订单 orderId）
 * @param totalAmount 金额（元）
 * @param subject 订单标题
 * @returns 收款码内容字符串（前端渲染为二维码）
 */
export const alipayPrecreate = async ({
  outTradeNo,
  totalAmount,
  subject
}: {
  outTradeNo: string;
  totalAmount: number;
  subject: string;
}): Promise<string> => {
  const result = await getClient().exec('alipay.trade.precreate', {
    notifyUrl: getAlipayNotifyUrl(),
    bizContent: {
      out_trade_no: outTradeNo,
      total_amount: totalAmount.toFixed(2),
      subject
    }
  });

  const response = result as { code?: string; msg?: string; subMsg?: string; qrCode?: string };
  if (response.code !== '10000' || !response.qrCode) {
    addLog.error('支付宝预下单失败', {
      outTradeNo,
      code: response.code,
      msg: response.msg,
      subMsg: response.subMsg
    });
    throw new Error(`支付宝预下单失败（${response.subMsg || response.msg || response.code}），请稍后重试`);
  }
  return response.qrCode;
};

/**
 * 当面付查单：主动向支付宝查询订单交易状态。
 * 订单未创建（二维码尚未被扫）时返回空对象，不视为错误。
 */
export const alipayQueryOrder = async ({
  outTradeNo
}: {
  outTradeNo: string;
}): Promise<{ tradeStatus?: string; tradeNo?: string }> => {
  try {
    const result = await getClient().exec('alipay.trade.query', {
      bizContent: { out_trade_no: outTradeNo }
    });
    const response = result as {
      code?: string;
      subCode?: string;
      tradeStatus?: string;
      tradeNo?: string;
    };
    if (response.code === '10000') {
      return { tradeStatus: response.tradeStatus, tradeNo: response.tradeNo };
    }
    return {};
  } catch (error) {
    addLog.warn('支付宝查单异常，稍后由轮询/异步通知兜底', { outTradeNo, error });
    return {};
  }
};

/**
 * 验证支付宝异步通知签名，防止伪造到账消息。
 */
export const alipayVerifyNotify = async (
  postData: Record<string, string>
): Promise<boolean> => {
  try {
    return await getClient().checkNotifySign(postData, true);
  } catch (error) {
    addLog.error('支付宝异步通知验签异常', { error });
    return false;
  }
};
