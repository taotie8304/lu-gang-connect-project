// 鲁港通 - 香港智能交通助手 index.ts (root)
// FastGPT 系统插件根入口
//
// 注意：当部署到 fastgpt-plugin 仓库时，需要使用官方的 exportTool：
//   import { exportTool } from '@tool/utils/tool';
//
// 当前在独立项目中开发，直接导出配置和回调。

import config from './config';
import { InputType, OutputType, tool as toolCb } from './src';

// Compatible export for standalone development
// In fastgpt-plugin repo, this would be:
//   export default exportTool({ toolCb, InputType, OutputType, config });
export default {
  config,
  InputType,
  OutputType,
  cb: toolCb
};

// Re-export for testing
export { InputType, OutputType, toolCb as tool };
