// 鲁港通 - 搜索源抽象（可插拔：日后加 Brave/SearXNG 只改这里，业务层与工作流不动）
// 默认实现走免费、无密钥的 Bing 必应（生产数据中心网络无法访问 DuckDuckGo/Google）；
// DuckDuckGoProvider 保留作备选源，但生产环境不可用（国际搜索引擎被阻断）。
import { parse, type HTMLElement } from 'node-html-parser';
import type {
  RawSearchResult,
  SearchProvider,
  SearchProviderName
} from './types';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DDG_HTML = 'https://html.duckduckgo.com/html/';
const DDG_LITE = 'https://lite.duckduckgo.com/lite/';
const TIMEOUT_MS = 12_000;

// 鲁港通 - 把 DuckDuckGo 跳转包裹链接解码为真实 URL
// 形如 //duckduckgo.com/l/?uddg=<urlencoded>&rut=... → 取 uddg 解码；普通链接原样返回
export function resolveDDGUrl(href: string): string {
  if (!href) return '';
  let h = href.trim();
  if (h.startsWith('//')) h = 'https:' + h;
  try {
    const u = new URL(h);
    const uddg = u.searchParams.get('uddg');
    if (uddg) return decodeURIComponent(uddg);
    return u.toString();
  } catch {
    return h;
  }
}

// 鲁港通 - 折叠摘要里的换行与连续空白，避免把页面排版噪声带进结果
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// 鲁港通 - 原生 fetch + AbortController 超时兜底，防止搜索源卡死拖垮整个工作流
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = TIMEOUT_MS
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// 鲁港通 - 解析主接口 html.duckduckgo.com：a.result__a 为标题链接，.result__snippet 为摘要
function parseHtmlResults(anchors: HTMLElement[]): RawSearchResult[] {
  const out: RawSearchResult[] = [];
  const seen = new Set<string>();
  for (const a of anchors) {
    const url = resolveDDGUrl(a.getAttribute('href') || '');
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const container = a.closest('.result, .web-result') ?? a.parentNode;
    const snippet =
      container?.querySelector('.result__snippet')?.textContent ?? '';
    out.push({
      title: collapseWhitespace(a.textContent),
      url,
      snippet: collapseWhitespace(snippet)
    });
  }
  return out;
}

// 鲁港通 - 解析降级接口 lite.duckduckgo.com：表格布局，a.result-link 与 td.result-snippet 按顺序一一对应
function parseLiteResults(
  anchors: HTMLElement[],
  snippets: HTMLElement[]
): RawSearchResult[] {
  const out: RawSearchResult[] = [];
  const seen = new Set<string>();
  anchors.forEach((a, i) => {
    const url = resolveDDGUrl(a.getAttribute('href') || '');
    if (!url || seen.has(url)) return;
    seen.add(url);
    const snippet = snippets[i]?.textContent ?? '';
    out.push({
      title: collapseWhitespace(a.textContent),
      url,
      snippet: collapseWhitespace(snippet)
    });
  });
  return out;
}

// 鲁港通 - 从 DDG 页面 HTML 解析结果，自动识别主接口 / lite 接口两种结构
export function parseDDG(html: string): RawSearchResult[] {
  if (!html) return [];
  const root = parse(html);

  const htmlAnchors = root.querySelectorAll('a.result__a');
  if (htmlAnchors.length > 0) return parseHtmlResults(htmlAnchors);

  const liteAnchors = root.querySelectorAll('a.result-link');
  if (liteAnchors.length > 0) {
    const liteSnippets = root.querySelectorAll('td.result-snippet');
    return parseLiteResults(liteAnchors, liteSnippets);
  }

  return [];
}

// 鲁港通 - 解析 Bing 结果页：li.b_algo 内 h2 a 为标题链接，.b_caption p 为摘要
// href 可能是 /ck/a?...&u=<base64url 目标链接> 跳转包裹，resolveBingUrl 会解码出真实 URL
export function parseBing(html: string): RawSearchResult[] {
  if (!html) return [];
  const root = parse(html);
  const out: RawSearchResult[] = [];
  const seen = new Set<string>();
  for (const item of root.querySelectorAll('li.b_algo')) {
    const anchor = item.querySelector('h2 a');
    if (!anchor) continue;
    const url = resolveBingUrl(anchor.getAttribute('href') || '');
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const snippet =
      item.querySelector('.b_caption p')?.textContent ??
      item.querySelector('p')?.textContent ??
      '';
    out.push({
      title: collapseWhitespace(anchor.textContent),
      url,
      snippet: collapseWhitespace(snippet)
    });
  }
  return out;
}

// 鲁港通 - 把 Bing 结果链接解析为真实 URL：
// 1) //www.gov.hk/... → 补 https:；2) www.bing.com/ck/a?...&u=a1<base64url> → base64url 解码
// 普通直链原样返回；解析失败返回原串（宁可脏一点也不丢结果）
export function resolveBingUrl(href: string): string {
  if (!href) return '';
  let h = href.trim();
  if (h.startsWith('//')) h = 'https:' + h;
  try {
    const u = new URL(h);
    if (u.hostname.includes('bing.com') && u.pathname.includes('/ck/a')) {
      const target = u.searchParams.get('u');
      if (target && target.startsWith('a1')) {
        const b64 = target.slice(2).replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        return Buffer.from(padded, 'base64').toString('utf-8');
      }
    }
    return u.toString();
  } catch {
    return h;
  }
}

// 鲁港通 - URL 归一化键：小写主机名 + 去 www 前缀 + 去尾斜杠，保留查询串，用于跨源合并去重
export function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    let host = u.hostname.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    return `${host}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return (url || '').trim().toLowerCase();
  }
}

// 鲁港通 - 按归一化 URL 去重，保留先出现者（跨搜索源合并时维持优先级顺序）
export function dedupeByUrl(results: RawSearchResult[]): RawSearchResult[] {
  const seen = new Set<string>();
  const out: RawSearchResult[] = [];
  for (const r of results) {
    const key = normalizeUrlKey(r.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

// 鲁港通 - 简单延时，用于 Bing 限流重试间隔
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 鲁港通 - Bing 必应 Provider：生产网络实测约 50% 成功率且连续请求被限流，
// 故最多尝试 3 次、每次间隔 1.5s；全部失败/空结果返回 []，由业务层生成可操作中文错误
const BING_URL = 'https://www.bing.com/search';
const BING_MAX_ATTEMPTS = 3;
const BING_RETRY_DELAY_MS = 1_500;

export class BingProvider implements SearchProvider {
  readonly name: SearchProviderName = 'bing';
  // 鲁港通 - 必应抓取页对 site: 支持不稳定，不启用增强补发
  readonly supportsSiteBoost = false;

  async search(
    query: string,
    opts?: { maxResults?: number; lang?: string }
  ): Promise<RawSearchResult[]> {
    const max = opts?.maxResults ?? 15;
    const isEn = opts?.lang === 'en';
    // 鲁港通 - 地区/语言 hint：中文走香港市场（mkt=zh-HK），英文走 en-US
    const url = `${BING_URL}?q=${encodeURIComponent(
      query
    )}&count=30&setlang=${isEn ? 'en' : 'zh-Hans'}&mkt=${isEn ? 'en-US' : 'zh-HK'}`;
    const headers = {
      'User-Agent': UA,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': isEn ? 'en-US,en;q=0.9' : 'zh-HK,zh;q=0.9,en;q=0.8'
    };

    for (let attempt = 0; attempt < BING_MAX_ATTEMPTS; attempt++) {
      try {
        const html = await fetchWithTimeout(url, {
          method: 'GET',
          headers
        });
        const results = parseBing(html);
        if (results.length > 0) return results.slice(0, max);
      } catch {
        // 网络错误/超时 → 进入下一次重试
      }
      if (attempt < BING_MAX_ATTEMPTS - 1) await sleep(BING_RETRY_DELAY_MS);
    }
    return [];
  }
}

export class DuckDuckGoProvider implements SearchProvider {
  readonly name: SearchProviderName = 'ddg';
  readonly supportsSiteBoost = false;

  async search(
    query: string,
    opts?: { maxResults?: number; lang?: string }
  ): Promise<RawSearchResult[]> {
    const max = opts?.maxResults ?? 15;
    // 鲁港通 - 地区/语言 hint：非英文一律偏向香港中文 hk-zh，英文用 us-en
    const kl = opts?.lang === 'en' ? 'us-en' : 'hk-zh';
    const body = `q=${encodeURIComponent(query)}&kl=${kl}`;

    const htmlInit: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':
          opts?.lang === 'en' ? 'en-US,en;q=0.9' : 'zh-HK,zh;q=0.9,en;q=0.8'
      },
      body
    };

    // 1) 主接口；数据中心 IP 可能被反爬返回异常/验证页 → 静默降级到 lite 接口
    let html = '';
    try {
      html = await fetchWithTimeout(DDG_HTML, htmlInit);
    } catch {
      html = '';
    }
    let results = html ? parseDDG(html) : [];

    // 2) 降级接口（GET）；仍失败则返回空数组，由业务层生成可操作中文错误而非抛异常
    if (results.length === 0) {
      try {
        const liteHtml = await fetchWithTimeout(
          `${DDG_LITE}?${body}`,
          {
            method: 'GET',
            headers: {
              'User-Agent': UA,
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language':
                opts?.lang === 'en' ? 'en-US,en;q=0.9' : 'zh-HK,zh;q=0.9,en;q=0.8'
            }
          }
        );
        results = parseDDG(liteHtml);
      } catch {
        results = [];
      }
    }

    return results.slice(0, max);
  }
}
