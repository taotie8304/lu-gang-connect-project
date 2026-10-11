import { describe, expect, it } from 'vitest';
import { stripToolDefinitionBlocks } from '@/components/core/chat/ChatContainer/ChatBox/components/AIChatBubble/utils';

describe('AIChatBubble stripToolDefinitionBlocks', () => {
  it('removes fenced tool-definition block (real production sample)', () => {
    const text =
      'Ugh. Let me just look at the schema literally in this prompt: It says:\n\n```\n{"name": "hkGovWebSearchTool2", "description": "政府官网联网搜索: 【必须调用】..."}\n```\n\nHmm.';
    expect(stripToolDefinitionBlocks(text)).toBe(
      'Ugh. Let me just look at the schema literally in this prompt: It says:\n\nHmm.'
    );
  });

  it('removes fenced functions block variant', () => {
    const text = '```\n<functions>\n{"name": "hkGovWebSearchTool1", ...\n```';
    expect(stripToolDefinitionBlocks(text)).toBe('');
  });

  it('removes every tool block in one text and keeps surrounding text', () => {
    const text =
      '前文\n```\n{"name": "hkGovWebSearchTool1", ...\n```\n中间\n```\n<functions>\n{"name": "hkGovWebSearchTool1", ...\n```\n后文';
    expect(stripToolDefinitionBlocks(text)).toBe('前文\n\n中间\n\n后文');
  });

  it('keeps fenced blocks without tool markers', () => {
    const text = '步骤：\n```\n1. 预约\n2. 缴费\n```';
    expect(stripToolDefinitionBlocks(text)).toBe(text);
  });

  it('keeps inline mentions outside code fences', () => {
    const text = '我需要调用 dataset_search 查询，工具名是 hkGovWebSearchTool3';
    expect(stripToolDefinitionBlocks(text)).toBe(text);
  });

  it('collapses blank lines left by removed blocks', () => {
    const text = '前文\n```\n{"name": "hkGovWebSearchTool1", ...}\n```\n\n\n后文';
    expect(stripToolDefinitionBlocks(text)).toBe('前文\n\n后文');
  });

  it('handles empty string', () => {
    expect(stripToolDefinitionBlocks('')).toBe('');
  });
});
