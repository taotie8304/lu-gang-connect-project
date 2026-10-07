// 鲁港通 - 创建工单（用户反馈闭环）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { TicketCreatePropsSchema } from '@fastgpt/global/openapi/support/ticket/api';
import type { TicketCreateResponseType } from '@fastgpt/global/openapi/support/ticket/api';
import { createTicket } from '@fastgpt/service/support/ticket/controller';

async function handler(
  req: ApiRequestProps,
  _res: ApiResponseType
): Promise<TicketCreateResponseType> {
  const { teamId, tmbId } = await authCert({ req, authToken: true });

  const { type, title, content } = TicketCreatePropsSchema.parse({
    ...req.body,
    title: String(req.body?.title ?? '').trim(),
    content: String(req.body?.content ?? '').trim()
  });

  return createTicket({ teamId, tmbId, type, title, content });
}

export default NextAPI(handler);
