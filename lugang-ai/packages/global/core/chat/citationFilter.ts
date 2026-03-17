// 鲁港通 - 知识库引用相关性过滤工具函数

/**
 * 根据相关性分数过滤知识库引用
 * - 管理员（isRoot）不受过滤影响，返回全部引用
 * - 普通用户只返回最高分数 >= 阈值的引用
 * - score 为空或缺失时视为 0 分，会被过滤
 */
export function filterCitationsByRelevance<
  T extends { score: { value?: number }[] }
>(items: T[], options: { isRoot: boolean; threshold: number }): T[] {
  const { isRoot, threshold } = options;

  if (isRoot) {
    return items;
  }

  return items.filter((item) => {
    if (!item.score || item.score.length === 0) return false;
    const maxScore = Math.max(...item.score.map((s) => s.value ?? 0));
    return maxScore >= threshold;
  });
}
