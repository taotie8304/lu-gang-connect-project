import { describe, expect, it } from 'vitest';
import {
  isAiPrivateHost,
  isAiSnapshotUrlAllowed,
  isAiUrlOperable
} from '../src/main/ai/urlPolicy';

describe('AI 可操作网址策略', () => {
  it('任意公网 http/https 站点都可操作', () => {
    expect(isAiUrlOperable('https://www.empf.org.hk/')).toBe(true);
    expect(isAiUrlOperable('https://www.gov.hk/sc/home/')).toBe(true);
    expect(isAiUrlOperable('https://example.com/form?id=1')).toBe(true);
    expect(isAiUrlOperable('http://www.baidu.com/')).toBe(true);
  });

  it('拦截本机回环地址', () => {
    expect(isAiPrivateHost('127.0.0.1')).toBe(true);
    expect(isAiPrivateHost('127.8.9.10')).toBe(true);
    expect(isAiPrivateHost('localhost')).toBe(true);
    expect(isAiPrivateHost('LOCALHOST.')).toBe(true);
    expect(isAiPrivateHost('app.localhost')).toBe(true);
    expect(isAiPrivateHost('[::1]')).toBe(true);
    expect(isAiPrivateHost('::1')).toBe(true);
    expect(isAiUrlOperable('http://127.0.0.1:3100/')).toBe(false);
    expect(isAiUrlOperable('http://localhost:8123/form.html')).toBe(false);
    expect(isAiUrlOperable('http://[::1]:8080/admin')).toBe(false);
  });

  it('拦截内网与链路本地地址', () => {
    expect(isAiPrivateHost('10.0.0.5')).toBe(true);
    expect(isAiPrivateHost('172.16.0.1')).toBe(true);
    expect(isAiPrivateHost('172.31.255.254')).toBe(true);
    expect(isAiPrivateHost('192.168.1.1')).toBe(true);
    expect(isAiPrivateHost('169.254.1.1')).toBe(true);
    expect(isAiPrivateHost('0.0.0.0')).toBe(true);
    expect(isAiPrivateHost('fe80::1')).toBe(true);
    expect(isAiPrivateHost('fd00::1')).toBe(true);
    expect(isAiUrlOperable('http://192.168.1.1/')).toBe(false);
    expect(isAiUrlOperable('https://10.20.30.40/portal')).toBe(false);
  });

  it('不误伤公网里长得像内网的域名', () => {
    expect(isAiPrivateHost('172.32.0.1')).toBe(false);
    expect(isAiPrivateHost('192.169.0.1')).toBe(false);
    expect(isAiPrivateHost('11.0.0.1')).toBe(false);
    expect(isAiPrivateHost('localhost.example.com')).toBe(false);
    expect(isAiUrlOperable('https://172.32.0.1/')).toBe(true);
  });

  it('只允许 http/https 协议导航', () => {
    expect(isAiUrlOperable('javascript:alert(1)')).toBe(false);
    expect(isAiUrlOperable('file:///C:/secret.txt')).toBe(false);
    expect(isAiUrlOperable('data:text/html,hi')).toBe(false);
    expect(isAiUrlOperable('not a url')).toBe(false);
    expect(isAiUrlOperable('')).toBe(false);
  });

  it('快照允许空白页与加载失败页，但不放行本机与本地文件', () => {
    expect(isAiSnapshotUrlAllowed(undefined)).toBe(true);
    expect(isAiSnapshotUrlAllowed('')).toBe(true);
    expect(isAiSnapshotUrlAllowed('about:blank')).toBe(true);
    expect(isAiSnapshotUrlAllowed('chrome-error://chromewebdata/')).toBe(true);
    expect(isAiSnapshotUrlAllowed('https://example.com/')).toBe(true);
    expect(isAiSnapshotUrlAllowed('http://127.0.0.1:3100/')).toBe(false);
    expect(isAiSnapshotUrlAllowed('file:///C:/secret.txt')).toBe(false);
  });
});
