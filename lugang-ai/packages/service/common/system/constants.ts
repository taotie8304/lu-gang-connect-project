// 鲁港通 - 商业版 URL 配置
export const FastGPTProUrl = process.env.PRO_URL ? `${process.env.PRO_URL}/api` : '';
export const FastGPTPluginUrl = process.env.PLUGIN_BASE_URL ? `${process.env.PLUGIN_BASE_URL}` : '';
// @ts-ignore
export const isFastGPTProService = () => !!global.systemConfig;

// 鲁港通 - 判断是否为 Pro 版本
export const isProVersion = () => {
  return !!global.feConfigs?.isPlus;
};

export const serviceRequestMaxContentLength =
  Number(process.env.SERVICE_REQUEST_MAX_CONTENT_LENGTH || 10) * 1024 * 1024; // 10MB

// 鲁港通 - 初始化错误枚举
export const InitialErrorEnum = {
  S3_ERROR: 's3_error',
  MONGO_ERROR: 'mongo_error',
  REDIS_ERROR: 'redis_error',
  VECTORDB_ERROR: 'vectordb_error',
  PLUGIN_ERROR: 'plugin_error',
  PRO_ERROR: 'pro_error',
  SANDBOX_ERROR: 'code_sandbox_error',
  MCP_SERVER_ERROR: 'mcp_server_error'
};
