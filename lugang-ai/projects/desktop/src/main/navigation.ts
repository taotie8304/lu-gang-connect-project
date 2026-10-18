// 鲁港通 - 主窗口导航策略：站内放行；登录页临时放行外站（OAuth）；其余交系统浏览器
export type NavigationDecision =
  | { type: 'allow' }
  | { type: 'external'; url: string }
  | { type: 'block' };

const parseUrl = (input: string): URL | null => {
  try {
    return new URL(input);
  } catch {
    return null;
  }
};

export const decideMainWindowNavigation = ({
  currentUrl,
  targetUrl,
  appOrigin
}: {
  currentUrl: string;
  targetUrl: string;
  appOrigin: string;
}): NavigationDecision => {
  const target = parseUrl(targetUrl);
  if (!target) return { type: 'block' };
  if (target.origin === appOrigin) return { type: 'allow' };
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return { type: 'block' };

  const current = parseUrl(currentUrl);
  const isLoginFlow =
    !!current && current.origin === appOrigin && current.pathname.startsWith('/login');
  if (isLoginFlow) return { type: 'allow' };

  return { type: 'external', url: target.href };
};

export const isManualBrowserUrlAllowed = (targetUrl: string): boolean => {
  const target = parseUrl(targetUrl);
  return !!target && (target.protocol === 'http:' || target.protocol === 'https:');
};

// 鲁港通 - 标签页网址允许 localhost/内网 IP，与主窗口的应用地址校验区分
export const parseManualBrowserUrl = (input: string): string | null => {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  const target = parseUrl(withScheme);
  if (!target || (target.protocol !== 'http:' && target.protocol !== 'https:')) return null;
  return target.href;
};
