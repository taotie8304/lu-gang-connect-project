// 鲁港通 - 通用 CSV 解析器：引号/引号内换行/引号转义/多分隔符
// 真实用例：KG_SCHEME 跨行表头（引号内嵌换行）、SCH_LOC 引号地址、KGP ^ 分隔

export interface ParseCsvOptions {
  /** 字段分隔符，默认 ','；实测数据还使用 '\t'（SCH_LOC/幼教计划）与 '^'（KGP） */
  delimiter?: string;
}

/**
 * 将 CSV 文本解析为二维字符串数组。
 * - 支持引号字段（`"` 包裹）、引号内换行、`""` 转义
 * - 支持 \n / \r\n / \r 行尾；跳过纯空行
 */
export function parseCsv(text: string, options: ParseCsvOptions = {}): string[][] {
  const delimiter = options.delimiter ?? ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  // 最后一行（无行尾符时）
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // 过滤纯空行
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/**
 * 解析为对象数组：首行作表头（自动 trim），空表头列忽略。
 * 数据行字段数少于表头时，缺失字段不出现在对象中。
 */
export function parseCsvToObjects(
  text: string,
  options: ParseCsvOptions = {}
): Record<string, string>[] {
  const rows = parseCsv(text, options);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const objects: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j];
      if (key === '') continue;
      const val = rows[i][j];
      if (val !== undefined) obj[key] = val;
    }
    objects.push(obj);
  }
  return objects;
}
