import { createClient } from '@fastgpt/global/sdk/fastgpt-plugin';

export const PLUGIN_BASE_URL = process.env.PLUGIN_BASE_URL || '';
export const PLUGIN_TOKEN = process.env.PLUGIN_TOKEN || '';

// 条件创建pluginClient，避免空URL导致Invalid URL错误
export const pluginClient = PLUGIN_BASE_URL
  ? createClient({
      baseUrl: PLUGIN_BASE_URL,
      token: PLUGIN_TOKEN
    })
  : createClient({
      baseUrl: 'http://localhost:3000',  // 占位URL，实际不会被调用
      token: ''
    });
