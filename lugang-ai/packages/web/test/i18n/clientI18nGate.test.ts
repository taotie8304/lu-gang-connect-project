import { describe, expect, it } from 'vitest';
import { resolveClientI18nGateReady } from '@fastgpt/web/i18n/clientI18nGateState';

const createBundleChecker = (...languages: string[]) => {
  const complete = new Set(languages);
  return (language: string) => complete.has(language);
};

describe('resolveClientI18nGateReady', () => {
  it('初始化阶段：i18n 已停在目标语言且语言链完整时直接通过', () => {
    expect(
      resolveClientI18nGateReady({
        i18nLanguage: 'zh-CN',
        initialLanguage: 'zh-CN',
        settled: false,
        hasCompleteBundle: createBundleChecker('zh-CN')
      })
    ).toBe(true);
  });

  it('初始化阶段：i18n 仍停在旧语言时保持加载态，等待首次切换', () => {
    expect(
      resolveClientI18nGateReady({
        i18nLanguage: 'en',
        initialLanguage: 'zh-CN',
        settled: false,
        hasCompleteBundle: createBundleChecker('zh-CN', 'en')
      })
    ).toBe(false);
  });

  it('初始化完成后：用户已切换语言但存储尚未提交时仍直接渲染，不回退也不反向切换', () => {
    expect(
      resolveClientI18nGateReady({
        i18nLanguage: 'ko-KR',
        initialLanguage: 'zh-CN',
        settled: true,
        hasCompleteBundle: createBundleChecker('zh-CN', 'ko-KR')
      })
    ).toBe(true);
  });

  it('初始化完成后：当前 i18n 语言链不完整时才回到加载态，仍以当前语言为准', () => {
    expect(
      resolveClientI18nGateReady({
        i18nLanguage: 'ko-KR',
        initialLanguage: 'zh-CN',
        settled: true,
        hasCompleteBundle: createBundleChecker('zh-CN')
      })
    ).toBe(false);
  });
});
