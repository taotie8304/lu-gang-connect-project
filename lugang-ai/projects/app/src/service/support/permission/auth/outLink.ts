import { POST } from '@fastgpt/service/common/api/plusRequest';
import type {
  AuthOutLinkChatProps,
  AuthOutLinkLimitProps,
  AuthOutLinkInitProps,
  AuthOutLinkResponse
} from '@fastgpt/global/support/outLink/api.d';
import { type ShareChatAuthProps } from '@fastgpt/global/support/permission/chat';
import { authOutLinkValid } from '@fastgpt/service/support/permission/publish/authLink';
import { AuthUserTypeEnum } from '@fastgpt/global/support/permission/constant';
import { OutLinkErrEnum } from '@fastgpt/global/common/error/code/outLink';
import { type OutLinkSchema } from '@fastgpt/global/support/outLink/type';

// 鲁港通 - 启用外链认证功能
export function authOutLinkInit(data: AuthOutLinkInitProps): Promise<AuthOutLinkResponse> {
  return POST<AuthOutLinkResponse>('/support/outLink/authInit', data).catch(() =>
    Promise.resolve({ uid: data.outLinkUid })
  );
}
export function authOutLinkChatLimit(data: AuthOutLinkLimitProps): Promise<AuthOutLinkResponse> {
  return POST<AuthOutLinkResponse>('/support/outLink/authChatStart', data).catch(() =>
    Promise.resolve({ uid: data.outLinkUid })
  );
}

export const authOutLink = async ({
  shareId,
  outLinkUid
}: ShareChatAuthProps): Promise<{
  uid: string;
  appId: string;
  outLinkConfig: OutLinkSchema;
}> => {
  if (!outLinkUid) {
    return Promise.reject(OutLinkErrEnum.linkUnInvalid);
  }
  const result = await authOutLinkValid({ shareId });

  const { uid } = await authOutLinkInit({
    outLinkUid,
    tokenUrl: result.outLinkConfig.limit?.hookUrl
  });

  return {
    ...result,
    uid
  };
};

export async function authOutLinkChatStart({
  shareId,
  ip,
  outLinkUid,
  question
}: AuthOutLinkChatProps & {
  shareId: string;
}) {
  // get outLink and app
  const { outLinkConfig, appId } = await authOutLinkValid({ shareId });

  // check ai points and chat limit
  const { uid } = await authOutLinkChatLimit({ outLink: outLinkConfig, ip, outLinkUid, question });

  return {
    sourceName: outLinkConfig.name,
    teamId: outLinkConfig.teamId,
    tmbId: outLinkConfig.tmbId,
    authType: AuthUserTypeEnum.token,
    responseDetail: outLinkConfig.responseDetail,
    showNodeStatus: outLinkConfig.showNodeStatus,
    appId,
    uid
  };
}
