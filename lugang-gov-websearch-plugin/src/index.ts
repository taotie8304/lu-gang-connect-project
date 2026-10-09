// 鲁港通 - 政府官网联网搜索插件 业务层入口
// 导出 InputType / OutputType / tool / SearchResultSchema 供根目录 index.ts 使用
import { z } from 'zod';
import { BailianProvider } from './bailian-provider';
import { BingProvider, dedupeByUrl } from './search-provider';
import { filterResults } from './domain-filter';
import type { RawSearchResult, SearchProvider, SearchScope } from './types';

// 鲁港通 - 输入（业务层可带 .refine 兜底；SDK 层的 inputSchema 必须是纯 z.object，不能带 .refine）
export const InputType = z.object({
  query: z.string().min(1, '搜索词不能为空'),
  searchScope: z.enum(['official', 'open']).default('official'),
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
    'news',
    'tv',
    'other'
  ]),
  snippet: z.string(),
  publishedDate: z.string().optional()
});

export const OutputType = z.object({
  results: z.array(SearchResultSchema),
  resultCount: z.number(),
  filteredOut: z.number(),
  query: z.string(),
  searchScope: z.enum(['official', 'open']),
  metadata: z.object({
    timestamp: z.string(),
    engine: z.string(),
    rawCount: z.number()
  }),
  error: z.string().optional(),
  _debug: z.array(z.string()).optional()
});

// 鲁港通 - 插件密钥（根层 secretSchema 注入；未配置时百炼字段为空，行为与旧版一致）
export interface ToolSecrets {
  dashscopeApiKey?: string;
}

// 鲁港通 - 搜索源链：配了百炼密钥则百炼优先、必应兜底；否则只用必应（与现状一致）
export function buildProviderChain(secrets?: ToolSecrets): SearchProvider[] {
  const key = secrets?.dashscopeApiKey?.trim();
  if (key) return [new BailianProvider(key), new BingProvider()];
  return [new BingProvider()];
}

export async function tool(
  input: z.infer<typeof InputType>,
  secrets?: ToolSecrets
): Promise<z.infer<typeof OutputType>> {
  const debug: string[] = [];
  const scope: SearchScope = input.searchScope;
  debug.push(
    `收到参数: query="${input.query}", scope=${scope}, max=${input.maxResults}`
  );

  const chain = buildProviderChain(secrets);
  debug.push(`搜索源链: ${chain.map((p) => p.name).join(' > ')}`);

  try {
    // 1-3. 依次尝试各搜索源：首个有结果的源胜出；异常或空结果自动降级下一个
    let raw: RawSearchResult[] = [];
    let active: SearchProvider | null = null;
    let anyResponded = false;
    let sawError = false;
    for (const provider of chain) {
      try {
        const results = await provider.search(input.query, {
          // 鲁港通 - 多取一些原始结果，白名单过滤后才够数
          maxResults: input.maxResults * (provider.supportsSiteBoost ? 2 : 3),
          lang: input.language
        });
        anyResponded = true;
        debug.push(`[${provider.name}] 返回 ${results.length} 条原始结果`);
        if (results.length > 0) {
          raw = results;
          active = provider;
          break;
        }
      } catch (err) {
        sawError = true;
        const msg = err instanceof Error ? err.message : String(err);
        debug.push(`[${provider.name}] 异常: ${msg}`);
      }
    }

    // 4. 域名过滤（核心）：official 默认拒绝，open 完全不过滤
    let { allowed, rejected } = filterResults(raw, scope);
    debug.push(`过滤后保留 ${allowed.length} 条，拒绝 ${rejected.length} 条`);

    // 5. 增强补发：official 且权威结果不足时，用 site:gov.hk 再搜一轮，合并去重后重新过滤
    if (
      active?.supportsSiteBoost &&
      scope === 'official' &&
      allowed.length < input.maxResults
    ) {
      try {
        const boosted = await active.search(`site:gov.hk ${input.query}`, {
          maxResults: input.maxResults,
          lang: input.language
        });
        debug.push(`[${active.name}] site:gov.hk 增强补发 ${boosted.length} 条`);
        if (boosted.length > 0) {
          raw = dedupeByUrl([...raw, ...boosted]);
          ({ allowed, rejected } = filterResults(raw, scope));
          debug.push(
            `合并去重后 ${raw.length} 条，过滤后保留 ${allowed.length} 条，拒绝 ${rejected.length} 条`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debug.push(`[${active.name}] 增强补发失败: ${msg}`);
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
      rawCount: raw.length
    };

    if (results.length === 0) {
      // 鲁港通 - 无权威来源：给可操作中文错误，明确让模型据知识库作答、不要重复调用
      return {
        results: [],
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

function buildEmptyMessage(query: string, lang: string): string {
  if (lang === 'en')
    return `No official-source result found for "${query}". Answer from the knowledge base and note that the latest official information could not be verified.`;
  if (lang === 'zh-HK')
    return `暫未從政府及權威官網檢索到與「${query}」相關的內容，請依據知識庫作答並註明「未能核實最新官方信息」。`;
  return `暂未从政府及权威官网检索到与“${query}”相关的内容，请依据知识库作答并注明“未能核实最新官方信息”。`;
}

function buildErrorMessage(lang: string): string {
  if (lang === 'en')
    return 'Web search temporarily unavailable. Please answer from the knowledge base.';
  if (lang === 'zh-HK')
    return '聯網搜索暫時不可用，請依據知識庫作答。';
  return '联网搜索暂时不可用，请依据知识库作答。';
}
