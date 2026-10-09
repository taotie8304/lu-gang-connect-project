import type {
  ChatCompletionCreateParams,
  ChatCompletionMessageToolCall,
  StreamResponseType
} from '@fastgpt/global/core/ai/llm/type';
import { getNanoid } from '@fastgpt/global/common/string/tools';
import { parseLLMStreamResponse } from '../../../utils';
import { parsePromptToolCall } from '../../promptCall';
import { getLLMModel } from '../../../model';
import type { CompleteParams, CompleteResponse, CreateLLMResponseProps } from '../types';

/**
 * 解析 stream completion 响应。
 *
 * 三种分支分别处理：
 * - toolChoice：供应商原生返回 tool_calls delta。
 * - prompt tool：模型把工具协议输出在文本里，需要先控制可见流式输出，再在结束后解析 tool_calls。
 * - 普通文本：只转发 reasoning 与正文 delta。
 */
export const createStreamResponse = async ({
  body,
  response,
  isAborted,
  onStreaming,
  onReasoning,
  onToolCall,
  onToolParam
}: CompleteParams & {
  response: StreamResponseType;
  isAborted?: CreateLLMResponseProps<ChatCompletionCreateParams>['isAborted'];
}): Promise<CompleteResponse> => {
  const { retainDatasetCite = true, tools, toolCallMode = 'toolChoice', model } = body;
  const modelData = getLLMModel(model);

  const { parsePart, getResponseData, updateFinishReason, updateError } = parseLLMStreamResponse();

  if (tools?.length) {
    if (toolCallMode === 'toolChoice') {
      // 鲁港通 - 未匹配本轮工具表的调用按 index 暂存、流末补发，避免静默丢弃导致空回复。
      const pendingToolCalls = new Map<
        number,
        { id?: string; function: ChatCompletionMessageToolCall['function'] }
      >();
      const toolCalls: ChatCompletionMessageToolCall[] = [];

      try {
        for await (const part of response) {
          if (isAborted?.()) {
            // 用户中断属于正常关闭，不作为 error 处理。
            response.controller?.abort();
            updateFinishReason('close');
            break;
          }

          const { reasoningContent, responseContent } = parsePart({
            part,
            parseThinkTag: modelData.reasoning,
            retainDatasetCite
          });

          if (reasoningContent) {
            onReasoning?.({ text: reasoningContent });
          }
          if (responseContent) {
            onStreaming?.({ text: responseContent });
          }

          const responseChoice = part.choices?.[0]?.delta;
          if (responseChoice?.tool_calls?.length) {
            responseChoice.tool_calls.forEach((toolCall, i) => {
              // 多 tool 并发时必须按模型返回的 index 聚合参数，避免参数串到其他工具上。
              const index = toolCall.index ?? i;
              const nameDelta = toolCall?.function?.name;
              const argsDelta = toolCall?.function?.arguments ?? '';

              if (nameDelta) {
                // 有些供应商会把 function.name 和 arguments 分片返回，先按 index 缓存。
                const existingPending = pendingToolCalls.get(index);
                pendingToolCalls.set(index, {
                  id: toolCall.id || existingPending?.id,
                  function: {
                    name: (existingPending?.function.name ?? '') + nameDelta,
                    arguments: (existingPending?.function.arguments ?? '') + argsDelta
                  }
                });

                const pending = pendingToolCalls.get(index)!;
                // 命中本轮工具表才立即建立调用；未命中的保留到流末补发，交给执行层兜底。
                if (tools.find((item) => item.function.name === pending.function.name)) {
                  const call: ChatCompletionMessageToolCall = {
                    id: pending.id || getNanoid(6),
                    type: 'function',
                    function: pending.function
                  };
                  toolCalls[index] = call;
                  pendingToolCalls.delete(index);
                  onToolCall?.({ call });
                }
              } else if (argsDelta) {
                const currentTool = toolCalls[index];
                if (currentTool) {
                  // 后续 arguments delta 直接追加到已创建的 tool call，并把增量同步给上层。
                  currentTool.function.arguments += argsDelta;

                  onToolParam?.({ call: currentTool, argsDelta });
                } else {
                  const pending = pendingToolCalls.get(index);
                  if (pending) {
                    pending.function.arguments += argsDelta;
                  }
                }
              }
            });
          }
        }
      } catch (error: any) {
        // stream 迭代异常不立即抛出，先写入 parser 状态，最终由 createLLMResponse 决定是否 throw。
        updateError(error?.error || error);
      }

      // 鲁港通 - 流末补发未匹配本轮工具表的调用（保留供应商 id），执行层会返回"工具不存在"让模型自愈。
      pendingToolCalls.forEach((pending, index) => {
        if (!pending.function.name) return;

        const call: ChatCompletionMessageToolCall = {
          id: pending.id || getNanoid(6),
          type: 'function',
          function: pending.function
        };
        toolCalls[index] = call;
        onToolCall?.({ call });
      });

      const { reasoningContent, content, finish_reason, usage, error } = getResponseData();

      return {
        error,
        answerText: content,
        reasoningText: reasoningContent,
        finish_reason,
        usage,
        toolCalls: toolCalls.filter((call) => !!call)
      };
    } else {
      let startResponseWrite = false;
      let answer = '';

      try {
        for await (const part of response) {
          if (isAborted?.()) {
            // 与 toolChoice 分支一致：中断记录 close，保留已经收到的内容。
            response.controller?.abort();
            updateFinishReason('close');
            break;
          }

          const { reasoningContent, content, responseContent } = parsePart({
            part,
            parseThinkTag: modelData.reasoning,
            retainDatasetCite
          });
          answer += content;

          if (reasoningContent) {
            onReasoning?.({ text: reasoningContent });
          }

          if (content) {
            if (startResponseWrite) {
              if (responseContent) {
                onStreaming?.({ text: responseContent });
              }
            } else if (answer.length >= 3) {
              answer = answer.trimStart();

              if (/0(:|：)/.test(answer)) {
                // prompt tool 协议中 0 表示普通回答，可以开始把内容流式展示给用户。
                startResponseWrite = true;

                const firstIndex =
                  answer.indexOf('0:') !== -1 ? answer.indexOf('0:') : answer.indexOf('0：');
                answer = answer.substring(firstIndex + 2).trim();

                onStreaming?.({ text: answer });
              } else if (/1(:|：)/.test(answer)) {
                // 1 表示工具调用，工具协议内容不应作为可见回答提前输出。
              } else {
                // 兼容模型未按 0/1 前缀输出时，当作普通文本直接展示。
                startResponseWrite = true;
                onStreaming?.({ text: answer });
              }
            }
          }
        }
      } catch (error: any) {
        // prompt tool 的解析依赖完整 content，stream 异常先挂到 response parser 上。
        updateError(error?.error || error);
      }

      const { reasoningContent, content, finish_reason, usage, error } = getResponseData();
      // prompt tool 模式结束后用完整文本解析最终回答和工具调用。
      const { answer: llmAnswer, streamAnswer, toolCalls } = parsePromptToolCall(content);

      if (streamAnswer) {
        onStreaming?.({ text: streamAnswer });
      }

      toolCalls?.forEach((call) => {
        onToolCall?.({ call });
      });

      return {
        error,
        answerText: llmAnswer,
        reasoningText: reasoningContent,
        finish_reason,
        usage,
        toolCalls
      };
    }
  } else {
    try {
      for await (const part of response) {
        if (isAborted?.()) {
          // 普通文本流也保留已收到内容，中断状态由 finish_reason=close 表达。
          response.controller?.abort();
          updateFinishReason('close');
          break;
        }

        const { reasoningContent, responseContent } = parsePart({
          part,
          parseThinkTag: modelData.reasoning,
          retainDatasetCite
        });

        if (reasoningContent) {
          onReasoning?.({ text: reasoningContent });
        }
        if (responseContent) {
          onStreaming?.({ text: responseContent });
        }
      }
    } catch (error: any) {
      // 捕获底层流关闭/网络异常，避免丢掉已经解析出来的部分响应。
      updateError(error?.error || error);
    }

    const { reasoningContent, content, finish_reason, usage, error } = getResponseData();

    return {
      error,
      answerText: content,
      reasoningText: reasoningContent,
      finish_reason,
      usage
    };
  }
};
