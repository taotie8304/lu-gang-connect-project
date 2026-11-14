import { type FastGPTConfigFileType } from '@fastgpt/global/common/system/types';
import { isIPv6 } from 'net';
import { getLogger, LogCategories } from '../logger';
import {
  getAgentSandboxArchiveMaxBytes,
  getAgentSandboxMaxFileBytes,
  getAgentSandboxSkillMaxBytes
} from '../../core/ai/sandbox/interface/config';
import { hasAgentSandboxConfig, serviceEnv } from '../../env';
import { getChatFileRetentionDays } from '../../common/s3/sources/chat/retention';

const logger = getLogger(LogCategories.ERROR);

export const SERVICE_LOCAL_PORT = `${process.env.PORT || 3000}`;
export const SERVICE_LOCAL_HOST =
  process.env.HOSTNAME && isIPv6(process.env.HOSTNAME)
    ? `[${process.env.HOSTNAME}]:${SERVICE_LOCAL_PORT}`
    : `${process.env.HOSTNAME || 'localhost'}:${SERVICE_LOCAL_PORT}`;

export const initFastGPTConfig = (config?: FastGPTConfigFileType) => {
  if (!config) return;

  // Special config computed
  config.feConfigs.showCustomPdfParse =
    !!config.systemEnv.customPdfParse?.url ||
    !!config.systemEnv.customPdfParse?.somarkApiKey ||
    !!config.systemEnv.customPdfParse?.textinAppId ||
    !!config.systemEnv.customPdfParse?.doc2xKey;
  config.feConfigs.customPdfParsePrice = config.systemEnv.customPdfParse?.price || 0;
  config.feConfigs.show_agent_sandbox = hasAgentSandboxConfig();
  // 鲁港通 - 聊天文件保留天数公开给前端，供文件卡片展示与实际清理口径一致
  config.feConfigs.lugangChatFileRetentionDays = getChatFileRetentionDays();
  config.feConfigs.uploadFileMaxSize = serviceEnv.UPLOAD_FILE_MAX_SIZE;
  config.feConfigs.uploadFileMaxAmount = serviceEnv.UPLOAD_FILE_MAX_AMOUNT;
  config.feConfigs.limit = {
    ...config.feConfigs.limit,
    agentSandboxMaxEditDebug: serviceEnv.AGENT_SANDBOX_MAX_EDIT_DEBUG,
    agentSandboxArchiveMaxBytes: getAgentSandboxArchiveMaxBytes(),
    skillSandboxMaxBytes: getAgentSandboxSkillMaxBytes(),
    agentSandboxMaxFileBytes: getAgentSandboxMaxFileBytes(),
    maxFolderDepth: serviceEnv.MAX_FOLDER_DEPTH
  };

  global.feConfigs = config.feConfigs;
  global.systemEnv = config.systemEnv;
  global.subPlans = config.subPlans;
};

export const systemStartCb = () => {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err });
    // process.exit(1); // 退出进程
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', { reason, promise });
    // process.exit(1); // 退出进程
  });
};

export const surrenderProcess = () => new Promise((resolve) => setImmediate(resolve));
