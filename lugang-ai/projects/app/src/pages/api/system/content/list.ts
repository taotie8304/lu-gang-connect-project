/**
 * 鲁港通 - 获取系统内容列表 API
 * GET /api/system/content/list
 * 
 * 仅管理员可以访问，用于管理后台显示所有系统内容
 */
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { getAllSystemContents } from '@fastgpt/service/support/systemContent/controller';
import type { SystemContentResponse } from '@fastgpt/global/support/systemContent/type';

async function handler(
  req: ApiRequestProps<undefined, undefined>,
  _res: ApiResponseType<SystemContentResponse[]>
): Promise<SystemContentResponse[]> {
  // 鲁港通 - 仅管理员（root）可访问；底层错误由 controller 内部 logger 记录
  const { isRoot } = await authCert({ req, authToken: true, authRoot: true });
  if (!isRoot) {
    throw new Error('无权限：仅管理员可访问');
  }

  return getAllSystemContents();
}

export default NextAPI(handler);
