export const FastGPTProUrl = process.env.PRO_URL ? `${process.env.PRO_URL}/api` : '';
export const FastGPTPluginUrl = process.env.PLUGIN_BASE_URL ? `${process.env.PLUGIN_BASE_URL}` : '';
// @ts-ignore
export const isFastGPTProService = () => !!global.systemConfig;

// 鲁港通 - 启用完整功能
export const isProVersion = () => {
  return true;
};

export const serviceRequestMaxContentLength =
  Number(process.env.SERVICE_REQUEST_MAX_CONTENT_LENGTH || 10) * 1024 * 1024; // 10MB
