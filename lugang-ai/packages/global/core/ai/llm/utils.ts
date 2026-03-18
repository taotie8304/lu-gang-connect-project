/**
 * 鲁港通 - 流式深度思考内容过滤器（有状态）
 * 处理流式推理输出中跨 chunk 的敏感信息过滤
 * 使用缓冲机制确保跨 chunk 的标签和引用标记能被完整匹配
 */
export const createReasoningSanitizer = () => {
  let buffer = '';

  /**
   * 对完整文本进行敏感信息清理（内部使用）
   * 覆盖三大类泄露：
   * A) 直接的标签和格式（<Cites>、[id](CITE) 等）
   * B) 模型用自然语言讨论/复述引用规则和 Cites 内容
   * C) 系统提示词相关提及
   */
  const cleanText = (text: string): string => {
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
      /^.*由于只有一个.*id.*可用.*$/gm,
      /^.*可用的\s*(?:cite\s*)?id.*$/gim,
      /^.*使用\s*\[id\]\(CITE\)\s*.*引用.*$/gm,
      /^.*追溯展示规则.*$/gm,
      /^.*每段话.*至少包含一个引用.*$/gm,
      /^.*每段话.*至少使用一次.*id.*$/gm,
      /^.*每段话.*都需要.*引用标记.*$/gm,
      /^.*每段话.*添加引用.*$/gm,
      /^.*不要伪造\s*id.*$/gm,
      /^.*CITE\s*是固定常量.*$/gm,
      /^.*在.*每段话结尾.*整合引用.*$/gm,
      /^.*引用标记.*格式.*$/gm,
      /^.*不同内容来自不同的来源.*$/gm,
      /^.*合理分配引用.*$/gm,
      /^.*确保每段话都有引用.*$/gm,
      /^.*需要在每段话中.*引用.*$/gm,
      /^.*来源是[""].*\.pdf[""].*$/gm,
      /^.*来源是[""].*\.docx?[""].*$/gm,
      /^.*来源是[""].*\.xlsx?[""].*$/gm,
      /^.*来源是[""].*\.txt[""].*$/gm,
      /^.*让我重新理解规则.*$/gm,
      /^.*让我理解.*引用规则.*$/gm,
      /^.*重新理解.*Cites.*$/gim,
      /^.*理解.*引用.*规则.*$/gm
    ];
    for (const p of cnPatterns) {
      result = result.replace(p, '');
    }

    // ===== B2) 模型讨论/复述引用规则（英文） =====
    const enPatterns = [
      /^.*based on the Cites section.*$/gim,
      /^.*from the Cites.*$/gim,
      /^.*in the Cites.*$/gim,
      /^.*the Cites contains.*$/gim,
      /^.*Cites section.*only.*id.*$/gim,
      /^.*available cite id.*$/gim,
      /^.*only one cite.*$/gim,
      /^.*every paragraph must have at least one cit.*$/gim,
      /^.*\[id\]\(CITE\) format.*$/gim,
      /^.*CITE is a fixed constant.*$/gim,
      /^.*do not fabricate id.*$/gim,
      /^.*must use.*\(CITE\).*to cite.*$/gim,
      /^.*citation.*support.*\[id\]\(CITE\).*$/gim,
      /^.*need to add citation.*each paragraph.*$/gim,
      /^.*at least one citation per paragraph.*$/gim,
      /^.*I need to.*cite.*in each paragraph.*$/gim,
      /^.*I should.*cite.*every paragraph.*$/gim,
      /^.*different content.*different sources.*$/gim,
      /^.*allocate citations.*$/gim,
      /^.*distribute.*citations.*$/gim,
      /^.*ensure.*paragraph.*has.*citation.*$/gim
    ];
    for (const p of enPatterns) {
      result = result.replace(p, '');
    }

    // ===== C) 系统提示词相关提及 =====
    result = result.replace(/系统提示词[中的要求指示说明]*/g, '');
    result = result.replace(/引用提示词[中的要求指示说明]*/g, '');
    result = result.replace(/引用规则[中的要求指示说明]*/g, '');

    // ===== D) 清理多余空行 =====
    result = result.replace(/\n{3,}/g, '\n\n');

    return result;
  };

  const processChunk = (chunk: string): string => {
    buffer += chunk;

    const openCitesCount = (buffer.match(/<Cites>/gi) || []).length;
    const closeCitesCount = (buffer.match(/<\/Cites>/gi) || []).length;
    if (openCitesCount > closeCitesCount) {
      return '';
    }

    const lastBracket = buffer.lastIndexOf('[');
    if (lastBracket !== -1) {
      const afterBracket = buffer.slice(lastBracket);
      if (afterBracket.length < 32 && !afterBracket.includes(')') && /^\[[a-f0-9]*$/i.test(afterBracket)) {
        return '';
      }
    }

    const partialTagMatch = buffer.match(/<\/?C(?:i(?:t(?:e(?:s)?)?)?)?$/i);
    if (partialTagMatch) {
      return '';
    }

    const cleaned = cleanText(buffer);
    buffer = '';
    return cleaned;
  };

  const flush = (): string => {
    if (!buffer) return '';
    const cleaned = cleanText(buffer);
    buffer = '';
    return cleaned;
  };

  return { processChunk, flush };
};

/**
 * 鲁港通 - 清理深度思考内容中的敏感信息（无状态版本）
 * 用于对最终完整的 reasoningText 进行一次性清理
 */
export const sanitizeReasoningContent = (text: string): string => {
  if (!text) return text;

  const sanitizer = createReasoningSanitizer();
  sanitizer.processChunk(text);
  const result = sanitizer.flush();

  return result.trim() ? result : '';
};

export const removeDatasetCiteText = (text: string, retainDatasetCite: boolean) => {
  return retainDatasetCite
    ? text.replace(/[\[【]id[\]】]\(CITE\)/g, '')
    : text
        .replace(/[\[【]([a-f0-9]{24})[\]】](?:\([^\)]*\)?)?/g, '')
        .replace(/[\[【]id[\]】]\(CITE\)/g, '');
};
