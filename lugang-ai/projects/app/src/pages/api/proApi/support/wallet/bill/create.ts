// 鲁港通 - 创建支付订单（本地顶替商业版 proApi 通道，N4 支付宝当面付）
// 静态路由优先于 proApi/[...path].ts 代理，前端零改动
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { CreateBillPropsSchema } from '@fastgpt/global/openapi/support/wallet/bill/api';
import { createAlipayBill } from '@/service/payment/bill';
import { isAlipayConfigured } from '@/service/payment/alipay';
import type { CreateBillResponseType } from '@fastgpt/global/openapi/support/wallet/bill/api';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<CreateBillResponseType> {
  if (!isAlipayConfigured()) {
    throw new Error('支付功能尚未配置，请联系管理员在服务端配置支付宝凭证后重试');
  }

  // 鲁港通 - 任何登录成员均可发起购买（消费者模式：下单人不限团队角色）
  const { teamId, tmbId } = await authUserPer({ req, authToken: true });

  const props = CreateBillPropsSchema.parse(req.body);

  if (props.type === 'extraDatasetSub') {
    throw new Error('额外存储容量暂不支持在线购买，如有需要请联系客服');
  }

  return createAlipayBill({
    teamId,
    tmbId,
    ...(props.type === 'standSubPlan'
      ? { type: props.type, level: props.level, subMode: props.subMode }
      : { type: props.type, extraPoints: props.extraPoints, month: props.month }),
    // 鲁港通 - 代金券：透传选用的券 ID（服务端锁券校验，越权/占用/余额不足会终止下单）
    ...(props.voucherId ? { voucherId: props.voucherId } : {})
  });
}

export default NextAPI(handler);
