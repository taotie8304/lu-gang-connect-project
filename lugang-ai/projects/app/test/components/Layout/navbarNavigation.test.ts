// 鲁港通 - 顶栏跳转策略：一律同窗跳转，禁止 window.open（否则桌面客户端会弹出第二个窗口）
import { describe, expect, it } from 'vitest';
import { decideNavbarNavigation } from '@/components/Layout/navbarNavigation';

describe('decideNavbarNavigation', () => {
  it('navigates in the same window when leaving the portal chat page', () => {
    expect(
      decideNavbarNavigation({ href: '/chat?appId=abc&pane=ai', asPath: '/account/usage' })
    ).toEqual({ type: 'navigate', href: '/chat?appId=abc&pane=ai' });
  });

  it('navigates in the same window when entering the portal chat page', () => {
    expect(
      decideNavbarNavigation({ href: '/chat?appId=abc&pane=ai', asPath: '/dashboard/agent' })
    ).toEqual({ type: 'navigate', href: '/chat?appId=abc&pane=ai' });
  });

  it('does nothing when the item already points at the current page', () => {
    expect(
      decideNavbarNavigation({ href: '/chat?appId=abc&pane=ai', asPath: '/chat?appId=abc&pane=ai' })
    ).toEqual({ type: 'noop' });
  });
});
