import { describe, expect, it } from 'vitest';
import { parseAiCommand } from '../src/main/ai/protocol';

describe('AI 指令协议', () => {
  it('接受读取、导航、点击、输入、下拉、滚动与停止指令', () => {
    expect(parseAiCommand({ action: 'read' })?.action).toBe('read');
    expect(parseAiCommand({ action: 'navigate', url: 'https://www.gov.hk/' })?.action).toBe(
      'navigate'
    );
    expect(parseAiCommand({ action: 'click', ref: 'e12' })?.action).toBe('click');
    expect(parseAiCommand({ action: 'click', target: '下一步' })?.action).toBe('click');
    expect(parseAiCommand({ action: 'type', ref: 'e3', text: '张三' })?.action).toBe('type');
    expect(
      parseAiCommand({ action: 'select', target: '证件类型', option: '港澳通行证' })?.action
    ).toBe('select');
    expect(parseAiCommand({ action: 'scroll', direction: 'down', amount: 600 })?.action).toBe(
      'scroll'
    );
    expect(parseAiCommand({ action: 'stop' })?.action).toBe('stop');
  });

  it('点击/输入/下拉必须给出元素定位信息', () => {
    expect(parseAiCommand({ action: 'click' })).toBeNull();
    expect(parseAiCommand({ action: 'type', text: '张三' })).toBeNull();
    expect(parseAiCommand({ action: 'select', option: '是' })).toBeNull();
  });

  it('拒绝未知动作与超长内容', () => {
    expect(parseAiCommand({ action: 'submit' })).toBeNull();
    expect(parseAiCommand({ action: 'type', ref: 'e1', text: 'x'.repeat(2001) })).toBeNull();
    expect(parseAiCommand({ action: 'navigate', url: '' })).toBeNull();
    expect(parseAiCommand({ action: 'scroll', direction: 'diagonal' })).toBeNull();
  });

  it('拒绝非法字段类型', () => {
    expect(parseAiCommand({ action: 'scroll', direction: 'down', amount: -1 })).toBeNull();
    expect(parseAiCommand({ action: 'read', fullText: 'yes' })).toBeNull();
    expect(parseAiCommand(null)).toBeNull();
    expect(parseAiCommand('read')).toBeNull();
  });
});
