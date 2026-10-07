// 鲁港通 - 回复工单（自动流转状态与对方未读）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { TicketReplyPropsSchema } from '@fastgpt/global/openapi/support/ticket/api';
import type { TicketItemSchemaType } from '@fastgpt/global/openapi/support/ticket/api';
import { replyTicket } from '@fastgpt/service/support/ticket/controller';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<TicketItemSchemaType> {
  const { tmbId, isRoot } = await authCert({ req, authToken: true });

  const { ticketId, content } = TicketReplyPropsSchema.parse({
    ...req.body,
    content: String(req.body?.content ?? '').trim()
  });

  return replyTicket({ ticketId, tmbId, isRoot, content });
}

export default NextAPI(handler);
