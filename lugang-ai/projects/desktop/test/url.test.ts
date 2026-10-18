import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_URL, normalizeHttpUrl, resolveAppUrl } from '../src/shared/url';

describe('normalizeHttpUrl', () => {
  it('裸域名补 https', () => {
    expect(normalizeHttpUrl('www.gov.hk')).toBe('https://www.gov.hk/');
  });

  it('保留已有 http 协议', () => {
    expect(normalizeHttpUrl('http://example.com/a')).toBe('http://example.com/a');
  });

  it('去掉首尾空白', () => {
    expect(normalizeHttpUrl('  https://example.com  ')).toBe('https://example.com/');
  });

  it('拒绝空串', () => {
    expect(normalizeHttpUrl('   ')).toBeNull();
  });

  it('拒绝非 http(s) 协议', () => {
    expect(normalizeHttpUrl('file:///c:/a.html')).toBeNull();
  });

  it('拒绝无点主机名', () => {
    expect(normalizeHttpUrl('http://localhost:3210')).toBeNull();
  });

  it('拒绝不合法输入', () => {
    expect(normalizeHttpUrl('not a url')).toBeNull();
  });
});

describe('resolveAppUrl', () => {
  it('无参时返回线上地址', () => {
    expect(resolveAppUrl()).toBe(DEFAULT_APP_URL);
  });

  it('允许 localhost 开发地址', () => {
    expect(resolveAppUrl('http://localhost:3210')).toBe('http://localhost:3210/');
  });

  it('非法值回落线上地址', () => {
    expect(resolveAppUrl('ftp://example.com')).toBe(DEFAULT_APP_URL);
  });
});
