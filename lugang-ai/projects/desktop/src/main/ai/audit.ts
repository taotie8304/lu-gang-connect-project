// 鲁港通 - AI 操作审计：只记录操作元数据，不记录用户输入内容，保留 90 天
export const AI_AUDIT_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export type AiAuditOutcome = 'ok' | 'failed' | 'blocked' | 'stopped';

export type AiAuditRecord = {
  time: string;
  commandId: string;
  action: string;
  outcome: AiAuditOutcome;
  errorCode?: string;
  host?: string;
  path?: string;
  target?: string;
  durationMs?: number;
  reopen?: boolean;
};

const parseHttpUrl = (input?: string): URL | null => {
  if (!input) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
};

export const buildAiAuditRecord = ({
  commandId,
  action,
  outcome,
  errorCode,
  url,
  target,
  durationMs,
  reopen,
  now = new Date()
}: {
  commandId: string;
  action: string;
  outcome: AiAuditOutcome;
  errorCode?: string;
  url?: string;
  target?: string;
  durationMs?: number;
  reopen?: boolean;
  now?: Date;
}): AiAuditRecord => {
  const parsed = parseHttpUrl(url);
  return {
    time: now.toISOString(),
    commandId,
    action,
    outcome,
    ...(errorCode ? { errorCode } : {}),
    ...(parsed ? { host: parsed.hostname, path: parsed.pathname } : {}),
    ...(target ? { target: target.slice(0, 200) } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(reopen ? { reopen } : {})
  };
};

export const parseAiAuditFileName = (fileName: string): Date | null => {
  // 鲁港通 - 兼容磁盘上的完整文件名与仅日期文件名两种写法
  const match = /^(?:ai-audit-)?(\d{4})-(\d{2})-(\d{2})\.jsonl$/.exec(fileName);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`) return null;
  return date;
};

export const aiAuditFileName = (now: Date): string => `ai-audit-${now.toISOString().slice(0, 10)}.jsonl`;

export const isAiAuditFileExpired = (
  fileName: string,
  now: Date,
  retentionDays = AI_AUDIT_RETENTION_DAYS
): boolean => {
  const date = parseAiAuditFileName(fileName);
  if (!date) return false;
  // 鲁港通 - 按自然日比较：当天 0 点起算 90 天内（含第 90 天）均保留
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const cutoff = today.getTime() - retentionDays * DAY_MS;
  return date.getTime() < cutoff;
};
