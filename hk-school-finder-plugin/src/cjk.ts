// 鲁港通 - 简繁归一化：香港繁体 → 简体（搜索匹配统一转简体后比较）
// 依赖 opencc-js/t2cn 子入口（106KB 压缩词典；主入口 full 1.17MB 不采用）
import * as OpenCC from 'opencc-js/t2cn';

const hkToCn = OpenCC.Converter({ from: 'hk', to: 'cn' });

/**
 * 将香港繁体文本归一化为简体（仅用于搜索/匹配，不用于展示）。
 * - 英文/数字/符号原样保留
 * - 简体输入或空字符串安全返回
 */
export function normalizeCjk(text: string): string {
  if (!text) return '';
  return hkToCn(text);
}
