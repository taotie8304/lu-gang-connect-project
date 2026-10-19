import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AI_ALLOWED_HOSTS,
  isAiHostAllowed,
  isAiUrlAllowed,
  parseAiAllowedHosts
} from '../src/main/ai/allowlist';

describe('AI 站点白名单', () => {
  it('默认只放行政府官网后缀', () => {
    expect(DEFAULT_AI_ALLOWED_HOSTS).toEqual(['.gov.hk', '.gov.cn']);
  });

  it('后缀规则放行主域与任意子域', () => {
    const allowed = ['.gov.hk', '.gov.cn'];
    expect(isAiHostAllowed('gov.hk', allowed)).toBe(true);
    expect(isAiHostAllowed('www.gov.hk', allowed)).toBe(true);
    expect(isAiHostAllowed('www.info.gov.hk', allowed)).toBe(true);
    expect(isAiHostAllowed('www.sh.gov.cn', allowed)).toBe(true);
  });

  it('后缀规则不误伤相似域名', () => {
    const allowed = ['.gov.hk'];
    expect(isAiHostAllowed('notgov.hk', allowed)).toBe(false);
    expect(isAiHostAllowed('gov.hk.evil.com', allowed)).toBe(false);
    expect(isAiHostAllowed('fakegov.hk', allowed)).toBe(false);
  });

  it('支持精确主机与本地测试地址', () => {
    const allowed = parseAiAllowedHosts('localhost, 127.0.0.1 ,.gov.hk');
    expect(allowed).toEqual(['localhost', '127.0.0.1', '.gov.hk']);
    expect(isAiHostAllowed('localhost', allowed)).toBe(true);
    expect(isAiHostAllowed('127.0.0.1', allowed)).toBe(true);
    expect(isAiHostAllowed('www.gov.hk', allowed)).toBe(true);
    expect(isAiHostAllowed('example.com', allowed)).toBe(false);
  });

  it('环境变量为空时回落到默认白名单', () => {
    expect(parseAiAllowedHosts('')).toEqual(DEFAULT_AI_ALLOWED_HOSTS);
    expect(parseAiAllowedHosts('   ')).toEqual(DEFAULT_AI_ALLOWED_HOSTS);
    expect(parseAiAllowedHosts(undefined)).toEqual(DEFAULT_AI_ALLOWED_HOSTS);
  });

  it('只放行 http/https 且主机在白名单内', () => {
    const allowed = ['.gov.hk', 'localhost'];
    expect(isAiUrlAllowed('https://www.gov.hk/sc/home/', allowed)).toBe(true);
    expect(isAiUrlAllowed('http://localhost:8123/form.html', allowed)).toBe(true);
    expect(isAiUrlAllowed('javascript:alert(1)', allowed)).toBe(false);
    expect(isAiUrlAllowed('file:///C:/secret.txt', allowed)).toBe(false);
    expect(isAiUrlAllowed('https://example.com/', allowed)).toBe(false);
    expect(isAiUrlAllowed('not a url', allowed)).toBe(false);
  });

  it('主机名大小写与末尾点归一化', () => {
    expect(isAiHostAllowed('WWW.GOV.HK.', ['.gov.hk'])).toBe(true);
  });
});
