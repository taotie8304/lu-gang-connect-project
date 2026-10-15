// 鲁港通 - 办事浏览器设备判定单测（内置浏览器 P1）：
// 口径：手机（网页与未来手机 App）不开放；iPad/平板与 PC/Mac 桌面（网页与客户端）可用
import { describe, expect, it } from 'vitest';
import { isPhoneUserAgent } from '@/pageComponents/chat/builtinBrowser/device';

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  harmonyPhone:
    'Mozilla/5.0 (Phone; OpenHarmony 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 ArkWeb/4.1.6.1 Mobile',
  ipad:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

describe('isPhoneUserAgent', () => {
  it('iPhone / Android 手机 / 鸿蒙手机：判定为手机', () => {
    expect(isPhoneUserAgent(UA.iphone)).toBe(true);
    expect(isPhoneUserAgent(UA.androidPhone)).toBe(true);
    expect(isPhoneUserAgent(UA.harmonyPhone)).toBe(true);
  });

  it('iPad（含新款伪装桌面 UA）：不判定为手机', () => {
    expect(isPhoneUserAgent(UA.ipad)).toBe(false);
    expect(isPhoneUserAgent(UA.ipadDesktopMode)).toBe(false);
  });

  it('Android 平板 / Mac / Windows 桌面：不判定为手机', () => {
    expect(isPhoneUserAgent(UA.androidTablet)).toBe(false);
    expect(isPhoneUserAgent(UA.mac)).toBe(false);
    expect(isPhoneUserAgent(UA.windows)).toBe(false);
  });
});
