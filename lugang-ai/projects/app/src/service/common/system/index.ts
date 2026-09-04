import fs from 'fs';
import type { FastGPTFeConfigsType } from '@fastgpt/global/common/system/types/index';
import type { FastGPTConfigFileType } from '@fastgpt/global/common/system/types/index';
import { getFastGPTConfigFromDB } from '@fastgpt/service/common/system/config/controller';
import { initFastGPTConfig } from '@fastgpt/service/common/system/tools';
import json5 from 'json5';
import { defaultTemplateTypes } from '@fastgpt/web/core/workflow/constants';
import { MongoPluginToolTag } from '@fastgpt/service/core/plugin/tool/tagSchema';
import { MongoTemplateTypes } from '@fastgpt/service/core/app/templates/templateTypeSchema';
import { POST } from '@fastgpt/service/common/api/plusRequest';
import {
  type DeepRagSearchProps,
  type SearchDatasetDataResponse
} from '@fastgpt/service/core/dataset/search';
import type {
  PushUsageItemsProps,
  ConcatUsageProps,
  CreateUsageProps
} from '@fastgpt/global/support/wallet/usage/api';
import { isProVersion } from '@fastgpt/service/common/system/constants';
import { getLogger, LogCategories } from '@fastgpt/service/common/logger';
import {
  getAgentSandboxArchiveMaxBytes,
  getAgentSandboxMaxFileBytes,
  getAgentSandboxSkillMaxBytes
} from '@fastgpt/service/core/ai/sandbox/interface/config';
import { serviceEnv } from '@fastgpt/service/env';
import { hasAIProxyApiEndpoint } from '@fastgpt/service/thirdProvider/aiproxy/config';
import { appEnv } from '@/env';
import { pluginTagList } from '@fastgpt/global/sdk/fastgpt-plugin';
import { pluginClient } from '@fastgpt/service/thirdProvider/fastgptPlugin';

const logger = getLogger(LogCategories.SYSTEM);
const pluginFeaturesProbeTimeoutMs = 3000;
// 鲁港通 - 品牌化：移除官方开源版登录引导文档常量（原指 doc.fastgpt.io 账号登录 FAQ），
// 该链接会渲染在登录页并可点击跳转，使普通用户看到 FastGPT 品牌与外链。

/* Init global variables */
export function initGlobalVariables() {
  function initPlusRequest() {
    global.textCensorHandler = function textCensorHandler({ text }: { text: string }) {
      if (!isProVersion()) return Promise.resolve({ code: 200 });
      return POST<{ code: number; message?: string }>('/common/censor/check', { text });
    };

    global.deepRagHandler = function deepRagHandler(data: DeepRagSearchProps) {
      return POST<SearchDatasetDataResponse>('/core/dataset/deepRag', data);
    };

    global.createUsageHandler = function createUsageHandler(data: CreateUsageProps) {
      if (!isProVersion()) return;
      return POST<string>('/support/wallet/usage/createUsage', data);
    };
    global.concatUsageHandler = function concatUsageHandler(data: ConcatUsageProps) {
      if (!isProVersion()) return;
      return POST('/support/wallet/usage/concatUsage', data);
    };
    global.pushUsageItemsHandler = function pushUsageItemsHandler(data: PushUsageItemsProps) {
      if (!isProVersion()) return;
      return POST('/support/wallet/usage/pushUsageItems', data);
    };
  }

  global.datasetParseQueueLen = global.datasetParseQueueLen ?? 0;
  global.qaQueueLen = global.qaQueueLen ?? 0;
  global.vectorQueueLen = global.vectorQueueLen ?? 0;
  initPlusRequest();
}

/* Init system data(Need to connected db). It only needs to run once */
export async function getInitConfig() {
  const getSystemVersion = async () => {
    if (global.systemVersion) return;
    try {
      if (process.env.NODE_ENV === 'development') {
        global.systemVersion = process.env.npm_package_version || '0.0.0';
      } else {
        const packageJson = json5.parse(await fs.promises.readFile('/app/package.json', 'utf-8'));

        global.systemVersion = packageJson?.version;
      }
      logger.info('System version resolved', { systemVersion: global.systemVersion });
    } catch (error) {
      logger.error('System version resolve failed', { error });

      global.systemVersion = '0.0.0';
    }
  };

  await Promise.all([initSystemConfig(), getSystemVersion()]);
}

const defaultFeConfigs: FastGPTFeConfigsType = {
  show_emptyChat: true,
  // 鲁港通 - 品牌化：隐藏导航栏 FastGPT GitHub 图标，并清空官方文档/模板教程外链，
  // 避免普通用户在前台看到 FastGPT 品牌标识与开源地址。
  show_git: false,
  docUrl: '',
  openAPIDocUrl: '',
  enable_team_plugin_upload: false,
  appTemplateCourse: '',
  // 鲁港通 - 全站文字品牌：该值被浏览器标签标题（NextHead）、登录页系统名、
  // 注册页「注册 {{account}} 账号」、找回密码页「找回 {{account}} 账号」、团队邀请文案、MCP 配置名等 15+ 处引用。
  systemTitle: '鲁港通',
  concatMd: '技术支持：鲁港通科技',
  // 鲁港通 - 纯聊天模式：普通用户（非团队所有者）隐藏工作室/知识库/应用市场等后台导航，仅保留聊天与账号。
  // navbar.tsx 门控为 showAdminFeatures = isOwner || !enableUserChatOnly；不显式赋值时默认 undefined
  // 会使 !undefined === true，导致普通用户仍能看到后台入口。
  enableUserChatOnly: true,
  limit: {
    exportDatasetLimitMinutes: 0,
    websiteSyncLimitMinuted: 0,
    agentSandboxMaxEditDebug: serviceEnv.AGENT_SANDBOX_MAX_EDIT_DEBUG,
    agentSandboxArchiveMaxBytes: getAgentSandboxArchiveMaxBytes(),
    skillSandboxMaxBytes: getAgentSandboxSkillMaxBytes(),
    agentSandboxMaxFileBytes: getAgentSandboxMaxFileBytes(),
    workflowParallelRunMaxConcurrency: serviceEnv.WORKFLOW_PARALLEL_MAX_CONCURRENCY,
    maxFolderDepth: serviceEnv.MAX_FOLDER_DEPTH
  },
  scripts: [],
  favicon: '/favicon.ico',
  chineseRedirectUrl: appEnv.CHINESE_IP_REDIRECT_URL,
  uploadFileMaxSize: serviceEnv.UPLOAD_FILE_MAX_SIZE,
  uploadFileMaxAmount: serviceEnv.UPLOAD_FILE_MAX_AMOUNT
};

async function getPluginRemoteDebugEnabled() {
  try {
    const features = await pluginClient.getPluginServiceFeatures({
      signal: AbortSignal.timeout(pluginFeaturesProbeTimeoutMs)
    });
    return features.remoteDebug === true;
  } catch (error) {
    logger.warn('Plugin service features resolve failed', { error });
    return false;
  }
}

export async function initSystemConfig() {
  const [{ fastgptConfig, licenseData }, pluginRemoteDebug] = await Promise.all([
    getFastGPTConfigFromDB(),
    getPluginRemoteDebugEnabled()
  ]);
  global.licenseData = licenseData;

  const config: FastGPTConfigFileType = {
    feConfigs: {
      ...defaultFeConfigs,
      ...(fastgptConfig.feConfigs || {}),
      mcpServerProxyEndpoint: appEnv.SSE_MCP_SERVER_PROXY_ENDPOINT,
      limit: {
        ...defaultFeConfigs.limit,
        ...(fastgptConfig.feConfigs?.limit || {})
      },
      isPlus: !!licenseData,
      hideChatCopyrightSetting: appEnv.HIDE_CHAT_COPYRIGHT_SETTING,
      wecomLoginAutoRedirect: appEnv.WECOM_LOGIN_AUTO_REDIRECT,
      show_aiproxy: hasAIProxyApiEndpoint(),
      show_coupon: appEnv.SHOW_COUPON,
      show_discount_coupon: appEnv.SHOW_DISCOUNT_COUPON,
      show_dataset_enhance: licenseData?.functions?.datasetEnhance,
      show_batch_eval: licenseData?.functions?.batchEval,
      pluginRemoteDebug,
      payFormUrl: appEnv.PAY_FORM_URL || '',
      marketplaceUrl: appEnv.MARKETPLACE_URL,

      agentSandboxFree: appEnv.AGENT_SANDBOX_FREE_TIP,
      agentSandboxProxyUrl: serviceEnv.AGENT_SANDBOX_PROXY_URL || ''
    },
    systemEnv: Object.assign(
      {
        datasetParseMaxProcess: serviceEnv.DATASET_PARSE_MAX_PROCESS,
        vectorMaxProcess: serviceEnv.VECTOR_MAX_PROCESS,
        qaMaxProcess: serviceEnv.QA_MAX_PROCESS,
        vlmMaxProcess: serviceEnv.VLM_MAX_PROCESS,
        hnswEfSearch: serviceEnv.HNSW_EF_SEARCH,
        hnswMaxScanTuples: serviceEnv.HNSW_MAX_SCAN_TUPLES,
        customPdfParse: {
          url: serviceEnv.CUSTOM_PDF_PARSE_URL,
          key: serviceEnv.CUSTOM_PDF_PARSE_KEY,
          somarkApiKey: serviceEnv.SOMARK_API_KEY,
          doc2xKey: serviceEnv.DOC2X_KEY,
          textinAppId: serviceEnv.TEXTIN_APP_ID,
          textinSecretCode: serviceEnv.TEXTIN_SECRET_CODE
        }
      },
      fastgptConfig.systemEnv || {} // 商业版数据存在数据库里
    ),
    subPlans: fastgptConfig.subPlans
  };

  // 鲁港通 - 品牌化：不再为开源版强制注入 loginGuideDocUrl（原指向 doc.fastgpt.io 登录 FAQ），
  // 留空后 login/index.tsx 的条件渲染不会输出该引导链接；如需仍可通过数据库 feConfigs 配置。

  // set config
  initFastGPTConfig(config);

  logger.info('System config loaded', {
    fastgpt: {
      feConfigs: global.feConfigs,
      systemEnv: global.systemEnv,
      subPlans: global.subPlans,
      licenseData: global.licenseData
    }
  });
}

export async function initSystemPluginTags() {
  try {
    const tags = pluginTagList;

    if (tags.length > 0) {
      const bulkOps = tags.map((tag, index) => ({
        updateOne: {
          filter: { tagId: tag.id },
          update: {
            $set: {
              tagId: tag.id,
              tagName: tag.name,
              tagOrder: index,
              isSystem: true
            }
          },
          upsert: true
        }
      }));

      await MongoPluginToolTag.bulkWrite(bulkOps);
    }
  } catch (error) {
    logger.error('Error initializing system plugin tags:', { error });
  }
}

export async function initAppTemplateTypes() {
  try {
    await Promise.all(
      defaultTemplateTypes.map((templateType) => {
        return MongoTemplateTypes.updateOne(
          {
            typeId: templateType.typeId
          },
          {
            $set: {
              typeId: templateType.typeId,
              typeName: templateType.typeName
            }
          },
          {
            upsert: true
          }
        );
      })
    );
  } catch (error) {
    logger.error('Error initializing system templates:', { error });
  }
}
