/**
 * 鲁港通 - 深度思考内容敏感信息清理工具
 *
 * 核心策略：流式直接透传，仅对最终完整文本做清理
 * - processChunk: 直接返回原文（零缓冲，避免卡死）
 * - flush: 返回空字符串（无缓冲区）
 * - sanitizeReasoningContent: 对完整 reasoningText 做一次性清理
 * - removeDatasetCiteText: 移除知识库引用标记（供其他模块使用）
 */

/**
 * 对完整的思考文本进行敏感信息清理
 * 移除：Cites 标签、引用格式、系统提示词复述、知识库讨论等
 */
const cleanReasoningText = (text: string): string => {
  let result = text;

  // ===== A) 直接标签和格式 =====
  result = result.replace(/<Cites>[\s\S]*?<\/Cites>/gi, '');
  result = result.replace(/\[([a-f0-9]{24})\]\(CITE\)/gi, '');
  result = result.replace(/[\[【]id[\]】]\(CITE\)/gi, '');
  result = result.replace(/^.*Citation[s]?\s*[:：].*\(CITE\).*$/gm, '');
  result = result.replace(/\(CITE\)/g, '');

  // ===== B) 模型讨论/复述引用规则（中文） =====
  const cnPatterns = [
    /^.*根据\s*Cites\s*部分.*$/gm,
    /^.*Cites\s*部分.*只有.*id.*$/gm,
    /^.*Cites\s*中的内容.*$/gm,
    /^.*Cite\s*中的内容.*$/gm,
    /^.*<Cites>.*内容.*$/gm,
    /^.*在\s*Cites\s*中.*$/gm,
    /^.*从\s*Cites\s*中.*$/gm,
    /^.*Cites\s*标[签记].*$/gm,
    /^.*cite\s*id\s*可用.*$/gim,
    /^.*只有一个\s*(?:cite\s*)?id.*$/gim,
    /^.*可用的\s*(?:cite\s*)?id.*$/gim,
    /^.*由于只有一个.*id.*可用.*$/gm,
    /^.*引用标[签记识].*\(CITE\).*$/gm,
    /^.*追溯展示规则.*$/gm,
    /^.*引用格式.*\[id\]\(CITE\).*$/gm,
    /^.*需要在.*结尾.*添加引用.*$/gm,
    /^.*每段话.*至少.*引用.*$/gm
  ];

  // ===== C) 模型讨论/复述引用规则（英文） =====
  const enPatterns = [
    /^.*based on the Cites section.*$/gim,
    /^.*from the Cites.*$/gim,
    /^.*in the Cites.*$/gim,
    /^.*Cites section.*only.*id.*$/gim,
    /^.*available cite id.*$/gim,
    /^.*only one.*cite.*id.*available.*$/gim,
    /^.*\[id\]\(CITE\)\s*format.*$/gim,
    /^.*citation.*format.*\(CITE\).*$/gim,
    /^.*add citation.*at the end.*$/gim,
    /^.*each paragraph.*at least.*citation.*$/gim,
    /^.*traceability.*display.*rules.*$/gim,
    /^.*I need to add.*\[.*\]\(CITE\).*$/gim,
    /^.*I should cite.*using.*CITE.*$/gim,
    /^.*let me add.*citations.*$/gim,
    /^.*I'll include.*\(CITE\).*$/gim
  ];

  // ===== D) 系统提示词复述 =====
  const systemPromptPatterns = [
    /^.*任务描述.*知识库回答助手.*$/gm,
    /^.*使用 Markdown 语法优化.*$/gm,
    /^.*保持答案与.*一致.*避免提及.*$/gm,
    /^.*使用与问题相同的语言.*$/gm,
    /^.*task description.*knowledge base.*assistant.*$/gim,
    /^.*use Markdown syntax.*optimize.*$/gim,
    /^.*keep.*answer.*consistent.*avoid mentioning.*$/gim,
    /^.*use the same language as the question.*$/gim
  ];

  const allPatterns = [...cnPatterns, ...enPatterns, ...systemPromptPatterns];
  for (const pattern of allPatterns) {
    result = result.replace(pattern, '');
  }

  // ===== E) 清理多余空行 =====
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.trim();

  return result;
};

/**
 * 鲁港通 - 创建流式思考内容处理器
 *
 * 关键设计：processChunk 直接透传，零缓冲
 * 之前的缓冲方案会在自然语言中误匹配 `<C`、`<Ci` 等片段导致流卡死
 */
export const createReasoningSanitizer = () => {
  return {
    /** 直接透传，不做任何缓冲或过滤 */
    processChunk(text: string): string {
      return text;
    },
    /** 无缓冲区，返回空字符串 */
    flush(): string {
      return '';
    }
  };
};

/**
 * 对最终完整的 reasoningText 进行敏感信息清理
 * 在流式结束后调用，对存储的完整文本做一次性处理
 */
export const sanitizeReasoningContent = (text: string): string => {
  if (!text) return '';
  return cleanReasoningText(text);
};

/**
 * 移除知识库引用标记（供 request.ts 等模块使用）
 * retainDatasetCite=true 时保留引用，false 时移除
 */
export const removeDatasetCiteText = (text: string, retainDatasetCite?: boolean): string => {
  if (!text) return '';
  if (retainDatasetCite) return text;

  // 移除 [hexId](CITE) 格式的引用标记
  return text.replace(/\[([a-f0-9]{24})\]\(CITE\)/gi, '');
};
