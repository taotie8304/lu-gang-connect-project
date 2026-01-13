import { pluginClient, PLUGIN_BASE_URL } from '.';

export const loadModelProviders = async () => {
  // 如果 PLUGIN_BASE_URL 为空，返回空数据
  if (!PLUGIN_BASE_URL) {
    return {
      modelProviders: [],
      aiproxyIdMap: {}
    };
  }

  const res = await pluginClient.model.getProviders();

  if (res.status === 200) {
    return res.body;
  }

  return Promise.reject(res.body);
};
