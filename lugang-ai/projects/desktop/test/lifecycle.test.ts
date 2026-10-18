import { describe, expect, it } from 'vitest';
import { decideWindowCloseAction } from '../src/main/lifecycle';

describe('decideWindowCloseAction', () => {
  it('托盘可用时关闭窗口收进托盘', () => {
    expect(decideWindowCloseAction({ isQuitting: false, hasTray: true })).toBe('hide-to-tray');
  });

  it('退出流程中放行关闭', () => {
    expect(decideWindowCloseAction({ isQuitting: true, hasTray: true })).toBe('close');
  });

  it('托盘不可用时直接关闭，避免窗口藏起来后无法找回', () => {
    expect(decideWindowCloseAction({ isQuitting: false, hasTray: false })).toBe('close');
  });
});
