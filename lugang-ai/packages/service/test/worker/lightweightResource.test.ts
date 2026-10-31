import { describe, expect, it } from 'vitest';
import {
  LIGHTWEIGHT_SAFETY_RESERVE_BYTES,
  createLightweightWorkerResourcePolicy,
  getLightweightMemoryState,
  getLightweightWorkerMaxWorkers,
  lightweightWorkerResourceConstants
} from '@fastgpt/service/worker/lightweightResource';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

describe('worker/lightweightResource', () => {
  it.each([
    [Number.NaN, 1],
    [0, 1],
    [1, 1],
    [4, 4],
    [5, 5],
    [16, 5]
  ])('可用 CPU 并行度为 %s 时最多创建 %i 个 worker', (parallelism, expected) => {
    expect(getLightweightWorkerMaxWorkers(parallelism)).toBe(expected);
  });

  it('复用文件解析的排队和空闲回收参数', () => {
    expect(lightweightWorkerResourceConstants).toEqual({
      maxWorkers: 5,
      queueTimeoutMs: 30 * 60 * 1000,
      resourcePollIntervalMs: 30 * 1000,
      idleWorkerTimeoutMs: 60 * 1000,
      minIdleWorkers: 1
    });
  });

  it('轻量任务使用 256 MiB 独立安全余量，而不是文件解析的 1 GiB', () => {
    expect(LIGHTWEIGHT_SAFETY_RESERVE_BYTES).toBe(256 * MIB);

    const state = getLightweightMemoryState({
      constrainedMemoryBytes: 8 * GIB,
      availableMemoryBytes: 1200 * MIB,
      safetyReserveBytes: GIB,
      maximumSafeTaskMemoryBytes: 7 * GIB,
      currentlySchedulableMemoryBytes: 176 * MIB
    });

    expect(state.safetyReserveBytes).toBe(256 * MIB);
    expect(state.availableMemoryBytes).toBe(1200 * MIB);
    // 文件解析口径只剩 176 MiB，轻量口径应放行 944 MiB
    expect(state.currentlySchedulableMemoryBytes).toBe(944 * MIB);
  });

  it('可用内存低于 256 MiB 时轻量任务同样排队', () => {
    expect(
      getLightweightMemoryState({
        constrainedMemoryBytes: 8 * GIB,
        availableMemoryBytes: 200 * MIB,
        safetyReserveBytes: GIB,
        maximumSafeTaskMemoryBytes: 7 * GIB,
        currentlySchedulableMemoryBytes: 0
      }).currentlySchedulableMemoryBytes
    ).toBe(0);
  });

  it('准入快照使用轻量余量并对外暴露 256 MiB 安全保留', () => {
    const snapshot = createLightweightWorkerResourcePolicy<{ value: string }>().getResourceSnapshot();

    expect(snapshot.memoryDetails?.safetyReserveBytes).toBe(256 * MIB);
    expect(snapshot.availableResourceBytes).toBe(
      snapshot.memoryDetails?.currentlySchedulableMemoryBytes
    );
  });

  it('任务不估算输入内存，仅在剩余可调度内存大于 0 时放行', () => {
    const policy = createLightweightWorkerResourcePolicy<{ value: string }>();
    expect(policy.getTaskResourceBytes({ value: 'large input' })).toBe(0);
    expect(policy.resourcePollIntervalMs).toBe(30 * 1000);

    const canRunTask = policy.canRunTask!;
    expect(
      canRunTask({
        data: { value: 'queued' },
        resourceSnapshot: { availableResourceBytes: 0, maximumTaskResourceBytes: 1024 }
      })
    ).toBe(false);
    expect(
      canRunTask({
        data: { value: 'running' },
        resourceSnapshot: { availableResourceBytes: 1, maximumTaskResourceBytes: 1024 }
      })
    ).toBe(true);
  });
});
