// 鲁港通 - DMS 坐标转换：「度-分-秒」→ 十进制度（SCH_LOC 数据格式）
// 实测格式：`114-10-52`（度-分-秒）、`22-19-8`（个位数秒）

/**
 * 解析「度-分-秒」坐标文本为十进制度。
 * - 支持两段（度-分）与三段（度-分-秒）变体
 * - 无效输入（空/段数不符/含非数字/分秒越界）返回 undefined
 */
export function parseDms(value: string): number | undefined {
  if (!value) return undefined;
  const parts = value.trim().split('-');
  if (parts.length < 2 || parts.length > 3) return undefined;
  if (!parts.every((p) => /^\d+(\.\d+)?$/.test(p))) return undefined;
  const [d, m, s = 0] = parts.map(Number);
  if (m >= 60 || s >= 60) return undefined;
  return d + m / 60 + s / 3600;
}
