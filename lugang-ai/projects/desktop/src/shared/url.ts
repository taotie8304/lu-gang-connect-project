// 鲁港通 - 桌面端网址工具：手动浏览只接受 http/https，裸域名补 https
export const DEFAULT_APP_URL = 'https://www.airscend.com';

const parseHttpUrl = (input: string): URL | null => {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url;
  } catch {
    return null;
  }
};

export const normalizeHttpUrl = (input: string): string | null => parseHttpUrl(input)?.href ?? null;

// 鲁港通 - 应用地址允许 localhost（本地开发），区别于用户输入的网址校验
export const resolveAppUrl = (raw?: string): string => {
  const candidate = raw?.trim();
  if (!candidate) return DEFAULT_APP_URL;
  try {
    const url = new URL(candidate);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch {
    // 非法值回落到线上地址
  }
  return DEFAULT_APP_URL;
};
