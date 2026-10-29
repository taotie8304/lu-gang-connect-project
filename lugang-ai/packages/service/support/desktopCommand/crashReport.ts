// 鲁港通 - 桌面崩溃上报的归一与截断（纯逻辑）：
// 客户端已脱敏；服务端只负责长度上限与时间归一，避免超长文本进库。
import type { DesktopCrashReportInput } from '@fastgpt/global/support/desktopCommand/type';

/** 单次上传最多 3 条，避免异常风暴把接口当成日志管道 */
export const DESKTOP_CRASH_MAX_REPORTS_PER_UPLOAD = 3;

export const DESKTOP_CRASH_MESSAGE_MAX_CHARS = 2000;
export const DESKTOP_CRASH_STACK_MAX_CHARS = 8000;
export const DESKTOP_CRASH_LOG_MAX_CHARS = 12_000;

export const truncateDesktopCrashText = (
  value: string | undefined,
  max: number
): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
};

const normalizeOccurredAt = (value: number, now: number) =>
  new Date(Number.isFinite(value) && value > 0 ? Math.min(value, now) : now);

export type NormalizedDesktopCrashReport = {
  type: DesktopCrashReportInput['type'];
  message: string;
  stack?: string;
  log?: string;
  occurredAt: Date;
};

export const normalizeDesktopCrashReport = (
  report: DesktopCrashReportInput,
  { now = Date.now() }: { now?: number } = {}
): NormalizedDesktopCrashReport => ({
  type: report.type,
  message:
    truncateDesktopCrashText(report.message, DESKTOP_CRASH_MESSAGE_MAX_CHARS) ?? '（缺少错误信息）',
  stack: truncateDesktopCrashText(report.stack, DESKTOP_CRASH_STACK_MAX_CHARS),
  log: truncateDesktopCrashText(report.log, DESKTOP_CRASH_LOG_MAX_CHARS),
  occurredAt: normalizeOccurredAt(report.occurredAt, now)
});
