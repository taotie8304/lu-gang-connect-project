export enum CodeClassNameEnum {
  guide = 'guide',
  questionguide = 'questionguide',
  mermaid = 'mermaid',
  echarts = 'echarts',
  quote = 'quote',
  files = 'files',
  latex = 'latex',
  iframe = 'iframe',
  html = 'html',
  svg = 'svg',
  video = 'video',
  audio = 'audio'
}

export const mdTextFormat = (text: string) => {
  // 处理 Windows 文件路径中的反斜杠，防止被 Markdown 转义：C:\path\file 或 c:\path\file
  text = text.replace(/([A-Za-z]:\\[^\s`\[\]()]*)/g, (match) => {
    return match.replace(/\\/g, '\\\\');
  });

  // NextChat function - Format latex to $$
  const pattern = /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g;
  text = text.replace(pattern, (match, codeBlock, squareBracket, roundBracket) => {
    if (codeBlock) {
      return codeBlock;
    } else if (squareBracket) {
      return `$$${squareBracket}$$`;
    } else if (roundBracket) {
      return `$${roundBracket}$`;
    }
    return match;
  });

  // 处理 [quote:id] 格式引用，将 [quote:675934a198f46329dfc6d05a] 转换为 [675934a198f46329dfc6d05a](CITE)
  text = text
    // 处理 格式引用，将 [675934a198f46329dfc6d05a] 转换为 [675934a198f46329dfc6d05a](CITE)
    .replace(/\[([a-f0-9]{24})\](?!\()/g, '[$1](CITE)');
  // 将 "http://localhost:3000[675934a198f46329dfc6d05a](CITE)" -> "http://localhost:3000 [675934a198f46329dfc6d05a](CITE)"
  text = text.replace(
    /(https?:\/\/[^\s，。！？；：、\[\]]+?)(?=\[([a-f0-9]{24})\]\(CITE\))/g,
    '$1 '
  );

  // 处理链接后的中文标点符号，增加空格
  text = text.replace(/(https?:\/\/[^\s，。！？；：、]+)([，。！？；：、])/g, '$1 $2');

  return text;
};

/**
 * 鲁港通 - 移除文本中的引用标记
 * 移除 [1], [2] 等引用标记，确保移除后文本仍然连贯
 * Requirements: 5.5, 5.6
 * 
 * @param text - 包含引用标记的文本
 * @returns 移除引用标记后的文本
 */
export const removeCitationMarks = (text: string): string => {
  if (!text) return text;

  // 移除 [数字] 格式的引用标记
  // 例如：[1], [2], [10] 等
  let result = text.replace(/\[\d+\]/g, '');

  // 处理移除后的多余空格（但保留换行符）
  // 将多个连续空格（非换行符）替换为单个空格
  result = result.replace(/[^\S\n]+/g, ' ');

  // 移除行首和行尾的空格（但保留换行符）
  result = result.replace(/^[ \t]+|[ \t]+$/gm, '');

  // 处理标点符号前的多余空格
  // 例如："文本 。" -> "文本。"
  result = result.replace(/\s+([，。！？；：、])/g, '$1');

  return result;
};

/**
 * 鲁港通 - 预处理 Markdown 表格，移除表格单元格中的 <br> 标签
 * 使用 CSS 控制换行而非 HTML 标签，确保表格正确渲染
 * Requirements: 4.2, 4.3
 * 
 * @param text - 包含 Markdown 表格的文本
 * @returns 处理后的文本
 */
export const preprocessTableMarkdown = (text: string): string => {
  if (!text) return text;

  // 检测是否包含 Markdown 表格（包含 | 和 --- 分隔符）
  const hasTable = /\|.*\|/.test(text) && /\|[\s-:]+\|/.test(text);
  
  if (!hasTable) {
    return text;
  }

  // 移除表格单元格中的 <br> 标签（包括 <br/> 和 <br />）
  // 只在表格行中进行替换（包含 | 的行）
  const lines = text.split('\n');
  const processedLines = lines.map(line => {
    // 如果这一行包含表格分隔符 |
    if (line.includes('|')) {
      // 移除所有 <br> 标签变体，替换为空格
      return line
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/\s+/g, ' '); // 清理多余空格
    }
    return line;
  });

  return processedLines.join('\n');
};
