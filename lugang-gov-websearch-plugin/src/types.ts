// 鲁港通 - 内部类型定义
export type SourceType =
  | 'gov'
  | 'public'
  | 'academic'
  | 'nonprofit'
  | 'finance'
  | 'medical'
  | 'news'
  | 'tv'
  | 'other';

// 鲁港通 - 搜索范围：official=严格白名单+黑名单；open=完全不过滤（仅香港本地生活小助手节点）
export type SearchScope = 'official' | 'open';

export interface RawSearchResult {
  title: string;
  url: string; // 鲁港通 - 已解码的真实 URL（非 DuckDuckGo 跳转包裹链接）
  snippet: string;
}

export interface FilteredResult extends RawSearchResult {
  source: string; // 鲁港通 - 规范化主机名（去 www、转小写）
  sourceType: SourceType;
}

// 鲁港通 - 搜索源名称：用于输出元数据 engine 字段与测试断言
export type SearchProviderName = 'bailian' | 'bing' | 'ddg';

// 鲁港通 - 搜索源抽象接口，可插拔：日后新增 Brave/SearXNG 只需实现该接口
export interface SearchProvider {
  readonly name: SearchProviderName;
  // 鲁港通 - 是否支持 site: 操作符增强补发（百炼支持；必应抓取页不稳定，不启用）
  readonly supportsSiteBoost: boolean;
  search(
    query: string,
    opts?: { maxResults?: number; lang?: string }
  ): Promise<RawSearchResult[]>;
}
