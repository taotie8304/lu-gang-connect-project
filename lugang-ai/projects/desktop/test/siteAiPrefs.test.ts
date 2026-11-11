import { describe, expect, it } from 'vitest';
import {
  SITE_AI_REJECT_MESSAGES,
  evaluateSiteAiMode,
  normalizeSiteOrigin,
  parseSiteAiPrefStore
} from '../src/main/browser/siteAiPrefs';

describe('normalizeSiteOrigin', () => {
  it('保留 http(s) 站点并去掉路径', () => {
    expect(normalizeSiteOrigin('https://www.gov.hk/en/residents/form?x=1')).toBe(
      'https://www.gov.hk'
    );
    expect(normalizeSiteOrigin('http://example.com:8080/a')).toBe('http://example.com:8080');
  });

  it('非网页地址不参与站点偏好', () => {
    expect(normalizeSiteOrigin('about:blank')).toBeNull();
    expect(normalizeSiteOrigin('file:///tmp/error.html')).toBeNull();
    expect(normalizeSiteOrigin('chrome://settings')).toBeNull();
    expect(normalizeSiteOrigin('not-a-url')).toBeNull();
  });
});

describe('evaluateSiteAiMode', () => {
  it('默认允许所有网页动作', () => {
    expect(evaluateSiteAiMode('allow', 'click')).toEqual({ allowed: true });
    expect(evaluateSiteAiMode('allow', 'type')).toEqual({ allowed: true });
    expect(evaluateSiteAiMode('allow', 'navigate')).toEqual({ allowed: true });
  });

  it('仅读取放行导航、读取与滚动，拒绝点击与填写', () => {
    expect(evaluateSiteAiMode('read_only', 'navigate')).toEqual({ allowed: true });
    expect(evaluateSiteAiMode('read_only', 'read')).toEqual({ allowed: true });
    expect(evaluateSiteAiMode('read_only', 'scroll')).toEqual({ allowed: true });
    expect(evaluateSiteAiMode('read_only', 'click')).toEqual({
      allowed: false,
      reason: 'read_only'
    });
    expect(evaluateSiteAiMode('read_only', 'type')).toEqual({
      allowed: false,
      reason: 'read_only'
    });
    expect(evaluateSiteAiMode('read_only', 'select')).toEqual({
      allowed: false,
      reason: 'read_only'
    });
  });

  it('禁止 AI 只放行停止，读取与导航都拒绝', () => {
    expect(evaluateSiteAiMode('blocked', 'stop')).toEqual({ allowed: true });
    expect(evaluateSiteAiMode('blocked', 'navigate')).toEqual({
      allowed: false,
      reason: 'blocked'
    });
    expect(evaluateSiteAiMode('blocked', 'read')).toEqual({
      allowed: false,
      reason: 'blocked'
    });
    expect(evaluateSiteAiMode('blocked', 'scroll')).toEqual({
      allowed: false,
      reason: 'blocked'
    });
  });

  it('本机文件类动作不受站点限制', () => {
    for (const action of ['generate_file', 'open_form', 'fill_form', 'open_document', 'edit_document', 'fill_pdf']) {
      expect(evaluateSiteAiMode('blocked', action)).toEqual({ allowed: true });
      expect(evaluateSiteAiMode('read_only', action)).toEqual({ allowed: true });
    }
  });

  it('拒绝文案包含改回入口与当前档位', () => {
    expect(SITE_AI_REJECT_MESSAGES.read_only).toContain('仅读取');
    expect(SITE_AI_REJECT_MESSAGES.read_only).toContain('允许操作');
    expect(SITE_AI_REJECT_MESSAGES.blocked).toContain('禁止 AI');
    expect(SITE_AI_REJECT_MESSAGES.blocked).toContain('允许操作');
  });
});

describe('parseSiteAiPrefStore', () => {
  it('只保留规范化后的 http(s) origin 与合法档位', () => {
    expect(
      parseSiteAiPrefStore({
        'https://www.gov.hk': 'read_only',
        'http://example.com': 'blocked',
        'https://www.gov.hk/en/form': 'blocked',
        'file:///tmp/a.html': 'blocked',
        'https://bad.example': 'unknown',
        'https://number.example': 1
      })
    ).toEqual({
      'https://www.gov.hk': 'read_only',
      'http://example.com': 'blocked'
    });
  });

  it('非法输入返回空对象', () => {
    expect(parseSiteAiPrefStore(null)).toEqual({});
    expect(parseSiteAiPrefStore([1, 2])).toEqual({});
    expect(parseSiteAiPrefStore('not-json')).toEqual({});
  });
});
