// 鲁港通 - 办事浏览器标签轮询调度器单测（A1 卡死缓解）：
// 单飞防叠加、失败退避、页面隐藏暂停、慢轮询取证
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTabRefreshScheduler,
  getTabRefreshDelay,
  TAB_REFRESH_BASE_DELAY_MS,
  TAB_REFRESH_MAX_DELAY_MS
} from '@/pageComponents/chat/builtinBrowser/polling';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getTabRefreshDelay', () => {
  it('无失败按基础间隔 3 秒', () => {
    expect(getTabRefreshDelay(0)).toBe(TAB_REFRESH_BASE_DELAY_MS);
  });

  it('连续失败按 6 / 12 / 24 秒指数退避，封顶 30 秒', () => {
    expect(getTabRefreshDelay(1)).toBe(6000);
    expect(getTabRefreshDelay(2)).toBe(12000);
    expect(getTabRefreshDelay(3)).toBe(24000);
    expect(getTabRefreshDelay(4)).toBe(TAB_REFRESH_MAX_DELAY_MS);
    expect(getTabRefreshDelay(10)).toBe(TAB_REFRESH_MAX_DELAY_MS);
  });
});

describe('createTabRefreshScheduler', () => {
  it('启动后立即轮询一次，成功后按基础间隔继续', async () => {
    const refresh = vi.fn().mockResolvedValue(true);
    const scheduler = createTabRefreshScheduler({ refresh });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(TAB_REFRESH_BASE_DELAY_MS - 1);
    expect(refresh).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it('轮询进行中再次触发不叠加请求（单飞）', async () => {
    let resolveFirst!: (value: boolean) => void;
    const refresh = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveFirst = resolve;
        })
    );
    const scheduler = createTabRefreshScheduler({ refresh });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);

    const pending = scheduler.trigger();
    expect(refresh).toHaveBeenCalledTimes(1);

    resolveFirst(true);
    await pending;
    scheduler.stop();
  });

  it('连续失败按退避间隔重试，成功后恢复基础间隔', async () => {
    const refresh = vi.fn().mockResolvedValue(false);
    const scheduler = createTabRefreshScheduler({ refresh });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);

    // 第 1 次失败 → 6 秒后重试
    await vi.advanceTimersByTimeAsync(5999);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);

    // 第 2 次失败 → 12 秒后重试
    await vi.advanceTimersByTimeAsync(11999);
    expect(refresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(3);

    // 第 3 次失败 → 24 秒后重试
    await vi.advanceTimersByTimeAsync(24000);
    expect(refresh).toHaveBeenCalledTimes(4);

    // 第 4 次失败 → 封顶 30 秒后重试，此时恢复成功
    refresh.mockResolvedValue(true);
    await vi.advanceTimersByTimeAsync(30000);
    expect(refresh).toHaveBeenCalledTimes(5);

    // 成功后退避清零：3 秒后即再轮询
    await vi.advanceTimersByTimeAsync(TAB_REFRESH_BASE_DELAY_MS);
    expect(refresh).toHaveBeenCalledTimes(6);

    scheduler.stop();
  });

  it('轮询抛错按失败处理并继续退避', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('boom'));
    const scheduler = createTabRefreshScheduler({ refresh });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(6000);
    expect(refresh).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it('页面隐藏时暂停请求，恢复可见后手动触发立即轮询', async () => {
    let hidden = true;
    const refresh = vi.fn().mockResolvedValue(true);
    const scheduler = createTabRefreshScheduler({
      refresh,
      isPaused: () => hidden
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).not.toHaveBeenCalled();

    hidden = false;
    await scheduler.trigger();
    expect(refresh).toHaveBeenCalledTimes(1);

    scheduler.stop();
  });

  it('单次轮询超过阈值触发慢日志回调', async () => {
    let resolveFirst!: (value: boolean) => void;
    const onSlow = vi.fn();
    const scheduler = createTabRefreshScheduler({
      refresh: () =>
        new Promise<boolean>((resolve) => {
          resolveFirst = resolve;
        }),
      slowThresholdMs: 8000,
      onSlow
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(8000);

    const pending = scheduler.trigger();
    resolveFirst(true);
    await pending;
    expect(onSlow).toHaveBeenCalledWith(8000);

    scheduler.stop();
  });

  it('停止后不再发起轮询', async () => {
    const refresh = vi.fn().mockResolvedValue(true);
    const scheduler = createTabRefreshScheduler({ refresh });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
