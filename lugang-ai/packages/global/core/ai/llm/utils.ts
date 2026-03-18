/**
 * 鲁港通 - 清理深度思考内容中的敏感信息
 * 过滤推理过程中泄露的系统提示词、引用标记、知识库内部结构等内容
 * 保留用户可见的正常推理逻辑
 */
export const sanitizeReasoningContent = (text: string): string => {
  if (!text) return text;

  let result = text;

  // 1. 移除 <Cites>...</Cites> 整块内容（含标签）
  result = result.replace(/<Cites>[\s\S]*?<\/Cites>/gi, '');

  // 2. 移除 [hexId](CITE) 引用标记
  result = result.replace(/\[([a-f0-9]{24})\]\(CITE\)/gi, '');
  // 移除示例格式 [id](CITE)
  result = result.replace(/[\[【]id[\]】]\(CITE\)/gi, '');

  // 3. 移除思考中对引用规则的复述（模型在思考中重复系统提示词的引用指令）
  // 匹配整行包含引用指令关键词的内容
  const instructionPatterns = [
    /^.*使用\s*\[id\]\(CITE\)\s*.*引用.*$/gm,
    /^.*追溯展示规则.*$/gm,
    /^.*每段话.*至少包含一个引用.*$/gm,
    /^.*不要伪造\s*id.*$/gm,
    /^.*CITE\s*是固定常量.*$/gm,
    /^.*在.*每段话结尾.*整合引用.*$/gm
  ];
  for (const pattern of instructionPatterns) {
    result = result.replace(pattern, '');
  }

  // 4. 移除对系统提示词/引用提示词的直接提及
  result = result.replace(/系统提示词[中的要求指示说明]*/g, '');
  result = result.replace(/引用提示词[中的要求指示说明]*/g, '');
  result = result.replace(/引用规则[中的要求指示说明]*/g, '');

  // 5. 清理多余空行（过滤后可能产生连续空行）
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim() ? result : '';
};

export const removeDatasetCiteText = (text: string, retainDatasetCite: boolean) => {
  return retainDatasetCite
    ? text.replace(/[\[【]id[\]】]\(CITE\)/g, '')
    : text
        .replace(/[\[【]([a-f0-9]{24})[\]】](?:\([^\)]*\)?)?/g, '')
        .replace(/[\[【]id[\]】]\(CITE\)/g, '');
};
