import { addDays } from 'date-fns';
import type { CreatePostPresignedUrlResponseType } from '@fastgpt/global/common/file/s3/type';
import { S3ErrEnum } from '@fastgpt/global/common/error/code/s3';
import type { AppFileSelectConfigType } from '@fastgpt/global/core/app/type/config.schema';
import type { ChatSourceTypeEnum } from '@fastgpt/global/core/chat/constants';
import { getS3ChatSource } from '@fastgpt/service/common/s3/sources/chat';
import { getChatFileRetentionDays } from '@fastgpt/service/common/s3/sources/chat/retention';
import {
  getAllowedExtensionsFromFileSelectConfig,
  getUploadExtensionRulesFromFileSelectConfig
} from '@fastgpt/service/common/s3/utils/uploadConstraints';
import { assertUploadRateLimit } from '@fastgpt/service/common/rateLimit/interface/upload';
import { getTeamPlanStatus } from '@fastgpt/service/support/wallet/sub/utils';

/**
 * 根据已经完成授权的聊天目标和可信文件选择配置签发上传 URL。
 * `fileSelectConfig` 必须由正式配置解析或草稿权限校验产生，不能直接使用未授权请求值。
 */
export const createAuthorizedChatFileUploadUrl = async ({
  sourceType,
  sourceId,
  chatId,
  teamId,
  uid,
  fileSelectConfig,
  filename,
  contentType,
  declaredExtension,
  declaredFilename,
  size
}: {
  sourceType: ChatSourceTypeEnum;
  sourceId: string;
  chatId: string;
  teamId: string;
  uid: string;
  fileSelectConfig?: AppFileSelectConfigType;
  filename: string;
  contentType?: string;
  declaredExtension?: string;
  declaredFilename?: string;
  size?: number;
}): Promise<CreatePostPresignedUrlResponseType> => {
  const allowedExtensions = getAllowedExtensionsFromFileSelectConfig(fileSelectConfig);
  const extensionRules = getUploadExtensionRulesFromFileSelectConfig(fileSelectConfig);

  // 上传开关属于授权策略，即使跳过内容类型检测也不能绕过。
  if (allowedExtensions.length === 0) {
    return Promise.reject(S3ErrEnum.fileUploadDisabled);
  }

  const planStatus = await getTeamPlanStatus({ teamId });
  await assertUploadRateLimit({
    identity: uid,
    limit: planStatus.standard?.maxUploadFileCount || global.feConfigs.uploadFileMaxAmount
  });

  return getS3ChatSource().createUploadChatFileURL({
    sourceType,
    sourceId,
    chatId,
    filename,
    contentType,
    declaredExtension,
    declaredFilename,
    size,
    // 鲁港通 - 用户上传的文件与模型生成文件同一保留期，到期由每小时清理任务删除
    expiredTime: addDays(new Date(), getChatFileRetentionDays()),
    uId: uid,
    allowedExtensions,
    extensionRules,
    maxFileSize: planStatus.standard?.maxUploadFileSize ?? global.feConfigs.uploadFileMaxSize
  });
};
