import { RunToolWithStream } from '@fastgpt/global/sdk/fastgpt-plugin';
import { AppToolSourceEnum } from '@fastgpt/global/core/app/tool/constants';
import { pluginClient, PLUGIN_BASE_URL, PLUGIN_TOKEN } from '../../../thirdProvider/fastgptPlugin';
import { addLog } from '../../../common/system/log';
import { retryFn } from '@fastgpt/global/common/system/utils';

export async function APIGetSystemToolList() {
  // 如果 PLUGIN_BASE_URL 为空，返回空列表
  if (!PLUGIN_BASE_URL) {
    return [];
  }

  const res = await pluginClient.tool.list();

  if (res.status === 200) {
    return res.body.map((item) => {
      return {
        ...item,
        id: `${AppToolSourceEnum.systemTool}-${item.toolId}`,
        parentId: item.parentId ? `${AppToolSourceEnum.systemTool}-${item.parentId}` : undefined,
        avatar: item.icon
      };
    });
  }

  return Promise.reject(res.body);
}

// 条件创建 RunToolWithStream 实例，避免空URL错误
const runToolInstance = PLUGIN_BASE_URL
  ? new RunToolWithStream({
      baseUrl: PLUGIN_BASE_URL,
      token: PLUGIN_TOKEN
    })
  : null;

export const APIRunSystemTool = runToolInstance
  ? runToolInstance.run.bind(runToolInstance)
  : async () => {
      throw new Error('Plugin service is not configured');
    };

export const getSystemToolTags = () => {
  return retryFn(async () => {
    // 如果 PLUGIN_BASE_URL 为空，返回空列表
    if (!PLUGIN_BASE_URL) {
      return [];
    }

    const res = await pluginClient.tool.getTags();

    if (res.status === 200) {
      const toolTypes = res.body || [];

      return toolTypes;
    }

    addLog.error('Get system tool type error', res.body);
    return [];
  });
};
