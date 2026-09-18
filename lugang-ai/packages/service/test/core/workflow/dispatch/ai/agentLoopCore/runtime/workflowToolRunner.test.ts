import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgentLoopCoreWorkflowToolRunner } from '@fastgpt/service/core/workflow/dispatch/ai/agentLoopCore/application/runtime/workflowToolRunner';

const createCall = ({
  id = 'call_1',
  name = 'search',
  args = '{}'
}: {
  id?: string;
  name?: string;
  args?: string;
} = {}) =>
  ({
    id,
    type: 'function',
    function: {
      name,
      arguments: args
    }
  }) as any;

const createRunner = ({
  getToolInfo,
  runtimeNodes = [],
  runtimeEdges = [],
  runWorkflowTool = vi.fn()
}: {
  getToolInfo: (name: string) => any;
  runtimeNodes?: any[];
  runtimeEdges?: any[];
  runWorkflowTool?: ReturnType<typeof vi.fn>;
}) => {
  const cacheToolFlowResponse = vi.fn();
  const runner = createAgentLoopCoreWorkflowToolRunner({
    runtimeNodes,
    runtimeEdges,
    getToolInfo,
    runWorkflowTool,
    cacheToolFlowResponse
  });

  return {
    ...runner,
    cacheToolFlowResponse,
    runWorkflowTool
  };
};

describe('createAgentLoopCoreWorkflowToolRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a stable not-found result without caching flow response', async () => {
    const { runTool, cacheToolFlowResponse } = createRunner({
      getToolInfo: () => undefined
    });

    await expect(
      runTool({
        call: createCall()
      })
    ).resolves.toEqual({
      response: 'Call tool not found',
      assistantMessages: [],
      usages: [],
      interactive: undefined,
      stop: false
    });
    expect(cacheToolFlowResponse).not.toHaveBeenCalled();
  });

  it('does not execute sandbox system tools through the runtime tool runner', async () => {
    const { runTool, cacheToolFlowResponse } = createRunner({
      getToolInfo: () => ({
        type: 'sandbox',
        name: 'Run shell',
        avatar: 'sandbox-avatar'
      })
    });
    const call = createCall({
      id: 'call_shell',
      name: 'sandbox_shell',
      args: '{"cmd":"ls"}'
    });

    const result = await runTool({ call });

    expect(result).toEqual({
      response:
        'sandbox_shell is an agent-loop system tool and cannot be executed as a runtime tool.',
      assistantMessages: [],
      usages: [],
      interactive: undefined,
      stop: false
    });
    expect(cacheToolFlowResponse).not.toHaveBeenCalled();
  });

  it('does not execute read-file system tools through the runtime tool runner', async () => {
    const { runTool, cacheToolFlowResponse } = createRunner({
      getToolInfo: () => ({
        type: 'file',
        name: 'File parse',
        avatar: 'file-avatar'
      })
    });
    const call = createCall({
      id: 'call_read',
      name: 'read_files',
      args: '{"urls":["https://files.example.com/file_1","https://files.example.com/missing"]}'
    });

    const result = await runTool({ call });

    expect(result).toEqual({
      response: 'read_files is an agent-loop system tool and cannot be executed as a runtime tool.',
      assistantMessages: [],
      usages: [],
      interactive: undefined,
      stop: false
    });
    expect(cacheToolFlowResponse).not.toHaveBeenCalled();
  });

  it('does not execute dataset search system tools through the runtime tool runner', async () => {
    const { runTool, cacheToolFlowResponse } = createRunner({
      getToolInfo: () => ({
        type: 'datasetSearch',
        name: 'Dataset search',
        avatar: 'dataset-avatar'
      })
    });
    const call = createCall({
      id: 'call_dataset_search',
      name: 'dataset_search',
      args: '{"datasetSearchInput":"red shoes","limit":3}'
    });

    const result = await runTool({ call });

    expect(result).toEqual({
      response:
        'dataset_search is an agent-loop system tool and cannot be executed as a runtime tool.',
      assistantMessages: [],
      usages: [],
      interactive: undefined,
      stop: false
    });
    expect(cacheToolFlowResponse).not.toHaveBeenCalled();
  });

  it('runs user workflow tools and interactive resume paths', async () => {
    const usage = {
      moduleName: 'tool',
      totalPoints: 1
    };
    const runtimeNodes = [
      {
        nodeId: 'search',
        inputs: [
          {
            key: 'q',
            value: 'old',
            renderTypeList: ['input', 'agentGenerated'],
            selectedType: 'agentGenerated'
          }
        ]
      }
    ];
    const runtimeEdges = [
      {
        target: 'search'
      }
    ];
    const runWorkflowTool = vi
      .fn()
      .mockResolvedValueOnce({
        toolResponses: {
          answer: 'workflow ok'
        },
        assistantResponses: [
          { text: { content: 'assistant text' } },
          {
            tools: [
              {
                id: 'call_nested',
                toolName: 'Nested search',
                toolAvatar: 'nested-avatar',
                functionName: 'nested_search',
                params: '{"q":"nested"}',
                response: 'nested result'
              }
            ]
          }
        ],
        flowUsages: [usage],
        workflowInteractiveResponse: {
          type: 'userSelect'
        },
        flowResponses: [
          {
            toolStop: true
          }
        ]
      })
      .mockResolvedValueOnce({
        toolResponses: 'interactive ok',
        assistantResponses: [],
        flowUsages: [],
        workflowInteractiveResponse: undefined,
        flowResponses: [
          {
            toolStop: false
          }
        ]
      });
    const { runTool, runInteractiveTool, cacheToolFlowResponse } = createRunner({
      runtimeNodes,
      runtimeEdges,
      runWorkflowTool,
      getToolInfo: () => ({
        type: 'user',
        name: 'Search',
        avatar: 'tool-avatar',
        rawData: {
          nodeId: 'search'
        }
      })
    });
    const call = createCall({
      id: 'call_search',
      name: 'search',
      args: '{"q":"FastGPT"}'
    });

    const result = await runTool({ call });

    // 鲁港通 - 父流程 runtime 保持基线，不再被就地修改
    expect(runtimeNodes[0]).toEqual({
      nodeId: 'search',
      inputs: [
        {
          key: 'q',
          value: 'old',
          renderTypeList: ['input', 'agentGenerated'],
          selectedType: 'agentGenerated'
        }
      ]
    });
    expect(runtimeEdges[0]).toEqual({
      target: 'search'
    });
    // 鲁港通 - 参数与入口标记只写入隔离副本
    const [firstRunArgs] = runWorkflowTool.mock.calls[0];
    expect(firstRunArgs.runtimeNodes).toEqual([
      {
        nodeId: 'search',
        isEntry: true,
        inputs: [
          {
            key: 'q',
            renderTypeList: ['input', 'agentGenerated'],
            selectedType: 'agentGenerated',
            value: 'FastGPT'
          }
        ]
      }
    ]);
    expect(firstRunArgs.runtimeEdges).toEqual([
      {
        target: 'search',
        status: 'active'
      }
    ]);
    expect(firstRunArgs.runtimeNodes).not.toBe(runtimeNodes);
    expect(firstRunArgs.runtimeEdges).not.toBe(runtimeEdges);
    expect(result.response).toBe(JSON.stringify({ answer: 'workflow ok' }, null, 2));
    expect(result.usages).toEqual([usage]);
    expect(result.interactive).toEqual({
      type: 'userSelect'
    });
    expect(result.stop).toBe(true);
    expect(result.assistantMessages).toEqual([
      expect.objectContaining({
        role: 'assistant',
        content: 'assistant text',
        tool_calls: [
          expect.objectContaining({
            id: 'call_nested',
            function: {
              name: 'nested_search',
              arguments: '{"q":"nested"}'
            }
          })
        ]
      }),
      {
        role: 'tool',
        tool_call_id: 'call_nested',
        content: 'nested result'
      }
    ]);
    expect(cacheToolFlowResponse).toHaveBeenCalledWith({
      callId: call.id,
      flowResponse: expect.objectContaining({
        flowUsages: [usage],
        flowResponses: [
          {
            toolStop: true
          }
        ]
      })
    });

    const interactiveResult = await runInteractiveTool({
      childrenResponse: {
        entryNodeIds: ['search']
      },
      toolParams: {
        toolCallId: 'call_interactive'
      }
    } as any);

    expect(cacheToolFlowResponse).toHaveBeenLastCalledWith({
      callId: 'call_interactive',
      flowResponse: expect.objectContaining({
        flowResponses: [
          {
            toolStop: false
          }
        ]
      })
    });
    expect(interactiveResult).toEqual({
      response: 'interactive ok',
      assistantMessages: [],
      usages: [],
      interactive: undefined,
      stop: false
    });
  });

  it('does not leak agent params between consecutive tool calls', async () => {
    // 鲁港通 - 回归：同一消息内连续调用工具时，上一次的参数不得残留到下一次
    const runtimeNodes = [
      {
        nodeId: 'search',
        inputs: [
          {
            key: 'query',
            value: '',
            renderTypeList: ['input', 'agentGenerated'],
            selectedType: 'agentGenerated'
          },
          {
            key: 'district',
            value: '',
            renderTypeList: ['input', 'agentGenerated'],
            selectedType: 'agentGenerated'
          }
        ]
      }
    ];
    const runtimeEdges = [{ target: 'search' }];
    const runWorkflowTool = vi.fn().mockResolvedValue({
      toolResponses: 'ok',
      assistantResponses: [],
      flowUsages: [],
      flowResponses: []
    });
    const { runTool } = createRunner({
      runtimeNodes,
      runtimeEdges,
      runWorkflowTool,
      getToolInfo: () => ({
        type: 'user',
        name: 'Search',
        avatar: 'tool-avatar',
        rawData: {
          nodeId: 'search'
        }
      })
    });

    await runTool({
      call: createCall({ id: 'call_1', args: '{"query":"沙田区小学","district":"沙田区"}' })
    });
    await runTool({
      call: createCall({ id: 'call_2', args: '{"query":"全港国际学校数量统计"}' })
    });

    const secondCallNodes = runWorkflowTool.mock.calls[1][0].runtimeNodes;
    expect(secondCallNodes[0].inputs).toEqual([
      expect.objectContaining({ key: 'query', value: '全港国际学校数量统计' }),
      expect.objectContaining({ key: 'district', value: '' })
    ]);
    // 父流程基线保持干净
    expect(runtimeNodes[0].inputs[1].value).toBe('');
  });

  it('rebuilds isolated runtime state from the interactive snapshot on resume', async () => {
    // 鲁港通 - 回归：交互恢复必须用中断快照重建（节点输出 + 边状态），不依赖父流程残留
    const runtimeNodes = [
      {
        nodeId: 'search',
        inputs: [
          {
            key: 'query',
            value: '',
            renderTypeList: ['input', 'agentGenerated'],
            selectedType: 'agentGenerated'
          }
        ],
        outputs: [
          {
            id: 'out1',
            key: 'nodeOutput',
            type: 'static',
            value: 'initial'
          }
        ]
      }
    ];
    const runtimeEdges = [{ source: 'start', target: 'search', status: 'waiting' }];
    const runWorkflowTool = vi.fn().mockResolvedValue({
      toolResponses: 'ok',
      assistantResponses: [],
      flowUsages: [],
      flowResponses: []
    });
    const { runInteractiveTool } = createRunner({
      runtimeNodes,
      runtimeEdges,
      runWorkflowTool,
      getToolInfo: () => undefined
    });

    const childrenResponse = {
      entryNodeIds: ['search'],
      nodeOutputs: [{ nodeId: 'search', key: 'nodeOutput', value: 'snapshot value' }],
      memoryEdges: [{ source: 'start', target: 'search', status: 'active' }]
    };

    await runInteractiveTool({
      childrenResponse,
      toolParams: {
        toolCallId: 'call_resume'
      }
    } as any);

    const [resumeArgs] = runWorkflowTool.mock.calls[0];
    // 快照回填节点输出
    expect(resumeArgs.runtimeNodes[0].outputs[0].value).toBe('snapshot value');
    // 快照重建边状态
    expect(resumeArgs.runtimeEdges[0].status).toBe('active');
    // lastInteractive 继续传递
    expect(resumeArgs.lastInteractive).toBe(childrenResponse);
    // 父流程 runtime 保持基线
    expect(runtimeNodes[0].outputs[0].value).toBe('initial');
    expect(runtimeEdges[0].status).toBe('waiting');
  });
});
