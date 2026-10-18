// 鲁港通 - 主窗口导航策略：站内放行；登录页首跳外站与登录域内同源跳转放行（OAuth）；其余交系统浏览器
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

  // 鲁港通 - appOrigin 可能来自 resolveAppUrl 的 href（带尾斜杠等），先归一化为 origin 再比较
  const appOriginNormalized = parseUrl(appOrigin)?.origin ?? appOrigin;
  if (target.origin === appOriginNormalized) return { type: 'allow' };
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return { type: 'block' };

  const current = parseUrl(currentUrl);
  if (current) {
    // 鲁港通 - /login 必须按路径边界匹配，避免 /loginfoo 之类被误判为登录页
    const isLoginPage =
      current.origin === appOriginNormalized &&
      (current.pathname === '/login' || current.pathname.startsWith('/login/'));
    if (isLoginPage) return { type: 'allow' };
    // 鲁港通 - 已处于登录所需第三方域（SSO/OAuth）时，仅放行与该域同源的后续跳转，
    // 让登录流程在主窗口内完成，同时不放宽到任意站点
    if (current.origin !== appOriginNormalized && target.origin === current.origin) {
      return { type: 'allow' };
    }
  }

  return { type: 'external', url: target.href };
};

export const isManualBrowserUrlAllowed = (targetUrl: string): boolean => {
  const target = parseUrl(targetUrl);
  return !!target && (target.protocol === 'http:' || target.protocol === 'https:');
};

// 鲁港通 - 标签页与弹窗导航守卫的统一判定：about:blank 是新建标签的占位页，其余只允许 http(s)
export const isManualBrowserNavigationAllowed = (targetUrl: string): boolean =>
  targetUrl === 'about:blank' || isManualBrowserUrlAllowed(targetUrl);

export type WindowOpenDecision =
  | { type: 'external'; url: string }
  | { type: 'popup' }
  | { type: 'block' };

// 鲁港通 - window.open 分流：放行目标以受控弹窗承载（保住 window.opener 与聊天状态），
// 站外 http(s) 交系统浏览器，非 http(s) 直接阻止
export const decideMainWindowWindowOpen = ({
  currentUrl,
  targetUrl,
  appOrigin
}: {
  currentUrl: string;
  targetUrl: string;
  appOrigin: string;
}): WindowOpenDecision => {
  const decision = decideMainWindowNavigation({ currentUrl, targetUrl, appOrigin });
  if (decision.type === 'external') return { type: 'external', url: decision.url };
  if (decision.type === 'block') return { type: 'block' };
  return { type: 'popup' };
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
