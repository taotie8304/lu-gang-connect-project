// 鲁港通 - AI 操作网页只拦截本机/内网地址与本地协议，公网站点不设白名单
// 例外：敏感信息仍由执行层拦截，提交类动作仍弹原生确认

const normalizeHost = (hostname: string): string =>
  hostname.trim().toLowerCase().replace(/\.$/, '');

const stripBrackets = (host: string): string =>
  host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

const isPrivateIpv4 = (host: string): boolean => {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const [a, b] = match.slice(1).map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
};

const isPrivateIpv6 = (host: string): boolean => {
  if (host === '::' || host === '::1') return true;
  if (/^fe[89ab][0-9a-f]?:/.test(host)) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(host);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
};

/** 本机回环、内网、链路本地与本地专用域名都视为不可代操作。 */
export const isAiPrivateHost = (hostname: string): boolean => {
  const host = stripBrackets(normalizeHost(hostname));
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  return isPrivateIpv4(host) || isPrivateIpv6(host);
};

/** 可导航地址：http/https 且主机不在本机/内网。 */
export const isAiUrlOperable = (input: string): boolean => {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return !isAiPrivateHost(url.hostname);
  } catch {
    return false;
  }
};

/** 快照可读：空白页、加载失败页照常读取，本机内网与本地文件不放行。 */
export const isAiSnapshotUrlAllowed = (input?: string): boolean => {
  if (!input) return true;
  if (input.startsWith('about:') || input.startsWith('chrome-error://')) return true;
  return isAiUrlOperable(input);
};
