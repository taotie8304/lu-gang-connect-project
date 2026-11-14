import { describe, expect, it } from 'vitest';
import type { AIChatItemValueItemType, ChatFileCardType } from '@fastgpt/global/core/chat/type';
import {
  MAX_CHAT_FILE_CARDS,
  mergeChatFileCards,
  mergeChatFileCardsIntoValues,
  readChatFileCardsFromMetadata
} from '@fastgpt/global/core/chat/utils/files';

const file = (key: string, format: ChatFileCardType['format'] = 'docx'): ChatFileCardType => ({
  key,
  name: `${key}.${format}`,
  format,
  size: 2048
});

describe('mergeChatFileCards', () => {
  it('按 key 去重并保持原有顺序', () => {
    expect(mergeChatFileCards([file('a')], [file('b'), file('a')])).toEqual([file('a'), file('b')]);
  });

  it('单条消息最多保留 3 个文件', () => {
    const merged = mergeChatFileCards([], [file('a'), file('b'), file('c'), file('d')]);

    expect(merged).toHaveLength(MAX_CHAT_FILE_CARDS);
    expect(merged.map((item) => item.key)).toEqual(['a', 'b', 'c']);
  });
});

describe('mergeChatFileCardsIntoValues', () => {
  it('没有文件 value 时追加独立 value，不挂在工具 value 上', () => {
    const values: AIChatItemValueItemType[] = [
      {
        id: 'call_1',
        tools: [
          {
            id: 'call_1',
            toolName: '文档处理',
            toolAvatar: '',
            functionName: 'document_operation',
            params: '{}'
          }
        ]
      }
    ];

    const next = mergeChatFileCardsIntoValues(values, [file('a')]);

    expect(next).toHaveLength(2);
    expect(next[0].files).toBeUndefined();
    expect(next[1]).toEqual({ files: [file('a')] });
  });

  it('已有文件 value 时累加去重', () => {
    const values: AIChatItemValueItemType[] = [{ files: [file('a')] }];

    const next = mergeChatFileCardsIntoValues(values, [file('b'), file('a')]);

    expect(next).toHaveLength(1);
    expect(next[0].files).toEqual([file('a'), file('b')]);
  });
});

describe('readChatFileCardsFromMetadata', () => {
  it('只接受合法文件卡片', () => {
    expect(
      readChatFileCardsFromMetadata({
        files: [file('a'), { key: 'b' }, null, { key: 'c', name: 'c.txt', format: 'txt' }]
      })
    ).toEqual([file('a')]);
  });

  it('无 metadata 或结构不符时返回空数组', () => {
    expect(readChatFileCardsFromMetadata(undefined)).toEqual([]);
    expect(readChatFileCardsFromMetadata('files')).toEqual([]);
    expect(readChatFileCardsFromMetadata({ files: 'x' })).toEqual([]);
  });
});
