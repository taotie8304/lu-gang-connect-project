// 鲁港通 - 引用分组工具函数
// 将知识库引用和联网搜索引用合并为统一列表，知识库在前，联网搜索在后

export type CitationGroupItem = {
  type: 'dataset' | 'web' | 'link';
  key: string;
  displayText: string;
};

/**
 * 合并知识库引用和联网搜索引用，保证分组顺序：
 * 1. 知识库引用（dataset）
 * 2. 联网搜索引用（web）
 * 3. 工具链接（link）
 *
 * 总数 = datasetItems.length + webItems.length + linkItems.length
 */
export function groupCitations(
  datasetItems: CitationGroupItem[],
  webItems: CitationGroupItem[],
  linkItems: CitationGroupItem[]
): CitationGroupItem[] {
  return [...datasetItems, ...webItems, ...linkItems];
}

/**
 * 验证分组后的列表是否满足排序约束：
 * - 所有 dataset 类型在 web 类型之前
 * - 所有 web 类型在 link 类型之前
 */
export function isGroupOrderValid(items: CitationGroupItem[]): boolean {
  let lastTypeOrder = 0;
  const typeOrder: Record<string, number> = { dataset: 1, web: 2, link: 3 };

  for (const item of items) {
    const order = typeOrder[item.type] ?? 0;
    if (order < lastTypeOrder) return false;
    lastTypeOrder = order;
  }
  return true;
}
