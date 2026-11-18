import { NextAPI } from '@/service/middleware/entry';
import { type ApiRequestProps } from '@fastgpt/next/type';
import { authSandboxSession } from '@/service/core/sandbox/auth';
import { parseApiInput } from '@fastgpt/service/common/zod/requestParseError';
import {
  SandboxCheckExistBodySchema,
  SandboxCheckExistResponseSchema,
  type SandboxCheckExistResponse
} from '@fastgpt/global/openapi/core/ai/sandbox/api';
import { SandboxUnavailableReasonEnum } from '@fastgpt/global/core/ai/sandbox/constants';
import { checkSandboxSessionExist } from '@fastgpt/service/core/ai/sandbox/interface/session';
import { buildSandboxClientQueryFromChatSource } from '@fastgpt/service/core/ai/sandbox/interface/runtime';
import { resolveSandboxSessionAvailability } from '@/service/core/sandbox/access';

async function handler(req: ApiRequestProps): Promise<SandboxCheckExistResponse> {
  const { sourceType, sourceId, chatId, outLinkAuthData } = parseApiInput({
    req,
    bodySchema: SandboxCheckExistBodySchema
  }).body;

  const authResult = await authSandboxSession({
    req,
    sourceType,
    sourceId,
    chatId,
    outLinkAuthData
  });
  const { uid, sourceType: resolvedSourceType, sourceId: resolvedSourceId } = authResult;
  const availability = await resolveSandboxSessionAvailability(authResult);

  // 鲁港通 - 系统未开启 Sandbox 时不会配置 provider，存在性检查必然抛错（生产 500）；
  // 此时聊天页只需拿到不可用原因，短路返回
  if (!availability.available && availability.reason === SandboxUnavailableReasonEnum.systemDisabled) {
    return SandboxCheckExistResponseSchema.parse({
      exists: false,
      unavailableReason: availability.reason
    });
  }

  const sandboxQuery = buildSandboxClientQueryFromChatSource({
    sourceType: resolvedSourceType,
    sourceId: resolvedSourceId,
    userId: uid,
    chatId
  });

  return SandboxCheckExistResponseSchema.parse({
    exists: await checkSandboxSessionExist(sandboxQuery),
    unavailableReason: availability.available ? undefined : availability.reason
  });
}

export default NextAPI(handler);
