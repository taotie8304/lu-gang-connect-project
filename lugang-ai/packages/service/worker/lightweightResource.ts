import { getSystemCpuInfo } from '../common/system/resource';
import {
  fileParseResourceConstants,
  getFileParseMemoryState,
  type FileParseMemoryState
} from './fileParseResource';
import type { WorkerPoolResourcePolicy } from './utils';

/** 轻量 worker（仅 turndown + 文本解码，常驻约 60 MB）所需的独立安全余量。 */
export const LIGHTWEIGHT_SAFETY_RESERVE_BYTES = 256 * 1024 * 1024;

export const lightweightWorkerResourceConstants = {
  maxWorkers: 5,
  queueTimeoutMs: fileParseResourceConstants.queueTimeoutMs,
  resourcePollIntervalMs: 30 * 1000,
  idleWorkerTimeoutMs: fileParseResourceConstants.idleWorkerTimeoutMs,
  minIdleWorkers: fileParseResourceConstants.minIdleWorkers
} as const;

/**
 * 返回轻量转换 Worker 的并发硬上限。
 *
 * CPU 并行度已考虑容器配额与进程亲和性；额外限制为 5，避免轻量任务在大规格机器上瞬间创建过多线程。
 */
export const getLightweightWorkerMaxWorkers = (
  parallelism = getSystemCpuInfo().availableCpuCount
) => {
  if (!Number.isFinite(parallelism)) return 1;
  return Math.min(
    lightweightWorkerResourceConstants.maxWorkers,
    Math.max(1, Math.floor(parallelism))
  );
};

/**
 * 把文件解析的内存快照换算为轻量通道口径。
 *
 * 重解析池为 Office/PDF 解析预留 1 GiB，网页与纯文本无需这部分余量；轻量任务只保留
 * 256 MiB 垫底，避免在可用内存充足时仍排队等待重解析资源。
 */
export const getLightweightMemoryState = (
  state: FileParseMemoryState = getFileParseMemoryState()
): FileParseMemoryState => {
  const safetyReserveBytes = Math.min(state.safetyReserveBytes, LIGHTWEIGHT_SAFETY_RESERVE_BYTES);

  return {
    ...state,
    safetyReserveBytes,
    maximumSafeTaskMemoryBytes: Math.max(0, state.constrainedMemoryBytes - safetyReserveBytes),
    currentlySchedulableMemoryBytes: Math.max(0, state.availableMemoryBytes - safetyReserveBytes)
  };
};

/**
 * 轻量转换任务不根据输入大小估算峰值，只在系统安全预留之外仍有可调度内存时启动。
 * 当前无余量时任务留在 WorkerPool 队列，由任务完成事件或定时轮询再次尝试。
 */
export const createLightweightWorkerResourcePolicy = <
  Props
>(): WorkerPoolResourcePolicy<Props> => ({
  getTaskResourceBytes: () => 0,
  getResourceSnapshot: () => {
    const memoryDetails = getLightweightMemoryState();
    return {
      availableResourceBytes: memoryDetails.currentlySchedulableMemoryBytes,
      maximumTaskResourceBytes: memoryDetails.maximumSafeTaskMemoryBytes,
      memoryDetails
    };
  },
  canRunTask: ({ resourceSnapshot }) => resourceSnapshot.availableResourceBytes > 0,
  queueTimeoutMs: lightweightWorkerResourceConstants.queueTimeoutMs,
  resourcePollIntervalMs: lightweightWorkerResourceConstants.resourcePollIntervalMs
});

/** 返回 HTML 转 Markdown 和文本切块共用的 WorkerPool 资源参数。 */
export const getLightweightWorkerPoolOptions = <Props>() => ({
  maxReservedThreads: getLightweightWorkerMaxWorkers(),
  resourcePolicy: createLightweightWorkerResourcePolicy<Props>(),
  idleWorkerTimeoutMs: lightweightWorkerResourceConstants.idleWorkerTimeoutMs,
  minIdleWorkers: lightweightWorkerResourceConstants.minIdleWorkers
});
