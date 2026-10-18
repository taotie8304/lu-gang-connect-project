import { afterEach, describe, expect, it } from 'vitest';
import { isDesktopBridgeAvailable } from '@/pageComponents/chat/builtinBrowser/desktopBridge';

afterEach(() => {
  delete window.lugangDesktop;
});

describe('isDesktopBridgeAvailable', () => {
  it('没有桥时为 false', () => {
    expect(isDesktopBridgeAvailable()).toBe(false);
  });

  it('桥报告可用时为 true', () => {
    window.lugangDesktop = { isAvailable: () => true } as never;
    expect(isDesktopBridgeAvailable()).toBe(true);
  });

  it('桥报告不可用时为 false', () => {
    window.lugangDesktop = { isAvailable: () => false } as never;
    expect(isDesktopBridgeAvailable()).toBe(false);
  });
});
