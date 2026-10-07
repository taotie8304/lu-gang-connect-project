// 鲁港通 - 工单状态变更（管理员标记已解决/关闭/重新打开；用户仅可关闭本人已解决工单）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { TicketUpdateStatusPropsSchema } from '@fastgpt/global/openapi/support/ticket/api';
import type { TicketItemSchemaType } from '@fastgpt/global/openapi/support/ticket/api';
import { updateTicketStatus } from '@fastgpt/service/support/ticket/controller';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<TicketItemSchemaType> {
  const { tmbId, isRoot } = await authCert({ req, authToken: true });

  const { ticketId, status } = TicketUpdateStatusPropsSchema.parse(req.body);

  return updateTicketStatus({ ticketId, tmbId, isRoot, status });
}

export default NextAPI(handler);
