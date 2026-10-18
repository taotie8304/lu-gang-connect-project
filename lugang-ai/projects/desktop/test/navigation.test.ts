import { describe, expect, it } from 'vitest';
import {
  decideMainWindowNavigation,
  isManualBrowserUrlAllowed,
  parseManualBrowserUrl
} from '../src/main/navigation';

const appOrigin = 'https://www.airscend.com';

describe('decideMainWindowNavigation', () => {
  it('同源地址放行', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://www.airscend.com/chat',
        targetUrl: 'https://www.airscend.com/chat?appId=1',
        appOrigin
      })
    ).toEqual({ type: 'allow' });
  });

  it('站外 http(s) 交系统浏览器', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://www.airscend.com/chat',
        targetUrl: 'https://data.gov.hk/',
        appOrigin
      })
    ).toEqual({ type: 'external', url: 'https://data.gov.hk/' });
  });

  it('非 http(s) 阻止', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://www.airscend.com/chat',
        targetUrl: 'mailto:a@b.com',
        appOrigin
      })
    ).toEqual({ type: 'block' });
  });

  it('登录页临时放行站外 https（OAuth 跳转）', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://www.airscend.com/login?redirect=%2Fchat',
        targetUrl: 'https://accounts.google.com/o/oauth2/auth',
        appOrigin
      })
    ).toEqual({ type: 'allow' });
  });

  it('appOrigin 带尾斜杠（resolveAppUrl 的 href 形式）仍识别站内地址', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://www.airscend.com/chat',
        targetUrl: 'https://www.airscend.com/chat?appId=1',
        appOrigin: 'https://www.airscend.com/'
      })
    ).toEqual({ type: 'allow' });
  });

  it('appOrigin 带尾斜杠时登录页首跳外域仍放行', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://www.airscend.com/login?redirect=%2Fchat',
        targetUrl: 'https://accounts.google.com/o/oauth2/auth',
        appOrigin: 'https://www.airscend.com/'
      })
    ).toEqual({ type: 'allow' });
  });

  it('登录页子路径同样放行首跳外域', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://www.airscend.com/login/oauth',
        targetUrl: 'https://accounts.google.com/o/oauth2/auth',
        appOrigin
      })
    ).toEqual({ type: 'allow' });
  });

  it('仅路径前缀形似登录页（/loginfoo）不放行外站', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://www.airscend.com/loginfoo',
        targetUrl: 'https://accounts.google.com/o/oauth2/auth',
        appOrigin
      })
    ).toEqual({ type: 'external', url: 'https://accounts.google.com/o/oauth2/auth' });
  });

  it('登录所需第三方域内的后续同源跳转继续放行', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://accounts.google.com/o/oauth2/auth',
        targetUrl: 'https://accounts.google.com/v3/signin/identifier',
        appOrigin
      })
    ).toEqual({ type: 'allow' });
  });

  it('登录所需第三方域跳往其他站点仍交系统浏览器', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://accounts.google.com/o/oauth2/auth',
        targetUrl: 'https://evil.example.com/',
        appOrigin
      })
    ).toEqual({ type: 'external', url: 'https://evil.example.com/' });
  });

  it('登录所需第三方域内也不放行非 http(s) 目标', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://accounts.google.com/o/oauth2/auth',
        targetUrl: 'file:///c:/secret.txt',
        appOrigin
      })
    ).toEqual({ type: 'block' });
  });

  it('登录完成后回到应用站点放行', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://accounts.google.com/o/oauth2/auth',
        targetUrl: 'https://www.airscend.com/login?code=abc',
        appOrigin
      })
    ).toEqual({ type: 'allow' });
  });

  it('登录页也不放行非 http(s)', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://www.airscend.com/login',
        targetUrl: 'file:///c:/secret.txt',
        appOrigin
      })
    ).toEqual({ type: 'block' });
  });

  it('非法目标地址阻止', () => {
    expect(
      decideMainWindowNavigation({
        currentUrl: 'https://www.airscend.com/chat',
        targetUrl: 'http://[bad',
        appOrigin
      })
    ).toEqual({ type: 'block' });
  });
});

describe('手动浏览网址校验', () => {
  it('任意 http(s) 允许', () => {
    expect(isManualBrowserUrlAllowed('https://www.google.com')).toBe(true);
    expect(isManualBrowserUrlAllowed('http://192.168.1.1')).toBe(true);
  });

  it('非 http(s) 拒绝', () => {
    expect(isManualBrowserUrlAllowed('file:///c:/a.html')).toBe(false);
    expect(isManualBrowserUrlAllowed('javascript:alert(1)')).toBe(false);
  });

  it('解析裸域名并补 https', () => {
    expect(parseManualBrowserUrl('www.gov.hk')).toBe('https://www.gov.hk/');
  });

  it('解析 localhost 地址', () => {
    expect(parseManualBrowserUrl('localhost:3210')).toBe('https://localhost:3210/');
  });

  it('解析失败返回 null', () => {
    expect(parseManualBrowserUrl('   ')).toBeNull();
    expect(parseManualBrowserUrl('file:///c:/a.html')).toBeNull();
  });
});
