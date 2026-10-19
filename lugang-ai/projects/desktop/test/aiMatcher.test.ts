import { describe, expect, it } from 'vitest';
import {
  isHighRiskActionLabel,
  isSensitiveElement,
  matchAiTarget,
  type AiElementView
} from '../src/main/ai/matcher';

const element = (patch: Partial<AiElementView> = {}): AiElementView => ({
  ref: 'e1',
  role: 'textbox',
  name: '姓名',
  tag: 'input',
  type: 'text',
  visible: true,
  ...patch
});

describe('AI 元素定位', () => {
  it('优先使用快照引用', () => {
    const result = matchAiTarget([element({ ref: 'e7', name: '姓名' })], { ref: 'e7' });
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') expect(result.element.ref).toBe('e7');
  });

  it('引用失效时按名称语义重定位', () => {
    const result = matchAiTarget([element({ ref: 'e2', name: '申请人姓名' })], {
      ref: 'e99',
      target: '申请人姓名'
    });
    expect(result.kind).toBe('matched');
    if (result.kind === 'matched') expect(result.element.ref).toBe('e2');
  });

  it('名称包含与占位符参与匹配', () => {
    const byPlaceholder = matchAiTarget(
      [element({ ref: 'e3', name: '', placeholder: '请输入手机号码' })],
      { target: '手机号码' }
    );
    expect(byPlaceholder.kind).toBe('matched');
  });

  it('多个同样匹配时返回歧义而不是瞎点', () => {
    const result = matchAiTarget(
      [
        element({ ref: 'e1', name: '下一步' }),
        element({ ref: 'e2', name: '下一步', role: 'button', tag: 'button' })
      ],
      { target: '下一步' }
    );
    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') expect(result.candidates).toHaveLength(2);
  });

  it('找不到时明确返回 not_found', () => {
    expect(matchAiTarget([element({ name: '姓名' })], { target: '银行卡号' }).kind).toBe(
      'not_found'
    );
  });

  it('隐藏元素不参与匹配', () => {
    expect(
      matchAiTarget([element({ name: '提交', visible: false })], { target: '提交' }).kind
    ).toBe('not_found');
  });
});

describe('AI 敏感与高风险识别', () => {
  it('密码、验证码、银行卡字段视为敏感', () => {
    expect(isSensitiveElement(element({ type: 'password', name: '登录密码' }))).toBe(true);
    expect(isSensitiveElement(element({ name: '短信验证码' }))).toBe(true);
    expect(isSensitiveElement(element({ name: '银行卡号' }))).toBe(true);
    expect(isSensitiveElement(element({ name: 'CVV 安全码' }))).toBe(true);
    expect(isSensitiveElement(element({ name: '姓名' }))).toBe(false);
  });

  it('提交、支付、发布、删除按钮视为高风险', () => {
    expect(isHighRiskActionLabel('提交申请')).toBe(true);
    expect(isHighRiskActionLabel('确认支付')).toBe(true);
    expect(isHighRiskActionLabel('发布文章')).toBe(true);
    expect(isHighRiskActionLabel('删除记录')).toBe(true);
    expect(isHighRiskActionLabel('下一步')).toBe(false);
    expect(isHighRiskActionLabel('搜索')).toBe(false);
  });
});
