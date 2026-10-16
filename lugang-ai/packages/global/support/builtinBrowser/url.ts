// 鲁港通 - 办事浏览器网址归一化（内置浏览器 · 网址栏）：
// 面板输入框与服务端 PATCH 接口共用；裸域名补全 https，非 http(s) 或非法输入返回 null
export const normalizeBuiltinBrowserUrl = (input: string): string | null => {
  const raw = input.trim();
  if (!raw) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // 主机名必须含点（拒绝单词输入如 hello、中文词；IP 地址天然含点）
    if (!url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
};
