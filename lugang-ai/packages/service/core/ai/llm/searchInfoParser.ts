// 鲁港通 - 解析阿里百炼 search_info.search_results 为 WebSearchCitation[]
import type { WebSearchCitation } from '@fastgpt/global/core/chat/type.d';

/**
 * 阿里百炼 search_info 响应结构
 * 兼容模式下，search_info 可能出现在：
 * - 非流式响应的顶层 JSON
 * - 流式响应的某个 chunk 中
 */
export type AliSearchResult = {
  index?: number;
  title?: string;
  url?: string;
  icon?: string;
  site_name?: string;
};

export type AliSearchInfo = {
  search_results?: AliSearchResult[];
};

/**
 * 将阿里百炼 search_results 转换为 WebSearchCitation[]
 * - 跳过缺少 url 的条目
 * - 保留 title、icon、siteName 等元数据
 */
export function parseSearchResults(searchResults: AliSearchResult[]): WebSearchCitation[] {
  if (!Array.isArray(searchResults)) return [];

  return searchResults
    .filter((item) => !!item?.url)
    .map((item, idx) => ({
      index: item.index ?? idx,
      title: item.title || item.url!,
      url: item.url!,
      icon: item.icon || undefined,
      siteName: item.site_name || undefined
    }));
}

/**
 * 从 LLM 响应对象中提取 search_info 并解析
 * 适用于非流式响应和流式 chunk
 */
export function extractSearchCitations(response: any): WebSearchCitation[] {
  const searchInfo: AliSearchInfo | undefined = response?.search_info;
  if (!searchInfo?.search_results) return [];
  return parseSearchResults(searchInfo.search_results);
}
