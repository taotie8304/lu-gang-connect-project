import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AI_CONFIRM_TIMEOUT_MS,
  createConfirmationGate
} from '../src/main/ai/confirmationGate';

afterEach(() => {
  vi.useRealTimers();
});

describe('提交确认等待', () => {
  it('等待上限为 5 分钟', () => {
    expect(AI_CONFIRM_TIMEOUT_MS).toBe(5 * 60 * 1000);
  });

  it('5 分钟没有任何操作自动取消', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const gate = createConfirmationGate({ onTimeout });
    let settled: string | undefined;
    void gate.promise.then((decision) => {
      settled = decision;
    });

    await vi.advanceTimersByTimeAsync(AI_CONFIRM_TIMEOUT_MS - 1);
    expect(settled).toBeUndefined();
    expect(onTimeout).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    expect(settled).toBe('timeout');
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('用户选择后立即结束且不再触发超时', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const gate = createConfirmationGate({ onTimeout });

    gate.decide('allow');
    await expect(gate.promise).resolves.toBe('allow');

    await vi.advanceTimersByTimeAsync(AI_CONFIRM_TIMEOUT_MS * 2);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('超时后的选择不生效，保证只提交或取消一次', async () => {
    vi.useFakeTimers();
    const gate = createConfirmationGate();
    await vi.advanceTimersByTimeAsync(AI_CONFIRM_TIMEOUT_MS);

    gate.decide('allow');
    await expect(gate.promise).resolves.toBe('timeout');
  });

  it('窗口被意外关闭时按取消处理', async () => {
    vi.useFakeTimers();
    const gate = createConfirmationGate();
    gate.dispose();
    await expect(gate.promise).resolves.toBe('cancel');
  });
});
