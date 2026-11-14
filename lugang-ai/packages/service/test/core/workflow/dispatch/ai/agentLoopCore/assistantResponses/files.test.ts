import { describe, expect, it, vi } from 'vitest';
import { createAgentLoopCoreAssistantEventCollector } from '@fastgpt/service/core/workflow/dispatch/ai/agentLoopCore/adapter/assistantResponses/eventCollector';
import {
  createAgentLoopCoreEventDispatcher,
  createAgentLoopCoreEventStream
} from '@fastgpt/service/core/workflow/dispatch/ai/agentLoopCore/adapter/eventStream';
import { SseResponseEventEnum } from '@fastgpt/global/core/workflow/runtime/constants';
import type { ChatFileCardType } from '@fastgpt/global/core/chat/type';

const createCall = (id = 'call_doc') =>
  ({
    id,
    type: 'function',
    function: {
      name: 'document_operation',
      arguments: '{"action":"generate","format":"docx","fileName":"报告","content":"正文"}'
    }
  }) as const;

const file = (key: string): ChatFileCardType => ({
  key,
  name: `${key}.docx`,
  format: 'docx',
  size: 2048
});

describe('agent loop 文件卡片', () => {
  it('将 tool_run_end 的 metadata.files 持久化为独立文件 value，并按 key 去重', () => {
    const collector = createAgentLoopCoreAssistantEventCollector({
      getToolInfo: () => ({
        name: '文档处理',
        avatar: 'document'
      })
    });
    const call = createCall();

    collector.emitEvent({ type: 'tool_call', call });
    collector.emitEvent({
      type: 'tool_run_end',
      call,
      rawResponse: 'ok',
      response: '已生成',
      seconds: 0.1,
      metadata: { files: [file('a'), file('b'), file('a')] }
    });

    const filesValue = collector.assistantResponses.find((value) => value.files?.length);
    expect(filesValue?.files).toEqual([file('a'), file('b')]);

    // 文件卡片必须独立成块，否则会被「处理过程」折叠隐藏
    const toolValue = collector.assistantResponses.find((value) => value.tools?.length);
    expect(toolValue?.files).toBeUndefined();
  });

  it('多次工具调用产生的文件累加后最多保留 3 个', () => {
    const collector = createAgentLoopCoreAssistantEventCollector();

    for (const [index, key] of ['a', 'b', 'c', 'd'].entries()) {
      const call = createCall(`call_${index}`);
      collector.emitEvent({ type: 'tool_call', call });
      collector.emitEvent({
        type: 'tool_run_end',
        call,
        rawResponse: 'ok',
        response: '已生成',
        seconds: 0.1,
        metadata: { files: [file(key)] }
      });
    }

    const filesValue = collector.assistantResponses.find((value) => value.files?.length);
    expect(filesValue?.files?.map((item) => item.key)).toEqual(['a', 'b', 'c']);
  });

  it('toolResponse SSE 事件携带 metadata.files', () => {
    const workflowStreamResponse = vi.fn();
    const eventStream = createAgentLoopCoreEventStream({
      workflowStreamResponse,
      getToolInfo: () => undefined
    });
    const dispatcher = createAgentLoopCoreEventDispatcher({ eventStream });
    const call = createCall();

    dispatcher.emitEvent({
      type: 'tool_run_end',
      call,
      rawResponse: 'ok',
      response: '已生成',
      seconds: 0.1,
      metadata: { files: [file('a')] }
    });

    expect(workflowStreamResponse).toHaveBeenCalledWith({
      id: 'call_doc',
      event: SseResponseEventEnum.toolResponse,
      data: {
        tool: expect.objectContaining({
          id: 'call_doc',
          files: [file('a')]
        })
      }
    });
  });
});
