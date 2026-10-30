// 鲁港通 - 查询变体：把简体查询转成香港繁体再检索。
// 2026-10-30 线上简繁对照实测：简体查询在百炼下大量命中内地/营销页面（白名单全被拒），
// 同义繁体查询能命中港府官网与港媒；因此官方档首次检索全被拒或零结果时，追加繁体变体重试。
import OpenCC from 'opencc-js/cn2t';
import type { SearchRegion, SearchScope } from './types';

const converter = OpenCC.Converter({ from: 'cn', to: 'hk' });

// 鲁港通 - 简转繁（香港用字）；转换器异常时退回原文，绝不让查询变体拖垮检索
export function toTraditionalHk(text: string): string {
  try {
    return converter(text);
  } catch {
    return text;
  }
}

// 鲁港通 - 长查询只保留前 6 个词：词太多时引擎会放宽匹配，混入大量无关页面
const MAX_TERMS = 6;
const LONG_QUERY_TOKENS = 6;

export function shortenQuery(text: string): string {
  const terms = text.trim().split(/\s+/).filter(Boolean);
  if (terms.length <= LONG_QUERY_TOKENS) return text.trim();
  return terms.slice(0, MAX_TERMS).join(' ');
}

// 鲁港通 - 检索尝试序列：首个即原查询（保证既有命中不受影响）；
// 香港官方档追加繁体变体与截断变体，大陆档不加（大陆官网本身用简体，转繁会降低命中）
export function buildSearchAttempts(
  query: string,
  region: SearchRegion,
  scope: SearchScope
): string[] {
  const base = query.trim();
  const attempts = [base];
  if (region !== 'hk' || scope !== 'official') return attempts;

  const traditional = toTraditionalHk(base).trim();
  if (traditional && traditional !== base) attempts.push(traditional);

  const shortened = shortenQuery(traditional || base);
  if (shortened && !attempts.includes(shortened)) attempts.push(shortened);

  return attempts;
}
