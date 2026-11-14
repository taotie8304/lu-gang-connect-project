import { describe, it, expect } from 'vitest';
import {
  i18nT,
  parseI18nString,
  formatI18nLocationToZhEn,
  parseLocale,
  parseAcceptLanguage
} from '@fastgpt/global/common/i18n/utils';
import type { I18nStringType } from '@fastgpt/global/common/i18n/type';

describe('i18nT', () => {
  it('should return the original i18n key', () => {
    expect(i18nT('chat:completion_finish_stop')).toBe('chat:completion_finish_stop');
  });
});

describe('parseLocale', () => {
  it.each(['ko', 'ko-KR', 'ko-kr', 'KO_KR', 'ko-KP'])(
    'should normalize Korean locale %s to ko-KR',
    (locale) => {
      expect(parseLocale(locale)).toBe('ko-KR');
    }
  );

  it('should normalize English and Chinese locale variants', () => {
    expect(parseLocale('en-US')).toBe('en');
    expect(parseLocale('zh_hant_tw')).toBe('zh-Hant');
    expect(parseLocale('zh-Hans')).toBe('zh-CN');
  });

  it('should normalize Macau Chinese to traditional Chinese', () => {
    expect(parseLocale('zh-MO')).toBe('zh-Hant');
    expect(parseLocale('zh_mo')).toBe('zh-Hant');
  });

  it('should return undefined for empty or unsupported locales', () => {
    expect(parseLocale()).toBeUndefined();
    expect(parseLocale('')).toBeUndefined();
    expect(parseLocale('fr-FR')).toBeUndefined();
  });
});

describe('parseAcceptLanguage', () => {
  it('should pick the first supported language ordered by q value', () => {
    expect(parseAcceptLanguage('zh-CN,zh;q=0.9,en;q=0.8')).toBe('zh-CN');
    expect(parseAcceptLanguage('en-US,en;q=0.9')).toBe('en');
    expect(parseAcceptLanguage('en;q=0.5,zh-CN;q=0.9')).toBe('zh-CN');
  });

  it('should map regional Chinese variants', () => {
    expect(parseAcceptLanguage('zh-HK,zh;q=0.9')).toBe('zh-Hant');
    expect(parseAcceptLanguage('zh-MO')).toBe('zh-Hant');
  });

  it('should normalize Korean', () => {
    expect(parseAcceptLanguage('ko-KR')).toBe('ko-KR');
  });

  it('should skip unsupported languages and wildcard entries', () => {
    expect(parseAcceptLanguage('fr-FR,zh-CN;q=0.8')).toBe('zh-CN');
    expect(parseAcceptLanguage('*')).toBeUndefined();
    expect(parseAcceptLanguage('')).toBeUndefined();
    expect(parseAcceptLanguage()).toBeUndefined();
  });

  it('should tolerate malformed q values without throwing', () => {
    expect(parseAcceptLanguage('zh-CN;q=abc,en;q=0.4')).toBe('zh-CN');
    expect(parseAcceptLanguage('en;q=,zh-CN')).toBe('en');
  });
});

describe('parseI18nString', () => {
  it('should return string input as-is', () => {
    expect(parseI18nString('hello', 'en')).toBe('hello');
    expect(parseI18nString('')).toBe('');
    expect(parseI18nString()).toBe('');
  });

  it('should return matched locale value', () => {
    const i18n: I18nStringType = {
      en: 'Hello',
      'zh-CN': '你好',
      'zh-Hant': '您好'
    };

    expect(parseI18nString(i18n, 'zh-CN')).toBe('你好');
    expect(parseI18nString(i18n, 'zh-Hant')).toBe('您好');
  });

  it('should fall back to zh-CN for zh-Hant when missing', () => {
    const i18n: I18nStringType = {
      en: 'Hello',
      'zh-CN': '你好'
    };

    expect(parseI18nString(i18n, 'zh-Hant')).toBe('你好');
  });

  it('should fall back to en when locale missing', () => {
    const i18n: I18nStringType = {
      en: 'Hello',
      'zh-CN': '你好'
    };

    expect(parseI18nString(i18n, 'fr')).toBe('Hello');
  });

  it('should accept legacy translation objects without zh-CN', () => {
    expect(parseI18nString({ en: 'Hello' }, 'ko-KR')).toBe('Hello');
  });

  it('should return empty string when locale exists but empty', () => {
    const i18n: I18nStringType = {
      en: 'Hello',
      'zh-CN': ''
    };

    expect(parseI18nString(i18n, 'zh-CN')).toBe('');
  });
});

describe('formatI18nLocationToZhEn', () => {
  it('should return zh for zh locales', () => {
    expect(formatI18nLocationToZhEn('zh-CN')).toBe('zh');
    expect(formatI18nLocationToZhEn('zh-Hant')).toBe('zh');
  });

  it('should be case insensitive for zh check', () => {
    expect(formatI18nLocationToZhEn('zh-CN'.toUpperCase() as 'zh-CN')).toBe('zh');
  });

  it('should return en for non-zh locales', () => {
    expect(formatI18nLocationToZhEn('en')).toBe('en');
  });
});
