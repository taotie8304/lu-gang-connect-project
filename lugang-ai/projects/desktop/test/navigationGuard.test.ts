import { describe, expect, it, vi } from 'vitest';
import { installNavigationGuard } from '../src/main/navigationGuard';

type GuardListener = (event: { preventDefault: () => void }, url: string) => void;

const createFakeTarget = () => {
  const listeners: Record<string, GuardListener[]> = {};
  return {
    listeners,
    on: (event: 'will-navigate' | 'will-redirect', listener: GuardListener) => {
      (listeners[event] ??= []).push(listener);
    }
  };
};

describe('installNavigationGuard', () => {
  it('will-navigate 与 will-redirect 注册同一个 handler', () => {
    const target = createFakeTarget();
    installNavigationGuard({ target, decide: () => ({ type: 'allow' }) });

    expect(target.listeners['will-navigate']).toHaveLength(1);
    expect(target.listeners['will-redirect']).toHaveLength(1);
    expect(target.listeners['will-navigate'][0]).toBe(target.listeners['will-redirect'][0]);
  });

  it('will-redirect 触发 prevent 决策时阻止重定向并交系统浏览器', () => {
    const target = createFakeTarget();
    const openExternal = vi.fn();
    installNavigationGuard({
      target,
      decide: () => ({ type: 'prevent', openExternal: 'https://data.gov.hk/' }),
      openExternal
    });

    const event = { preventDefault: vi.fn() };
    target.listeners['will-redirect'][0](event, 'https://data.gov.hk/');

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(openExternal).toHaveBeenCalledWith('https://data.gov.hk/');
  });

  it('allow 决策不调用 preventDefault', () => {
    const target = createFakeTarget();
    const openExternal = vi.fn();
    installNavigationGuard({ target, decide: () => ({ type: 'allow' }), openExternal });

    const event = { preventDefault: vi.fn() };
    target.listeners['will-redirect'][0](event, 'https://www.airscend.com/chat');

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('will-navigate 触发 prevent 决策同样生效', () => {
    const target = createFakeTarget();
    const openExternal = vi.fn();
    installNavigationGuard({
      target,
      decide: () => ({ type: 'prevent', openExternal: 'https://data.gov.hk/' }),
      openExternal
    });

    const event = { preventDefault: vi.fn() };
    target.listeners['will-navigate'][0](event, 'https://www.airscend.com/chat');

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(openExternal).toHaveBeenCalledWith('https://data.gov.hk/');
  });

  it('prevent 但不外开时只阻止导航', () => {
    const target = createFakeTarget();
    const openExternal = vi.fn();
    installNavigationGuard({
      target,
      decide: () => ({ type: 'prevent' }),
      openExternal
    });

    const event = { preventDefault: vi.fn() };
    target.listeners['will-navigate'][0](event, 'file:///c:/secret.txt');

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('决策函数收到实际目标地址', () => {
    const target = createFakeTarget();
    const decide = vi.fn(() => ({ type: 'allow' as const }));
    installNavigationGuard({ target, decide });

    target.listeners['will-redirect'][0]({ preventDefault: vi.fn() }, 'https://example.com/');

    expect(decide).toHaveBeenCalledWith('https://example.com/');
  });
});
