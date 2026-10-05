// 鲁港通 - 记录按校名匹配（简繁归一：精确优先 → 双向包含）

/** 名字匹配所需最小字段 */
export interface NamedRecord {
  name: string;
  nameSimp: string;
}

/**
 * 按校名匹配（query 需已归一化为简体）。
 * 精确优先 → 双向包含（兼容 SCH_LOC 的班次后缀，如「聖士提反堂小學暨幼稚園(下午)」匹配概览的「聖士提反堂小學暨幼稚園」）。
 */
export function matchByName<T extends NamedRecord>(list: T[] | undefined, query: string): T | undefined {
  if (!list || !query) return undefined;
  for (const item of list) {
    if (item.nameSimp && item.nameSimp === query) return item;
  }
  for (const item of list) {
    if (!item.nameSimp) continue;
    if (item.nameSimp.includes(query) || query.includes(item.nameSimp)) return item;
  }
  return undefined;
}

/**
 * 全部匹配（query 需已归一化为简体）：精确优先；无精确命中时返回全部包含匹配（可多分校/多班级行）。
 */
export function matchAllByName<T extends NamedRecord>(list: T[] | undefined, query: string): T[] {
  if (!list || !query) return [];
  const exact = list.filter((item) => item.nameSimp && item.nameSimp === query);
  if (exact.length > 0) return exact;
  return list.filter((item) => item.nameSimp && (item.nameSimp.includes(query) || query.includes(item.nameSimp)));
}
