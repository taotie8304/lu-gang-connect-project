// 鲁港通 - 对话文件保留期：环境变量可调 1..7 天，缺省 7 天，供上传 TTL 与清理口径复用。
export const DEFAULT_CHAT_FILE_RETENTION_DAYS = 7;
export const MAX_CHAT_FILE_RETENTION_DAYS = 7;
export const MIN_CHAT_FILE_RETENTION_DAYS = 1;

export const getChatFileRetentionDays = (): number => {
  const rawText = process.env.LUGANG_CHAT_FILE_RETENTION_DAYS?.trim();
  if (!rawText) return DEFAULT_CHAT_FILE_RETENTION_DAYS;
  const raw = Number(rawText);
  if (!Number.isFinite(raw)) return DEFAULT_CHAT_FILE_RETENTION_DAYS;
  return Math.min(
    MAX_CHAT_FILE_RETENTION_DAYS,
    Math.max(MIN_CHAT_FILE_RETENTION_DAYS, Math.floor(raw))
  );
};
