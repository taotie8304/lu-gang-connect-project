// 鲁港通 - 系统白名单（自动从环境变量提取）
const systemWhiteList = (() => {
  const list: string[] = [];
  if (process.env.S3_ENDPOINT) {
    list.push(process.env.S3_ENDPOINT);
  }
  if (process.env.S3_EXTERNAL_BASE_URL) {
    try {
      const urlData = new URL(process.env.S3_EXTERNAL_BASE_URL);
      list.push(urlData.hostname);
    } catch (error) {}
  }
  if (process.env.FE_DOMAIN) {
    try {
      const urlData = new URL(process.env.FE_DOMAIN);
      list.push(urlData.hostname);
    } catch (error) {}
  }
  // 鲁港通 - 添加商业版 URL 到白名单
  if (process.env.PRO_URL) {
    try {
      const urlData = new URL(process.env.PRO_URL);
      list.push(urlData.hostname);
    } catch (error) {
      // 鲁港通 - 静默处理无效 URL
    }
  }
  return list;
})();

// 鲁港通 - 验证文件 URL 域名是否在白名单中
export const validateFileUrlDomain = (url: string): boolean => {
  try {
    // 鲁港通 - 如果白名单为空，允许所有 URL
    if ((global.systemEnv?.fileUrlWhitelist || []).length === 0) {
      return true;
    }

    const whitelistArray = [...(global.systemEnv?.fileUrlWhitelist || []), ...systemWhiteList];

    const urlObj = new URL(url);

    const isAllowed = whitelistArray.some((domain) => {
      if (!domain || typeof domain !== 'string') return false;
      return urlObj.hostname === domain;
    });

    if (!isAllowed) {
      return false;
    }

    return true;
  } catch (error) {
    return true;
  }
};
