import { describe, expect, it } from 'vitest';
import { canUseBuiltinBrowser } from '@/pageComponents/chat/builtinBrowser/visibility';

describe('canUseBuiltinBrowser', () => {
  it('手机端一律不可用', () => {
    expect(canUseBuiltinBrowser({ isPhone: true, username: 'root', isDesktop: true })).toBe(false);
  });

  it('网页端仅灰度名单可用', () => {
    expect(canUseBuiltinBrowser({ isPhone: false, username: 'root', isDesktop: false })).toBe(true);
    expect(canUseBuiltinBrowser({ isPhone: false, username: 'jinhui', isDesktop: false })).toBe(
      false
    );
  });

  it('桌面客户端登录用户均可用', () => {
    expect(canUseBuiltinBrowser({ isPhone: false, username: 'jinhui', isDesktop: true })).toBe(true);
  });

  it('未登录不可用', () => {
    expect(canUseBuiltinBrowser({ isPhone: false, username: undefined, isDesktop: true })).toBe(
      false
    );
  });
});
