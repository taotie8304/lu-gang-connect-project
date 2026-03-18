// 鲁港通 - 解析阿里百炼 search_info.search_results 为 WebSearchCitation[]
import type { WebSearchCitation } from '@fastgpt/global/core/chat/type.d';
import { addLog } from '../../../common/system/log';

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
 * 鲁港通 - 兼容阿里百炼多种响应格式：
 * - 顶层 response.search_info（非流式）
 * - response.choices[0].delta.search_info（流式 chunk）
 * - response.choices[0].message.search_info（非流式 choice）
 */
export function extractSearchCitations(response: any): WebSearchCitation[] {
  // 鲁港通 - 调试日志：记录响应中是否包含 search_info
  const hasSearchInfo = !!(
    response?.search_info ||
    response?.choices?.[0]?.delta?.search_info ||
    response?.choices?.[0]?.message?.search_info
  );
  if (hasSearchInfo) {
    addLog.info('鲁港通联网搜索引用提取成功', {
      topLevel: !!response?.search_info,
      delta: !!response?.choices?.[0]?.delta?.search_info,
      message: !!response?.choices?.[0]?.message?.search_info
    });
  }

  // 鲁港通 - 优先从顶层提取（非流式响应常见位置）
  const topLevelSearchInfo: AliSearchInfo | undefined = response?.search_info;
  if (topLevelSearchInfo?.search_results) {
    return parseSearchResults(topLevelSearchInfo.search_results);
  }

  // 鲁港通 - 从 choices[0].delta 提取（流式 chunk 常见位置）
  const deltaSearchInfo: AliSearchInfo | undefined = response?.choices?.[0]?.delta?.search_info;
  if (deltaSearchInfo?.search_results) {
    return parseSearchResults(deltaSearchInfo.search_results);
  }

  // 鲁港通 - 从 choices[0].message 提取（非流式 choice 常见位置）
  const messageSearchInfo: AliSearchInfo | undefined =
    response?.choices?.[0]?.message?.search_info;
  if (messageSearchInfo?.search_results) {
    return parseSearchResults(messageSearchInfo.search_results);
  }

  return [];
}
