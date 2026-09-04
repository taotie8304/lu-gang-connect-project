/**
 * 鲁港通 - 更新系统内容 API
 * PUT /api/system/content/update
 * 
 * 仅管理员可以访问，用于更新使用条款、隐私政策等内容
 */
import type { ApiRequestProps, ApiResponseType } from '@fastgpt/next/type';
import { NextAPI } from '@/service/middleware/entry';
import { authCert } from '@fastgpt/service/support/permission/auth/common';
import { updateSystemContent } from '@fastgpt/service/support/systemContent/controller';
import type {
  SystemContentResponse,
  SystemContentUpdateParams
} from '@fastgpt/global/support/systemContent/type';
import { SystemContentKeyEnum } from '@fastgpt/global/support/systemContent/constant';

async function handler(
  req: ApiRequestProps<SystemContentUpdateParams, undefined>,
  _res: ApiResponseType<SystemContentResponse>
): Promise<SystemContentResponse> {
  const { key, title, content, contentType } = req.body;

  if (!key || !content) {
    throw new Error('缺少必填参数');
  }
  // 鲁港通 - 验证 key 是否为合法内容键
  if (!(Object.values(SystemContentKeyEnum) as string[]).includes(key)) {
    throw new Error('无效的内容键');
  }

  // 鲁港通 - 仅管理员（root）可更新；底层错误由 controller 内部 logger 记录
  const { isRoot, userId } = await authCert({ req, authToken: true, authRoot: true });
  if (!isRoot) {
    throw new Error('无权限：仅管理员可访问');
  }

  return updateSystemContent({ key, title, content, contentType }, userId);
}

export default NextAPI(handler);
