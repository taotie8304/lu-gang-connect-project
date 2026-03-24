import * as OpenCC from 'opencc-js';

// 鲁港通 - 简体 → 繁体转换器（启动时初始化，常驻内存）
const s2tConverter = OpenCC.Converter({ from: 'cn', to: 'tw' });
// 鲁港通 - 繁体 → 简体转换器
const t2sConverter = OpenCC.Converter({ from: 'tw', to: 'cn' });

/**
 * 鲁港通 - 简体中文转繁体中文
 */
export function simplifiedToTraditional(text: string): string {
  if (!text) return text;
  return s2tConverter(text);
}

/**
 * 鲁港通 - 繁体中文转简体中文
 */
export function traditionalToSimplified(text: string): string {
  if (!text) return text;
  return t2sConverter(text);
}

/**
 * 鲁港通 - 检测文本是否包含中文字符
 */
export function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

/**
 * 鲁港通 - 对对象中所有字符串值执行简繁转换
 * 递归处理嵌套对象和数组
 */
export function convertParamsS2T(params: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && containsChinese(value)) {
      result[key] = simplifiedToTraditional(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string' && containsChinese(item)
          ? simplifiedToTraditional(item)
          : typeof item === 'object' && item !== null
            ? convertParamsS2T(item)
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = convertParamsS2T(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
