// 鲁港通 - 域名过滤：默认拒绝策略。凡不在白名单(A-H)的一律丢弃，而不是“不在黑名单就放行”。
import {
  GOV_SUFFIXES,
  PUBLIC_BODIES,
  ACADEMIC_SUFFIXES,
  UNIVERSITIES,
  NONPROFIT_SUFFIXES,
  FINANCE_BANKS,
  FINANCE_INSURERS,
  FINANCE_SECURITIES_FUNDS,
  MEDICAL_INSTITUTIONS,
  NEWS_MEDIA,
  TV_STATIONS,
  SOCIAL_MEDIA,
  MARKETING_PLATFORMS
} from './whitelist';
import type {
  RawSearchResult,
  FilteredResult,
  SearchScope,
  SourceType
} from './types';

// 鲁港通 - 从 URL 提取规范化主机名：转小写、去前导 www.；非法 URL 返回空串
export function normalizeHost(url: string): string {
  try {
    let h = new URL(url).hostname.toLowerCase();
    if (h.startsWith('www.')) h = h.slice(4);
    return h;
  } catch {
    return '';
  }
}

// 鲁港通 - 后缀匹配：host 本身等于 domain，或以 .domain 结尾（保证 fac.hku.hk 命中 hku.hk）
function matchSuffix(host: string, domain: string): boolean {
  return host === domain || host.endsWith('.' + domain);
}

function matchAny(host: string, domains: string[]): boolean {
  return domains.some((d) => matchSuffix(host, d));
}

// 鲁港通 - 来源分类：按 A政府→B公营→C学术→D非盈利→G金融→H医疗→F电视台→E新闻 顺序命中即返回；都不命中为 other
export function classify(host: string): SourceType {
  if (matchAny(host, GOV_SUFFIXES)) return 'gov';
  if (matchAny(host, PUBLIC_BODIES)) return 'public';
  if (matchAny(host, ACADEMIC_SUFFIXES) || matchAny(host, UNIVERSITIES))
    return 'academic';
  if (matchAny(host, NONPROFIT_SUFFIXES)) return 'nonprofit';
  if (
    matchAny(host, FINANCE_BANKS) ||
    matchAny(host, FINANCE_INSURERS) ||
    matchAny(host, FINANCE_SECURITIES_FUNDS)
  )
    return 'finance';
  if (matchAny(host, MEDICAL_INSTITUTIONS)) return 'medical';
  if (matchAny(host, TV_STATIONS)) return 'tv';
  if (matchAny(host, NEWS_MEDIA)) return 'news';
  return 'other';
}

export interface JudgeVerdict {
  allow: boolean;
  reason:
    | 'open-scope'
    | 'whitelist'
    | 'social-media'
    | 'marketing'
    | 'not-whitelisted'
    | 'invalid-url';
  sourceType: SourceType;
}

// 鲁港通 - 单条判定：official 模式先黑名单（社交→营销）再白名单，其余默认拒绝；open 模式完全放行
export function judge(url: string, scope: SearchScope): JudgeVerdict {
  const host = normalizeHost(url);
  const sourceType = classify(host);
  if (!host) return { allow: false, reason: 'invalid-url', sourceType };

  // 1. open 模式（仅“香港本地生活小助手”节点）：白名单、黑名单都不生效，直接放行
  if (scope === 'open') return { allow: true, reason: 'open-scope', sourceType };

  // 2. official 模式：社交媒体硬拒绝（即使挂着官方媒体账号也不返回）
  if (matchAny(host, SOCIAL_MEDIA))
    return { allow: false, reason: 'social-media', sourceType };

  // 3. official 模式：营销平台拒绝
  if (matchAny(host, MARKETING_PLATFORMS))
    return { allow: false, reason: 'marketing', sourceType };

  // 4. official 模式：白名单(A-H)命中才放行
  if (sourceType !== 'other')
    return { allow: true, reason: 'whitelist', sourceType };

  // 5. 默认拒绝（未知域名，宁可少返回也不返回违规来源）
  return { allow: false, reason: 'not-whitelisted', sourceType };
}

export interface FilterResult {
  allowed: FilteredResult[];
  rejected: { url: string; reason: string }[];
}

// 鲁港通 - 批量过滤：放行项补齐规范化 source 主机名与 sourceType 分类
export function filterResults(
  raw: RawSearchResult[],
  scope: SearchScope
): FilterResult {
  const allowed: FilteredResult[] = [];
  const rejected: { url: string; reason: string }[] = [];
  for (const r of raw) {
    const verdict = judge(r.url, scope);
    if (verdict.allow) {
      allowed.push({
        ...r,
        source: normalizeHost(r.url),
        sourceType: verdict.sourceType
      });
    } else {
      rejected.push({ url: r.url, reason: verdict.reason });
    }
  }
  return { allowed, rejected };
}
