import { describe, expect, it, vi } from 'vitest';
import {
  hasDesktopAiPlanEntitlement,
  isDesktopAiPlanActive,
  isDesktopAiPlanLevel
} from '@fastgpt/service/support/wallet/points/entitlement';

describe('desktop AI plan level', () => {
  it('accepts advanced tiers only', () => {
    expect(isDesktopAiPlanLevel('basic')).toBe(true);
    expect(isDesktopAiPlanLevel('advanced')).toBe(true);
    expect(isDesktopAiPlanLevel('custom')).toBe(true);
  });

  it('rejects free, experience and legacy tiers', () => {
    expect(isDesktopAiPlanLevel('free')).toBe(false);
    expect(isDesktopAiPlanLevel('experience')).toBe(false);
    expect(isDesktopAiPlanLevel('team')).toBe(false);
    expect(isDesktopAiPlanLevel('enterprise')).toBe(false);
    expect(isDesktopAiPlanLevel(undefined)).toBe(false);
    expect(isDesktopAiPlanLevel('')).toBe(false);
  });
});

describe('desktop AI plan activity', () => {
  const now = new Date('2026-10-30T00:00:00.000Z');

  it('accepts an unexpired advanced account', () => {
    expect(
      isDesktopAiPlanActive(
        { currentSubLevel: 'basic', expiredTime: new Date('2026-11-30T00:00:00.000Z') },
        now
      )
    ).toBe(true);
    expect(
      isDesktopAiPlanActive(
        { currentSubLevel: 'advanced', expiredTime: '2026-11-30T00:00:00.000Z' },
        now.getTime()
      )
    ).toBe(true);
  });

  it('rejects expired, missing expiry and non-advanced accounts', () => {
    expect(
      isDesktopAiPlanActive(
        { currentSubLevel: 'basic', expiredTime: new Date('2026-10-29T00:00:00.000Z') },
        now
      )
    ).toBe(false);
    expect(isDesktopAiPlanActive({ currentSubLevel: 'basic' }, now)).toBe(false);
    expect(
      isDesktopAiPlanActive(
        { currentSubLevel: 'free', expiredTime: new Date('2026-11-30T00:00:00.000Z') },
        now
      )
    ).toBe(false);
    expect(isDesktopAiPlanActive(null, now)).toBe(false);
  });
});

describe('desktop AI entitlement lookup', () => {
  it('reads the personal points account and allows entitled users', async () => {
    const readAccount = vi.fn(async () => ({
      currentSubLevel: 'basic',
      expiredTime: new Date('2026-11-30T00:00:00.000Z')
    }));

    await expect(
      hasDesktopAiPlanEntitlement(
        { tmbId: 'tmb-1' },
        { readAccount, now: new Date('2026-10-30T00:00:00.000Z') }
      )
    ).resolves.toBe(true);
    expect(readAccount).toHaveBeenCalledWith('tmb-1');
  });

  it('denies users without an account, without tmbId, or past expiry', async () => {
    await expect(
      hasDesktopAiPlanEntitlement({ tmbId: 'tmb-1' }, { readAccount: async () => null })
    ).resolves.toBe(false);
    await expect(
      hasDesktopAiPlanEntitlement(
        { tmbId: '' },
        { readAccount: async () => ({ currentSubLevel: 'basic' }) }
      )
    ).resolves.toBe(false);
    await expect(
      hasDesktopAiPlanEntitlement(
        { tmbId: 'tmb-1' },
        {
          readAccount: async () => ({
            currentSubLevel: 'basic',
            expiredTime: new Date('2026-10-01T00:00:00.000Z')
          }),
          now: new Date('2026-10-30T00:00:00.000Z')
        }
      )
    ).resolves.toBe(false);
  });
});
