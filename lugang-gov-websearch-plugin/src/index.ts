// 鲁港通 - 政府官网联网搜索插件 业务层入口
// 导出 InputType / OutputType / tool / SearchResultSchema 供根目录 index.ts 使用
import { z } from 'zod';
import { BailianProvider } from './bailian-provider';
import { BingProvider, dedupeByUrl } from './search-provider';
import { filterResults, normalizeHost } from './domain-filter';
import { buildSearchAttempts } from './query-variants';
import type {
  RawSearchResult,
  SearchProvider,
  SearchRegion,
  SearchScope
} from './types';

// 鲁港通 - 输入（业务层可带 .refine 兜底；SDK 层的 inputSchema 必须是纯 z.object，不能带 .refine）
export const InputType = z.object({
  query: z.string().min(1, '搜索词不能为空'),
  searchScope: z.enum(['official', 'open']).default('official'),
  // 鲁港通 - 检索地域档：由工作流节点固定配置，不作为模型可改参数（避免山东题搜香港来源）
  searchRegion: z.enum(['hk', 'cn']).default('hk'),
  maxResults: z.number().int().min(1).max(10).default(5),
  language: z.enum(['zh-CN', 'zh-HK', 'en']).default('zh-CN')
});

// 鲁港通 - 单条结果 schema（根 index.ts 会引用它组装输出 schema）
export const SearchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string(), // 主机名
  sourceType: z.enum([
    'gov',
    'public',
    'academic',
    'nonprofit',
    'finance',
    'medical',
    'news',
    'tv',
    'other'
  ]),
  snippet: z.string(),
  publishedDate: z.string().optional()
});

export const OutputType = z.object({
  results: z.array(SearchResultSchema),
  // 鲁港通 - 来源网址清单：聊天底部来源卡片据此展示可点击的网页链接（标题+网址）
  citeLinks: z.array(
    z.object({
      name: z.string(),
      url: z.string()
    })
  ),
  resultCount: z.number(),
  filteredOut: z.number(),
  query: z.string(),
  searchScope: z.enum(['official', 'open']),
  metadata: z.object({
    timestamp: z.string(),
    engine: z.string(),
    rawCount: z.number(),
    // 鲁港通 - 逐次检索命中（诊断用）：看清是「没搜到」还是「被白名单拒掉」
    attempts: z.array(z.string()).optional(),
    // 鲁港通 - 被拒域名计数（诊断用）：便于判断缺哪些官方来源
    rejectedHosts: z.array(z.string()).optional()
  }),
  error: z.string().optional(),
  _debug: z.array(z.string()).optional()
});

// 鲁港通 - 插件密钥（根层 secretSchema 注入；未配置时百炼字段为空，行为与旧版一致）
export interface ToolSecrets {
  dashscopeApiKey?: string;
}

// 鲁港通 - 搜索源链：配了百炼密钥则只走百炼——必应通道已被反爬封死（实测 b_algo=0），
// 留在链上只会让失败路径多等 3 次重试；未配置密钥时维持必应，行为与旧版一致
export function buildProviderChain(secrets?: ToolSecrets): SearchProvider[] {
  const key = secrets?.dashscopeApiKey?.trim();
  if (key) return [new BailianProvider(key)];
  return [new BingProvider()];
}

// 鲁港通 - 香港档增强补发：主题定向（前缀式 site: + 繁体官方用词）。
// 2026-10-13 十六组对照实测结论：后缀式「{查询词} site:域名」与简体长查询在百炼下零命中；
// 前缀式 + 繁体官方词稳定命中（hkstp 4-5 条 / cyberport 2 条 / bud.hkpc.org 3 条）；
// 未命中主题不补发（site:gov.hk、hkpc 主域、hsitp.org 定向均实测无效，不再使用）
const HK_BOOST_TOPICS: Array<{ keywords: string[]; queries: string[] }> = [
  // BUD 专项基金：hkpc 主域 site: 无效，子域 bud.hkpc.org 有效
  { keywords: ['bud', '专项基金', '專項基金'], queries: ['site:bud.hkpc.org BUD 專項基金'] },
  // 河套/港深创科园：创科工业局 itib.gov.hk 官方页有效；hsitp.org 收录差不启用
  {
    keywords: ['河套', '港深创新', '港深創新', '深港创新', '深港創新'],
    queries: ['site:itib.gov.hk 河套 創科']
  },
  // 科技券 TVP：tvp 子域有效（itf 主域 site: 无效）
  { keywords: ['科技券', 'tvp'], queries: ['site:tvp.itf.gov.hk 科技券'] },
  // 科创/创业培育：hkstp 与 cyberport 双域稳定命中
  {
    keywords: [
      '创新',
      '創新',
      '科创',
      '科創',
      '创科',
      '創科',
      '创业',
      '創業',
      '初创',
      '初創',
      '培育',
      '孵化',
      '数码港',
      '數碼港',
      '科技园',
      '科技園'
    ],
    queries: ['site:hkstp.org 創科培育計劃 資助', 'site:cyberport.hk 培育計劃 資助']
  }
];

// 鲁港通 - 金融语境常见误匹配先剔除：避免「港股创新高」「创业板」「科创50」触发培育补发
const HK_BOOST_NEGATIVE_PATTERNS = [
  /创新高|创新低|創新高|創新低/g,
  /创业板|創業板/g,
  /科创50|科創50/g
];

// 鲁港通 - 每次补发查询数封顶，控制耗时与成本
export const HK_BOOST_MAX_QUERIES = 3;

export function buildHkBoostQueries(query: string): string[] {
  let normalized = query.toLowerCase();
  for (const pattern of HK_BOOST_NEGATIVE_PATTERNS) {
    normalized = normalized.replace(pattern, '');
  }
  const out: string[] = [];
  for (const topic of HK_BOOST_TOPICS) {
    if (!topic.keywords.some((keyword) => normalized.includes(keyword))) continue;
    for (const boostQuery of topic.queries) {
      if (!out.includes(boostQuery)) out.push(boostQuery);
      if (out.length >= HK_BOOST_MAX_QUERIES) return out;
    }
  }
  return out;
}

export async function tool(
  input: z.infer<typeof InputType>,
  secrets?: ToolSecrets
): Promise<z.infer<typeof OutputType>> {
  const debug: string[] = [];
  const scope: SearchScope = input.searchScope;
  const region: SearchRegion = input.searchRegion;
  debug.push(
    `收到参数: query="${input.query}", scope=${scope}, region=${region}, max=${input.maxResults}`
  );

  const chain = buildProviderChain(secrets);
  debug.push(`搜索源链: ${chain.map((p) => p.name).join(' > ')}`);

  try {
    // 1-3. 检索尝试序列：原查询优先；香港官方档在全被拒/空手时追加繁体变体
    let raw: RawSearchResult[] = [];
    let active: SearchProvider | null = null;
    let anyResponded = false;
    let sawError = false;
    const attempts = buildSearchAttempts(input.query, region, scope);
    const attemptStats: string[] = [];
    debug.push(`检索尝试序列: ${attempts.join(' | ')}`);

    // 鲁港通 - 单个查询词走搜索源链：首个有结果的源胜出；异常或空结果自动降级下一个
    const searchChain = async (
      query: string
    ): Promise<{
      results: RawSearchResult[];
      provider: SearchProvider | null;
    }> => {
      for (const provider of chain) {
        try {
          const results = await provider.search(query, {
            // 鲁港通 - 多取一些原始结果，白名单过滤后才够数
            maxResults: input.maxResults * (provider.supportsSiteBoost ? 2 : 3),
            lang: input.language
          });
          anyResponded = true;
          debug.push(
            `[${provider.name}] "${query}" 返回 ${results.length} 条原始结果`
          );
          if (results.length > 0) return { results, provider };
        } catch (err) {
          sawError = true;
          const msg = err instanceof Error ? err.message : String(err);
          debug.push(`[${provider.name}] 异常: ${msg}`);
        }
      }
      return { results: [], provider: null };
    };

    // 4. 域名过滤（核心）：official 默认拒绝，open 完全不过滤
    let { allowed, rejected } = filterResults(raw, scope, region);

    for (const attemptQuery of attempts) {
      if (allowed.length >= input.maxResults) break;
      const { results, provider } = await searchChain(attemptQuery);
      if (provider) active = provider;
      if (results.length > 0) raw = dedupeByUrl([...raw, ...results]);
      ({ allowed, rejected } = filterResults(raw, scope, region));
      attemptStats.push(
        `${attemptQuery} => raw=${results.length}, allowed=${allowed.length}`
      );
      debug.push(`过滤后保留 ${allowed.length} 条，拒绝 ${rejected.length} 条`);
    }

    // 5. 增强补发：official 且权威结果不足时，按地域补搜官方站点，合并去重后重新过滤
    // 鲁港通 - 香港档改主题定向补发（前缀式繁体官方词，见 HK_BOOST_TOPICS）；
    // cn 档维持 site:shandong.gov.cn 后缀式（对该域实测有效）
    const boostQueries =
      region === 'cn'
        ? [`${input.query} site:shandong.gov.cn`]
        : buildHkBoostQueries(input.query);
    // 鲁港通 - booster 兜底：主源空手时 active 为空，仍取链上支持补发的源（能救回偶发 0 条）
    const booster = active ?? chain.find((p) => p.supportsSiteBoost);
    if (booster && scope === 'official' && allowed.length < input.maxResults) {
      for (const boostQuery of boostQueries) {
        if (allowed.length >= input.maxResults) break;
        try {
          const boosted = await booster.search(boostQuery, {
            maxResults: input.maxResults,
            lang: input.language
          });
          debug.push(
            `[${booster.name}] 增强补发(${boostQuery}) ${boosted.length} 条`
          );
          if (boosted.length > 0) {
            raw = dedupeByUrl([...raw, ...boosted]);
            ({ allowed, rejected } = filterResults(raw, scope, region));
            debug.push(
              `合并去重后 ${raw.length} 条，过滤后保留 ${allowed.length} 条，拒绝 ${rejected.length} 条`
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          debug.push(`[${booster.name}] 增强补发失败: ${msg}`);
        }
      }
    }

    const results = allowed.slice(0, input.maxResults).map((r) => ({
      title: r.title,
      url: r.url,
      source: r.source,
      sourceType: r.sourceType,
      snippet: r.snippet
    }));

    const engine = (active ?? chain[chain.length - 1])?.name ?? 'bing';
    const metadata = {
      timestamp: new Date().toISOString(),
      engine,
      rawCount: raw.length,
      attempts: attemptStats,
      rejectedHosts: topRejectedHosts(rejected)
    };

    if (results.length === 0) {
      // 鲁港通 - 无权威来源：给可操作中文错误，明确让模型据已有资料作答、不要重复调用
      return {
        results: [],
        citeLinks: [],
        resultCount: 0,
        filteredOut: rejected.length,
        query: input.query,
        searchScope: scope,
        metadata,
        error:
          !anyResponded && sawError
            ? buildErrorMessage(input.language)
            : buildEmptyMessage(input.query, input.language),
        _debug: debug
      };
    }

    return {
      results,
      citeLinks: results.map((r) => ({
        name: r.title || r.source,
        url: r.url
      })),
      resultCount: results.length,
      filteredOut: rejected.length,
      query: input.query,
      searchScope: scope,
      metadata,
      _debug: debug
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debug.push(`搜索异常: ${msg}`);
    return {
      results: [],
      citeLinks: [],
      resultCount: 0,
      filteredOut: 0,
      query: input.query,
      searchScope: scope,
      metadata: {
        timestamp: new Date().toISOString(),
        engine: chain[chain.length - 1]?.name ?? 'bing',
        rawCount: 0
      },
      error: buildErrorMessage(input.language),
      _debug: debug
    };
  }
}

// 鲁港通 - 被拒域名 Top5（诊断）：形如 "klook.com×3"，用来判断缺哪些官方来源
function topRejectedHosts(rejected: { url: string }[]): string[] {
  const counts = new Map<string, number>();
  for (const r of rejected) {
    const host = normalizeHost(r.url);
    if (!host) continue;
    counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([host, n]) => `${host}×${n}`);
}

function buildEmptyMessage(query: string, lang: string): string {
  if (lang === 'en')
    return `No official-source result found for "${query}". Answer from existing authoritative material and note that the latest official information could not be verified.`;
  if (lang === 'zh-HK')
    return `暫未從官方來源檢索到與「${query}」相關的內容，請依據既有權威資料作答並註明「未能核實最新官方信息」。`;
  return `暂未从官方来源检索到与“${query}”相关的内容，请依据已有权威资料作答并注明“未能核实最新官方信息”。`;
}

function buildErrorMessage(lang: string): string {
  if (lang === 'en')
    return 'Web search temporarily unavailable. Please answer from existing authoritative material.';
  if (lang === 'zh-HK')
    return '聯網搜索暫時不可用，請依據既有權威資料作答。';
  return '联网搜索暂时不可用，请依据已有权威资料作答。';
}
