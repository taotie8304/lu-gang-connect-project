import {
  ChatFileCardSchema,
  type AIChatItemValueItemType,
  type ChatFileCardType
} from '../type';

// 鲁港通 - 单条消息最多展示 3 个文件卡片，避免一次生成过多文件撑爆气泡
export const MAX_CHAT_FILE_CARDS = 3;

/** 按 key 去重并保持顺序，同时限制单条消息的文件卡片数量。 */
export const mergeChatFileCards = (
  current?: ChatFileCardType[] | null,
  incoming?: ChatFileCardType[] | null
): ChatFileCardType[] => {
  const merged = [...(current || [])];
  for (const item of incoming || []) {
    if (merged.length >= MAX_CHAT_FILE_CARDS) break;
    if (merged.some((file) => file.key === item.key)) continue;
    merged.push(item);
  }
  return merged;
};

/**
 * 把文件卡片合并进 AI 消息 value 列表。
 *
 * 文件必须独立成块（`{ files }`），不能挂在工具 value 上：工具块位于「处理过程」折叠面板内，
 * 默认收起时会导致文件卡片不可见。
 */
export const mergeChatFileCardsIntoValues = (
  values: AIChatItemValueItemType[],
  incoming?: ChatFileCardType[] | null
): AIChatItemValueItemType[] => {
  const files = mergeChatFileCards([], incoming);
  if (!files.length) return values;

  let filesIndex = -1;
  for (let index = values.length - 1; index >= 0; index--) {
    if (values[index].files?.length) {
      filesIndex = index;
      break;
    }
  }

  if (filesIndex < 0) {
    return [...values, { files }];
  }

  return values.map((value, index) =>
    index === filesIndex ? { ...value, files: mergeChatFileCards(value.files, files) } : value
  );
};

/** 从工具执行 metadata 中读取合法文件卡片，忽略缺失与非法项。 */
export const readChatFileCardsFromMetadata = (metadata: unknown): ChatFileCardType[] => {
  if (!metadata || typeof metadata !== 'object') return [];

  const files = (metadata as { files?: unknown }).files;
  if (!Array.isArray(files)) return [];

  const result: ChatFileCardType[] = [];
  for (const item of files) {
    const parsed = ChatFileCardSchema.safeParse(item);
    if (!parsed.success) continue;
    if (result.length >= MAX_CHAT_FILE_CARDS) break;
    if (result.some((file) => file.key === parsed.data.key)) continue;
    result.push(parsed.data);
  }
  return result;
};
