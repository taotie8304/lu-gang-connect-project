// 鲁港通 - 办事浏览器标签轮询调度器（A1 卡死缓解）：
// 单飞（同一时刻最多一个请求在途）+ 失败指数退避 + 页面隐藏暂停 + 慢轮询取证

export const TAB_REFRESH_BASE_DELAY_MS = 3000;
export const TAB_REFRESH_MAX_DELAY_MS = 30000;
export const TAB_REFRESH_SLOW_THRESHOLD_MS = 8000;

/** 失败次数 → 下次轮询延迟：3s 起指数退避，封顶 30s */
export const getTabRefreshDelay = (consecutiveFailures: number) =>
  Math.min(
    TAB_REFRESH_BASE_DELAY_MS * 2 ** Math.max(0, consecutiveFailures),
    TAB_REFRESH_MAX_DELAY_MS
  );

export type TabRefreshSchedulerOptions = {
  /** 执行一次轮询，返回是否成功；抛错按失败处理 */
  refresh: () => Promise<boolean>;
  /** 页面是否暂停轮询（调用方按页面可见性判断） */
  isPaused?: () => boolean;
  /** 单次轮询超过阈值时的慢日志回调 */
  onSlow?: (elapsedMs: number) => void;
  slowThresholdMs?: number;
};

export type TabRefreshScheduler = {
  start: () => void;
  stop: () => void;
  /** 立即轮询一次；已有请求在途时复用当前请求，不叠加 */
  trigger: () => Promise<void>;
};

/** 创建标签轮询调度器：递归 setTimeout 排下一轮，避免 setInterval 在慢请求下堆叠；
 * 失败按指数退避，成功后恢复基础间隔；停止后不再发起任何请求 */
export const createTabRefreshScheduler = ({
  refresh,
  isPaused = () => false,
  onSlow,
  slowThresholdMs = TAB_REFRESH_SLOW_THRESHOLD_MS
}: TabRefreshSchedulerOptions): TabRefreshScheduler => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = true;
  let inFlight: Promise<void> | undefined;
  let failures = 0;

  const clearTimer = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const scheduleNext = () => {
    if (stopped) return;
    clearTimer();
    timer = setTimeout(() => {
      void run();
    }, getTabRefreshDelay(failures));
  };

  const run = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (inFlight) return inFlight;
    if (isPaused()) {
      scheduleNext();
      return Promise.resolve();
    }

    const startedAt = Date.now();
    inFlight = refresh()
      .then(
        (ok) => {
          failures = ok ? 0 : failures + 1;
        },
        () => {
          failures += 1;
        }
      )
      .finally(() => {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= slowThresholdMs) {
          onSlow?.(elapsed);
        }
        inFlight = undefined;
        scheduleNext();
      });
    return inFlight;
  };

  return {
    start: () => {
      if (!stopped) return;
      stopped = false;
      // 启动即轮询一次，不等首个间隔
      timer = setTimeout(() => {
        void run();
      }, 0);
    },
    stop: () => {
      stopped = true;
      clearTimer();
    },
    trigger: run
  };
};
