// 鲁港通 - AI 操控站点白名单：默认只放行政府官网，测试环境可通过环境变量追加本地地址
export const DEFAULT_AI_ALLOWED_HOSTS = ['.gov.hk', '.gov.cn'];

const normalizeHost = (hostname: string): string => hostname.trim().toLowerCase().replace(/\.$/, '');

const normalizeEntry = (entry: string): string => {
  const trimmed = entry.trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.startsWith('.') ? `.${normalizeHost(trimmed.slice(1))}` : normalizeHost(trimmed);
};

export const parseAiAllowedHosts = (raw?: string): string[] => {
  const entries = (raw ?? '')
    .split(',')
    .map(normalizeEntry)
    .filter(Boolean);
  return entries.length > 0 ? entries : [...DEFAULT_AI_ALLOWED_HOSTS];
};

export const isAiHostAllowed = (hostname: string, allowedHosts: string[]): boolean => {
  const host = normalizeHost(hostname);
  if (!host) return false;
  return allowedHosts.some((raw) => {
    const entry = normalizeEntry(raw);
    if (!entry) return false;
    if (entry.startsWith('.')) {
      return host === entry.slice(1) || host.endsWith(entry);
    }
    return host === entry;
  });
};

export const isAiUrlAllowed = (input: string, allowedHosts: string[]): boolean => {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return isAiHostAllowed(url.hostname, allowedHosts);
  } catch {
    return false;
  }
};
