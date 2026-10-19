import { describe, expect, it, vi } from 'vitest';
import { performLogout } from '@/web/support/user/logout';

const createDeps = (events: string[] = [], desktop = true) => ({
  closeBrowserPanel: vi.fn(() => {
    events.push('closeBrowserPanel');
  }),
  clearDesktopSession: desktop
    ? vi.fn(() => {
        events.push('clearDesktopSession');
      })
    : undefined,
  resetChatCache: vi.fn(() => {
    events.push('resetChatCache');
  }),
  clearUserInfo: vi.fn(() => {
    events.push('clearUserInfo');
  }),
  clearToken: vi.fn(() => {
    events.push('clearToken');
  }),
  redirectToLogin: vi.fn(() => {
    events.push('redirectToLogin');
  })
});

describe('performLogout', () => {
  it('runs the full cleanup in order for the desktop client', () => {
    const events: string[] = [];
    const deps = createDeps(events);

    performLogout(deps);

    expect(events).toEqual([
      'closeBrowserPanel',
      'clearDesktopSession',
      'resetChatCache',
      'clearUserInfo',
      'clearToken',
      'redirectToLogin'
    ]);
  });

  it('revokes the desktop device before clearing the login token', () => {
    const events: string[] = [];
    const deps = createDeps(events);

    performLogout(deps);

    expect(events.indexOf('clearDesktopSession')).toBeLessThan(events.indexOf('clearToken'));
  });

  it('leaves the browser panel and device session untouched in the web client', () => {
    const deps = createDeps([], false);

    performLogout({ ...deps, closeBrowserPanel: undefined, clearDesktopSession: undefined });

    expect(deps.closeBrowserPanel).not.toHaveBeenCalled();
    expect(deps.resetChatCache).toHaveBeenCalledTimes(1);
    expect(deps.clearUserInfo).toHaveBeenCalledTimes(1);
    expect(deps.clearToken).toHaveBeenCalledTimes(1);
    expect(deps.redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('continues the cleanup when closing the browser panel throws', () => {
    const events: string[] = [];
    const deps = createDeps(events);
    deps.closeBrowserPanel.mockImplementation(() => {
      throw new Error('bridge destroyed');
    });

    expect(() => performLogout(deps)).not.toThrow();

    expect(events).toEqual([
      'clearDesktopSession',
      'resetChatCache',
      'clearUserInfo',
      'clearToken',
      'redirectToLogin'
    ]);
    expect(deps.redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('continues the cleanup when closing the browser panel rejects', async () => {
    const events: string[] = [];
    const deps = createDeps(events);
    deps.closeBrowserPanel.mockImplementation(() => Promise.reject(new Error('ipc closed')));

    expect(() => performLogout(deps)).not.toThrow();
    await Promise.resolve();

    expect(events).toEqual([
      'clearDesktopSession',
      'resetChatCache',
      'clearUserInfo',
      'clearToken',
      'redirectToLogin'
    ]);
    expect(deps.redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('continues the cleanup when revoking the device session throws', () => {
    const events: string[] = [];
    const deps = createDeps(events);
    deps.clearDesktopSession!.mockImplementation(() => {
      throw new Error('ipc unavailable');
    });

    expect(() => performLogout(deps)).not.toThrow();

    expect(events).toEqual([
      'closeBrowserPanel',
      'resetChatCache',
      'clearUserInfo',
      'clearToken',
      'redirectToLogin'
    ]);
    expect(deps.redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('continues the cleanup when revoking the device session rejects', async () => {
    const events: string[] = [];
    const deps = createDeps(events);
    deps.clearDesktopSession!.mockImplementation(() => Promise.reject(new Error('revoke failed')));

    expect(() => performLogout(deps)).not.toThrow();
    await Promise.resolve();

    expect(events).toEqual([
      'closeBrowserPanel',
      'resetChatCache',
      'clearUserInfo',
      'clearToken',
      'redirectToLogin'
    ]);
    expect(deps.redirectToLogin).toHaveBeenCalledTimes(1);
  });
});
