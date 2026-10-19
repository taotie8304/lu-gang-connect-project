// 鲁港通 - 提交确认等待：用户不操作时 5 分钟自动取消，决定只生效一次
import type { AiConfirmationDecision } from './executor';

export const AI_CONFIRM_TIMEOUT_MS = 5 * 60 * 1000;

export type AiConfirmationGate = {
  promise: Promise<AiConfirmationDecision>;
  decide: (decision: AiConfirmationDecision) => void;
  dispose: () => void;
};

export const createConfirmationGate = (
  options: { timeoutMs?: number; onTimeout?: () => void } = {}
): AiConfirmationGate => {
  let settled = false;
  let resolvePromise: (decision: AiConfirmationDecision) => void = () => undefined;
  const promise = new Promise<AiConfirmationDecision>((resolve) => {
    resolvePromise = resolve;
  });

  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    options.onTimeout?.();
    resolvePromise('timeout');
  }, options.timeoutMs ?? AI_CONFIRM_TIMEOUT_MS);

  return {
    promise,
    decide: (decision) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(decision);
    },
    // 鲁港通 - 窗口被系统关闭或页面销毁时按取消处理，绝不放行提交
    dispose: () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise('cancel');
    }
  };
};
