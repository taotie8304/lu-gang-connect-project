/**
 * 鲁港通 - 联网搜索引用解析器
 * 1. 优先从阿里百炼 search_info 字段提取（非流式或未来流式支持时）
 * 2. Fallback：从模型回答文本中提取 markdown 链接作为联网搜索引用
 */
import type { WebSearchCitation } from '@fastgpt/global/core/chat/type.d';

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
 * 兼容阿里百炼多种响应格式
 */
export function extractSearchCitations(response: any): WebSearchCitation[] {
  // 优先从顶层提取（非流式响应常见位置）
  const topLevelSearchInfo: AliSearchInfo | undefined = response?.search_info;
  if (topLevelSearchInfo?.search_results) {
    return parseSearchResults(topLevelSearchInfo.search_results);
  }

  // 从 choices[0].delta 提取（流式 chunk 常见位置）
  const deltaSearchInfo: AliSearchInfo | undefined = response?.choices?.[0]?.delta?.search_info;
  if (deltaSearchInfo?.search_results) {
    return parseSearchResults(deltaSearchInfo.search_results);
  }

  // 从 choices[0].message 提取（非流式 choice 常见位置）
  const messageSearchInfo: AliSearchInfo | undefined =
    response?.choices?.[0]?.message?.search_info;
  if (messageSearchInfo?.search_results) {
    return parseSearchResults(messageSearchInfo.search_results);
  }

  return [];
}

/**
 * 鲁港通 - 从回答文本中提取裸数字引用序号 [1], [2], [3]
 * 返回引用序号数组（去重、升序排列）
 */
export function extractBareNumberReferences(text: string): number[] {
  if (!text) return [];

  const refs = new Set<number>();
  // 鲁港通 - 匹配 [N] 格式的裸数字引用，排除 markdown 链接 [N](...)
  const regex = /\[(\d+)\](?!\()/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    refs.add(parseInt(match[1], 10));
  }

  return Array.from(refs).sort((a, b) => a - b);
}

/**
 * 鲁港通 - 从模型回答文本中提取联网搜索引用（Fallback 方案）
 * 当 DashScope OpenAI 兼容模式流式不返回 search_info 时，
 * 从回答文本中解析 markdown 链接 [title](url) 作为联网搜索引用。
 *
 * 过滤规则：
 * - 只提取 http/https 开头的外部链接
 * - 排除图片链接 ![alt](url)
 * - 排除知识库引用 [hexId](CITE)
 * - 按 URL 去重
 */
export function extractCitationsFromAnswerText(answerText: string): WebSearchCitation[] {
  if (!answerText) return [];

  const citations: WebSearchCitation[] = [];
  const seenUrls = new Set<string>();

  // 匹配 markdown 链接 [title](url)，排除图片 ![alt](url)
  // 使用 negative lookbehind 排除 ! 前缀
  const linkRegex = /(?<!!)\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(answerText)) !== null) {
    const title = match[1];
    const url = match[2];

    // 排除知识库引用格式 [hexId](CITE)
    if (/^[a-f0-9]{24}$/i.test(title) || url === 'CITE') continue;

    // URL 去重
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    citations.push({
      index: citations.length,
      title: title.trim(),
      url: url.trim()
    });
  }

  return citations;
}


/**
 * 鲁港通 - 清理回答文本中的孤立引用序号
 * - 有对应 citation 的 [N] 保留
 * - 无对应 citation 的 [N] 移除
 * - 非引用格式的文本内容不变
 */
export function cleanOrphanCitations(
  text: string,
  citations: WebSearchCitation[]
): string {
  if (!text) return text;

  const validIndices = new Set(citations.map((c) => c.index));

  // 鲁港通 - 替换 [N] 格式的裸数字引用（排除 markdown 链接 [N](...)）
  return text.replace(/\[(\d+)\](?!\()/g, (match, numStr) => {
    const num = parseInt(numStr, 10);
    return validIndices.has(num) ? match : '';
  });
}
