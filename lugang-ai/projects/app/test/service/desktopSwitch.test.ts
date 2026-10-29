import { describe, expect, it, vi } from 'vitest';
import {
  buildDesktopSwitchConfig,
  desktopRawToSwitch,
  desktopSwitchToRaw,
  desktopSwitchToState,
  isDesktopBrowserEnabledForUserAsync,
  normalizeDesktopSwitchAccounts
} from '@fastgpt/service/support/desktopCommand/settings';

const identity = {
  tmbId: 'tmb-1',
  uid: 'uid-1',
  username: 'jinhui',
  contact: 'jinhui@airscend.com'
};

describe('desktop switch mapping', () => {
  it('maps switch modes to the raw value understood by the env gate', () => {
    expect(desktopSwitchToRaw({ mode: 'off', accounts: [] })).toBe('off');
    expect(desktopSwitchToRaw({ mode: 'all', accounts: [] })).toBe('all');
    expect(
      desktopSwitchToRaw({
        mode: 'list',
        accounts: ['jinhui@airscend.com', 'tmb-1']
      })
    ).toBe('jinhui@airscend.com,tmb-1');
  });

  it('maps legacy env values back to a switch config for display', () => {
    expect(desktopRawToSwitch(undefined)).toEqual({ mode: 'off', accounts: [] });
    expect(desktopRawToSwitch('')).toEqual({ mode: 'off', accounts: [] });
    expect(desktopRawToSwitch('false')).toEqual({ mode: 'off', accounts: [] });
    expect(desktopRawToSwitch('all')).toEqual({ mode: 'all', accounts: [] });
    expect(desktopRawToSwitch('*')).toEqual({ mode: 'all', accounts: [] });
    expect(desktopRawToSwitch('A@x.com, b@y.com,a@x.com')).toEqual({
      mode: 'list',
      accounts: ['a@x.com', 'b@y.com']
    });
  });

  it('normalizes accounts by trimming, lowercasing and deduplicating', () => {
    expect(normalizeDesktopSwitchAccounts([' Jinhui@Airscend.com ', '', 'jinhui@airscend.com', 'tmb-1'])).toEqual(
      ['jinhui@airscend.com', 'tmb-1']
    );
  });

  it('clears the account list outside list mode', () => {
    expect(buildDesktopSwitchConfig({ mode: 'all', accounts: ['a@x.com'] })).toEqual({
      mode: 'all',
      accounts: []
    });
    expect(buildDesktopSwitchConfig({ mode: 'off' })).toEqual({ mode: 'off', accounts: [] });
    expect(buildDesktopSwitchConfig({ mode: 'list', accounts: ['A@X.com', 'a@x.com'] })).toEqual({
      mode: 'list',
      accounts: ['a@x.com']
    });
  });
});

describe('desktop switch state', () => {
  it('falls back to the environment variable when no database record exists', () => {
    expect(desktopSwitchToState({ envRaw: 'all' })).toEqual({ mode: 'all', accounts: [], source: 'env' });
    expect(desktopSwitchToState({ envRaw: undefined })).toEqual({
      mode: 'off',
      accounts: [],
      source: 'env'
    });
  });

  it('prefers the database record and returns its metadata', () => {
    const updatedAt = new Date('2026-10-29T08:00:00.000Z');
    expect(
      desktopSwitchToState({
        record: {
          mode: 'list',
          accounts: ['Jinhui@Airscend.com', 'jinhui@airscend.com'],
          updatedAt,
          updatedBy: 'root'
        },
        envRaw: 'off'
      })
    ).toEqual({
      mode: 'list',
      accounts: ['jinhui@airscend.com'],
      source: 'database',
      updatedAt: updatedAt.getTime(),
      updatedBy: 'root'
    });
  });
});

describe('desktop browser gate with database switch', () => {
  it('lets the database switch override the environment variable', async () => {
    await expect(
      isDesktopBrowserEnabledForUserAsync(identity, {
        read: async () => ({ mode: 'off', accounts: [] }),
        envRaw: 'all'
      })
    ).resolves.toBe(false);
    await expect(
      isDesktopBrowserEnabledForUserAsync(identity, {
        read: async () => ({ mode: 'all', accounts: [] }),
        envRaw: 'off'
      })
    ).resolves.toBe(true);
  });

  it('only enables listed accounts in list mode', async () => {
    const read = async () => ({ mode: 'list' as const, accounts: ['jinhui@airscend.com'] });

    await expect(
      isDesktopBrowserEnabledForUserAsync(identity, { read, envRaw: 'off' })
    ).resolves.toBe(true);
    await expect(
      isDesktopBrowserEnabledForUserAsync({ ...identity, contact: 'other@example.com' }, { read, envRaw: 'all' })
    ).resolves.toBe(false);
  });

  it('treats an empty list as switched off', async () => {
    await expect(
      isDesktopBrowserEnabledForUserAsync(identity, {
        read: async () => ({ mode: 'list', accounts: [] }),
        envRaw: 'all'
      })
    ).resolves.toBe(false);
  });

  it('falls back to the environment variable when no record exists or the read fails', async () => {
    await expect(
      isDesktopBrowserEnabledForUserAsync(identity, { read: async () => undefined, envRaw: 'all' })
    ).resolves.toBe(true);
    await expect(
      isDesktopBrowserEnabledForUserAsync(identity, {
        read: async () => {
          throw new Error('mongo down');
        },
        envRaw: 'all'
      })
    ).resolves.toBe(true);
    await expect(
      isDesktopBrowserEnabledForUserAsync(identity, { read: async () => undefined, envRaw: undefined })
    ).resolves.toBe(false);
  });

  it('always keeps the root account enabled without reading the switch', async () => {
    const read = vi.fn(async () => ({ mode: 'off' as const, accounts: [] }));

    await expect(
      isDesktopBrowserEnabledForUserAsync({ ...identity, username: 'root' }, { read, envRaw: 'off' })
    ).resolves.toBe(true);
    expect(read).not.toHaveBeenCalled();
  });
});
