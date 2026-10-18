import { describe, expect, it, vi } from 'vitest';
import { isManualBrowserNavigationAllowed } from '../src/main/navigation';
import {
  installNavigationGuard,
  type NavigationGuardContext,
  type NavigationGuardDecision
} from '../src/main/navigationGuard';

type GuardEvent = { preventDefault: () => void };
type RedirectListener = (
  event: GuardEvent,
  url: string,
  isInPlace?: boolean,
  isMainFrame?: boolean
) => void;

const createFakeTarget = () => {
  // 鲁港通 - will-redirect 的监听器签名包含帧信息，will-navigate 监听器可直接存入同一数组
  const listeners: { 'will-navigate': RedirectListener[]; 'will-redirect': RedirectListener[] } = {
    'will-navigate': [],
    'will-redirect': []
  };
  return {
    listeners,
    on: (event: 'will-navigate' | 'will-redirect', listener: RedirectListener) => {
      listeners[event].push(listener);
    }
  };
};

// 鲁港通 - 复刻主窗口 decide 语义：子帧只做协议校验且绝不外开，主帧走顶层判定并外开
const decideLikeMainWindow =
  (externalUrl: string) =>
  (url: string, context: NavigationGuardContext): NavigationGuardDecision => {
    if (!context.isMainFrame) {
      return isManualBrowserNavigationAllowed(url) ? { type: 'allow' } : { type: 'prevent' };
    }
    return { type: 'prevent', openExternal: externalUrl };
  };

describe('installNavigationGuard', () => {
  it('will-navigate 与 will-redirect 各注册一个 handler', () => {
    const target = createFakeTarget();
    installNavigationGuard({ target, decide: () => ({ type: 'allow' }) });

    expect(target.listeners['will-navigate']).toHaveLength(1);
    expect(target.listeners['will-redirect']).toHaveLength(1);
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

  it('决策函数收到实际目标地址与主帧上下文', () => {
    const target = createFakeTarget();
    const decide = vi.fn((): NavigationGuardDecision => ({ type: 'allow' }));
    installNavigationGuard({ target, decide });

    target.listeners['will-redirect'][0]({ preventDefault: vi.fn() }, 'https://example.com/');

    expect(decide).toHaveBeenCalledWith('https://example.com/', { isMainFrame: true });
  });

  it('will-redirect 子帧外站 https 既不拦截也不外开', () => {
    const target = createFakeTarget();
    const openExternal = vi.fn();
    const decide = vi.fn(decideLikeMainWindow('https://data.gov.hk/'));
    installNavigationGuard({ target, decide, openExternal });

    const event = { preventDefault: vi.fn() };
    target.listeners['will-redirect'][0](event, 'https://data.gov.hk/', false, false);

    expect(decide).toHaveBeenCalledWith('https://data.gov.hk/', { isMainFrame: false });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('will-redirect 子帧 javascript: 仍被拦截且不外开', () => {
    const target = createFakeTarget();
    const openExternal = vi.fn();
    const decide = vi.fn(decideLikeMainWindow('https://data.gov.hk/'));
    installNavigationGuard({ target, decide, openExternal });

    const event = { preventDefault: vi.fn() };
    target.listeners['will-redirect'][0](event, 'javascript:alert(1)', false, false);

    expect(decide).toHaveBeenCalledWith('javascript:alert(1)', { isMainFrame: false });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('will-navigate 一律按主帧处理', () => {
    const target = createFakeTarget();
    const openExternal = vi.fn();
    const decide = vi.fn(decideLikeMainWindow('https://data.gov.hk/'));
    installNavigationGuard({ target, decide, openExternal });

    const event = { preventDefault: vi.fn() };
    target.listeners['will-navigate'][0](event, 'https://www.airscend.com/chat');

    expect(decide).toHaveBeenCalledWith('https://www.airscend.com/chat', { isMainFrame: true });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(openExternal).toHaveBeenCalledWith('https://data.gov.hk/');
  });

  it('will-redirect 主帧仍执行顶层判定', () => {
    const target = createFakeTarget();
    const openExternal = vi.fn();
    const decide = vi.fn(decideLikeMainWindow('https://data.gov.hk/'));
    installNavigationGuard({ target, decide, openExternal });

    const event = { preventDefault: vi.fn() };
    target.listeners['will-redirect'][0](event, 'https://data.gov.hk/', false, true);

    expect(decide).toHaveBeenCalledWith('https://data.gov.hk/', { isMainFrame: true });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(openExternal).toHaveBeenCalledWith('https://data.gov.hk/');
  });
});
