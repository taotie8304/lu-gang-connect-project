import { describe, expect, it } from 'vitest';
import {
  consumeScenarioPrompt,
  initialScenarioPromptState,
  queueScenarioPrompt
} from '@/pageComponents/chat/builtinBrowser/scenario/queue';

describe('场景指令队列', () => {
  it('连续入队只保留最后一次', () => {
    const first = queueScenarioPrompt(initialScenarioPromptState, '第一次');
    const second = queueScenarioPrompt(first, '第二次');
    expect(second.prompt).toEqual({ id: 2, text: '第二次' });
    expect(first.prompt).toEqual({ id: 1, text: '第一次' });
  });

  it('消费后清空待发送，id 继续递增', () => {
    const queued = queueScenarioPrompt(initialScenarioPromptState, '指令');
    const consumed = consumeScenarioPrompt(queued);
    expect(consumed.prompt).toBeNull();
    expect(queueScenarioPrompt(consumed, '下一条').prompt?.id).toBe(2);
  });

  it('空队列消费是幂等的', () => {
    const consumed = consumeScenarioPrompt(initialScenarioPromptState);
    expect(consumed.prompt).toBeNull();
    expect(consumeScenarioPrompt(consumed)).toBe(consumed);
  });
});
