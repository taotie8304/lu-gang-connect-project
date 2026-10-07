// 鲁港通 - 工单详情（工单 + 消息流；打开即清本人侧未读）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { TicketDetailQuerySchema } from '@fastgpt/global/openapi/support/ticket/api';
import type { TicketDetailResponseType } from '@fastgpt/global/openapi/support/ticket/api';
import { getTicketDetail } from '@fastgpt/service/support/ticket/controller';

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<TicketDetailResponseType> {
  const { tmbId, isRoot } = await authCert({ req, authToken: true });

  const { ticketId } = TicketDetailQuerySchema.parse(req.query);

  return getTicketDetail({ ticketId, tmbId, isRoot });
}

export default NextAPI(handler);
