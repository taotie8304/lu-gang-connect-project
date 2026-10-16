import { describe, expect, it } from 'vitest';
import { normalizeBuiltinBrowserUrl } from '@fastgpt/global/support/builtinBrowser/url';

describe('normalizeBuiltinBrowserUrl', () => {
  it('裸域名：补全 https 并归一化为完整地址', () => {
    expect(normalizeBuiltinBrowserUrl('www.gov.hk')).toBe('https://www.gov.hk/');
    expect(normalizeBuiltinBrowserUrl('immd.gov.hk/zh/index.html')).toBe(
      'https://immd.gov.hk/zh/index.html'
    );
    expect(normalizeBuiltinBrowserUrl('www.immd.gov.hk')).toBe('https://www.immd.gov.hk/');
  });

  it('完整地址：保留原协议与路径', () => {
    expect(normalizeBuiltinBrowserUrl('https://www.gov.hk/tc/')).toBe('https://www.gov.hk/tc/');
    expect(normalizeBuiltinBrowserUrl('http://example.com')).toBe('http://example.com/');
  });

  it('首尾空白：去除后处理', () => {
    expect(normalizeBuiltinBrowserUrl('  www.gov.hk  ')).toBe('https://www.gov.hk/');
  });

  it('空输入：返回 null', () => {
    expect(normalizeBuiltinBrowserUrl('')).toBeNull();
    expect(normalizeBuiltinBrowserUrl('   ')).toBeNull();
  });

  it('非网址文本：返回 null（不含域名点/含空格/中文词）', () => {
    expect(normalizeBuiltinBrowserUrl('hello')).toBeNull();
    expect(normalizeBuiltinBrowserUrl('香港入境处')).toBeNull();
    expect(normalizeBuiltinBrowserUrl('www.gov .hk')).toBeNull();
  });

  it('非 http(s) 协议：返回 null', () => {
    expect(normalizeBuiltinBrowserUrl('ftp://example.com')).toBeNull();
    expect(normalizeBuiltinBrowserUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeBuiltinBrowserUrl('javascript://alert(1)')).toBeNull();
  });
});
