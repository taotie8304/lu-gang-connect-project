// 鲁港通 - 工单列表（普通用户看本人，管理员看全部 + 统计）
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { TicketListPropsSchema } from '@fastgpt/global/openapi/support/ticket/api';
import type { TicketListResponseType } from '@fastgpt/global/openapi/support/ticket/api';
import { listTickets } from '@fastgpt/service/support/ticket/controller';

async function handler(req: ApiRequestProps, _res: ApiResponseType): Promise<TicketListResponseType> {
  const { tmbId, isRoot } = await authCert({ req, authToken: true });

  const { status, type, search, page, pageSize } = TicketListPropsSchema.parse(req.body);

  return listTickets({
    tmbId,
    isRoot,
    status,
    type,
    search: search?.trim() || undefined,
    page,
    pageSize
  });
}

export default NextAPI(handler);
