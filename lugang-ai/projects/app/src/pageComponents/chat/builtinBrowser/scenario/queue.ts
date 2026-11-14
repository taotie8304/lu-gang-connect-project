// 鲁港通 - 场景指令待发送队列：只保留最后一次，消费后 id 继续递增
import type { ScenarioPrompt } from './types';

export type ScenarioPromptState = {
  prompt: ScenarioPrompt | null;
  nextId: number;
};

export const initialScenarioPromptState: ScenarioPromptState = { prompt: null, nextId: 0 };

export const queueScenarioPrompt = (
  state: ScenarioPromptState,
  text: string
): ScenarioPromptState => {
  const nextId = state.nextId + 1;
  return { prompt: { id: nextId, text }, nextId };
};

export const consumeScenarioPrompt = (state: ScenarioPromptState): ScenarioPromptState =>
  state.prompt ? { ...state, prompt: null } : state;
