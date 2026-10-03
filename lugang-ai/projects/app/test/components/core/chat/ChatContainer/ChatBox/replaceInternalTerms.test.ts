import { describe, expect, it } from 'vitest';
import { replaceInternalTerms } from '@/components/core/chat/ChatContainer/ChatBox/components/AIChatBubble/utils';

describe('AIChatBubble replaceInternalTerms', () => {
  it('replaces simplified internal term with user facing wording', () => {
    expect(replaceInternalTerms('先从知识库中检索')).toBe('先从资料中检索');
    expect(replaceInternalTerms('知识库+知识库')).toBe('资料+资料');
  });

  it('replaces traditional variants too', () => {
    expect(replaceInternalTerms('先從知識庫中檢索')).toBe('先從資料中檢索');
  });

  it('keeps text without internal terms unchanged', () => {
    const text = '我需要查询香港银行开户的官方资料';
    expect(replaceInternalTerms(text)).toBe(text);
  });

  it('does not touch partial words', () => {
    expect(replaceInternalTerms('知识与资料库')).toBe('知识与资料库');
  });

  it('handles empty string', () => {
    expect(replaceInternalTerms('')).toBe('');
  });
});
