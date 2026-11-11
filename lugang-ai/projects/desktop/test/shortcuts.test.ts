import { describe, expect, it } from 'vitest';
import { resolveBrowserShortcut } from '../src/main/browser/shortcuts';

const key = (value: string, extra: Partial<{ control: boolean; meta: boolean; alt: boolean }> = {}) =>
  resolveBrowserShortcut({ type: 'keyDown', key: value, ...extra });

describe('resolveBrowserShortcut', () => {
  it('Alt+左右键映射后退与前进', () => {
    expect(key('ArrowLeft', { alt: true })).toBe('back');
    expect(key('ArrowRight', { alt: true })).toBe('forward');
  });

  it('Ctrl 组合覆盖常用操作', () => {
    expect(key('f', { control: true })).toBe('find');
    expect(key('T', { control: true })).toBe('new-tab');
    expect(key('w', { meta: true })).toBe('close-tab');
    expect(key('L', { control: true })).toBe('focus-url');
    expect(key('r', { control: true })).toBe('reload');
    expect(key('p', { control: true })).toBe('print');
  });

  it('缩放覆盖主键盘与数字键盘按键名', () => {
    expect(key('=', { control: true })).toBe('zoom-in');
    expect(key('+', { control: true })).toBe('zoom-in');
    expect(key('add', { control: true })).toBe('zoom-in');
    expect(key('-', { control: true })).toBe('zoom-out');
    expect(key('_', { control: true })).toBe('zoom-out');
    expect(key('subtract', { control: true })).toBe('zoom-out');
    expect(key('0', { control: true })).toBe('zoom-reset');
  });

  it('忽略非按键按下、自动重复与无修饰键输入', () => {
    expect(resolveBrowserShortcut({ type: 'keyUp', key: 'f', control: true })).toBeNull();
    expect(
      resolveBrowserShortcut({ type: 'keyDown', key: 'f', control: true, isAutoRepeat: true })
    ).toBeNull();
    expect(key('f')).toBeNull();
    expect(key('ArrowLeft')).toBeNull();
  });

  it('Ctrl+Alt 混按不触发后退前进', () => {
    expect(key('ArrowLeft', { alt: true, control: true })).toBeNull();
  });
});
