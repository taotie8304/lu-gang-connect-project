import { describe, it, expect } from 'vitest';
import { resolveAboutEntry } from '@/pageComponents/about/aboutEntry';

describe('resolveAboutEntry', () => {
  it('asks for login when there is no user', () => {
    expect(resolveAboutEntry({})).toEqual({ kind: 'login' });
    expect(resolveAboutEntry({ defaultAppId: 'app-1' })).toEqual({ kind: 'login' });
  });

  it('sends root to the dashboard', () => {
    expect(resolveAboutEntry({ username: 'root', defaultAppId: 'app-1' })).toEqual({
      kind: 'href',
      href: '/dashboard/agent'
    });
  });

  it('sends a normal user with a default app into chat', () => {
    expect(resolveAboutEntry({ username: 'jinhui', defaultAppId: 'app-1' })).toEqual({
      kind: 'href',
      href: '/chat?appId=app-1&pane=ra'
    });
  });

  it('falls back to the dashboard for a normal user without a default app', () => {
    expect(resolveAboutEntry({ username: 'jinhui' })).toEqual({
      kind: 'href',
      href: '/dashboard/agent'
    });
  });
});
