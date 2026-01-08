import { loadModelProviders } from '../../../thirdProvider/fastgptPlugin/model';
import {
  type langType,
  defaultProvider,
  formatModelProviders
} from '@fastgpt/global/core/ai/provider';
import { PLUGIN_BASE_URL } from '../../../thirdProvider/fastgptPlugin';

// Preload model providers
export async function preloadModelProviders(): Promise<void> {
  // 如果 PLUGIN_BASE_URL 为空，跳过加载插件模型提供者
  if (!PLUGIN_BASE_URL) {
    console.log('[Info] PLUGIN_BASE_URL is not set, skipping plugin model providers loading');
    const { ModelProviderListCache, ModelProviderMapCache } = formatModelProviders([]);
    global.ModelProviderRawCache = [];
    global.ModelProviderListCache = ModelProviderListCache;
    global.ModelProviderMapCache = ModelProviderMapCache;
    global.aiproxyIdMapCache = {};
    return;
  }

  const { modelProviders, aiproxyIdMap } = await loadModelProviders();

  const { ModelProviderListCache, ModelProviderMapCache } = formatModelProviders(modelProviders);
  global.ModelProviderRawCache = modelProviders;
  global.ModelProviderListCache = ModelProviderListCache;
  global.ModelProviderMapCache = ModelProviderMapCache;

  global.aiproxyIdMapCache = aiproxyIdMap;
}

export const getModelProviders = (language = 'en') => {
  return global.ModelProviderListCache[language as langType] || [];
};
export const getModelProvider = (provider?: string, language = 'en') => {
  if (!provider) {
    return defaultProvider;
  }

  return global.ModelProviderMapCache[language as langType][provider] ?? defaultProvider;
};
