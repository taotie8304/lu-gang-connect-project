// 鲁港通 - 工单未读计数（用户侧 / 管理侧入口红点）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import type { TicketUnreadCountResponseType } from '@fastgpt/global/openapi/support/ticket/api';
import { getTicketUnreadCount } from '@fastgpt/service/support/ticket/controller';

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<TicketUnreadCountResponseType> {
  const { tmbId, isRoot } = await authCert({ req, authToken: true });

  return { count: await getTicketUnreadCount({ tmbId, isRoot }) };
}

export default NextAPI(handler);
