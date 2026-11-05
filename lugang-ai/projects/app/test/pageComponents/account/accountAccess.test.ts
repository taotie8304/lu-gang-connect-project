// 鲁港通 - 后台风格入口治理：普通用户不得进入 /account/*（FastGPT 后台风格页）
import { describe, expect, it } from 'vitest';
import { decideAccountAccess } from '@/pageComponents/account/accountAccess';

describe('decideAccountAccess', () => {
  it('sends a normal user to the chat page instead of the account page', () => {
    expect(
      decideAccountAccess({
        isUserInfoLoaded: true,
        showAdminFeatures: false,
        fallbackHref: '/chat?appId=abc&pane=ai'
      })
    ).toEqual({ type: 'redirect', href: '/chat?appId=abc&pane=ai' });
  });

  it('allows an admin to use the account page', () => {
    expect(
      decideAccountAccess({
        isUserInfoLoaded: true,
        showAdminFeatures: true,
        fallbackHref: '/chat?appId=abc&pane=ai'
      })
    ).toEqual({ type: 'allow' });
  });

  it('allows the page while userInfo is still loading, so the guard does not flash a redirect', () => {
    expect(
      decideAccountAccess({
        isUserInfoLoaded: false,
        showAdminFeatures: false,
        fallbackHref: '/chat?appId=abc&pane=ai'
      })
    ).toEqual({ type: 'allow' });
  });
});
