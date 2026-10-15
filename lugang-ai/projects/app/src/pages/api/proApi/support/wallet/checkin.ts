// 鲁港通 - 每日打卡接口（Credits 改革批 2）：GET 查询打卡状态，POST 结算打卡
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { checkin, getCheckinStatus } from '@fastgpt/service/support/wallet/checkin/controller';
import type {
  UserCheckinSettleResponse,
  UserCheckinStatusResponse
} from '@fastgpt/global/support/wallet/checkin/type';

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<UserCheckinSettleResponse | UserCheckinStatusResponse> {
  const { teamId, tmbId } = await authCert({ req, authToken: true });

  if (req.method === 'POST') {
    return checkin({ teamId, tmbId });
  }

  return getCheckinStatus({ tmbId });
}

export default NextAPI(handler);
