import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestInputParseError } from '@fastgpt/service/common/zod/requestParseError';

const mocks = vi.hoisted(() => ({
  authCert: vi.fn(),
  readDesktopSwitchState: vi.fn(),
  saveDesktopSwitch: vi.fn()
}));

vi.mock('@/service/middleware/entry', () => ({
  NextAPI: (handler: unknown) => handler
}));

vi.mock('@fastgpt/service/support/permission/auth/common', () => ({
  authCert: mocks.authCert
}));

vi.mock('@fastgpt/service/support/desktopCommand/settingsStore', () => ({
  readDesktopSwitchState: mocks.readDesktopSwitchState,
  saveDesktopSwitch: mocks.saveDesktopSwitch
}));

import settingsHandler from '@/pages/api/proApi/desktop/admin/settings';

const rootIdentity = { userId: 'user-root', teamId: 'team-1', tmbId: 'tmb-1', isRoot: true };
const memberIdentity = { userId: 'user-1', teamId: 'team-1', tmbId: 'tmb-2', isRoot: false };
const state = { mode: 'all', accounts: [], source: 'env' };
const createRes = () => ({ setHeader: vi.fn() }) as any;

describe('/api/proApi/desktop/admin/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authCert.mockResolvedValue(rootIdentity);
    mocks.readDesktopSwitchState.mockResolvedValue(state);
  });

  it('rejects members who are not root', async () => {
    mocks.authCert.mockResolvedValue(memberIdentity);
    const req = { method: 'GET' } as any;

    await expect(settingsHandler(req, createRes())).rejects.toThrow('仅管理员可以调整 AI 操控开关');
    expect(mocks.readDesktopSwitchState).not.toHaveBeenCalled();
    expect(mocks.saveDesktopSwitch).not.toHaveBeenCalled();
  });

  it('returns the current effective switch on GET', async () => {
    const req = { method: 'GET' } as any;

    await expect(settingsHandler(req, createRes())).resolves.toEqual(state);
    expect(mocks.readDesktopSwitchState).toHaveBeenCalledTimes(1);
  });

  it('normalizes and saves the switch on POST', async () => {
    const req = {
      method: 'POST',
      body: { mode: 'list', accounts: [' Jinhui@Airscend.com ', 'jinhui@airscend.com', 'tmb-1'] }
    } as any;

    await expect(settingsHandler(req, createRes())).resolves.toEqual(state);
    expect(mocks.saveDesktopSwitch).toHaveBeenCalledWith({
      mode: 'list',
      accounts: ['jinhui@airscend.com', 'tmb-1'],
      updatedBy: 'user-root'
    });
  });

  it('drops stale accounts when switching to all or off', async () => {
    const req = { method: 'POST', body: { mode: 'off', accounts: ['jinhui@airscend.com'] } } as any;

    await settingsHandler(req, createRes());

    expect(mocks.saveDesktopSwitch).toHaveBeenCalledWith({
      mode: 'off',
      accounts: [],
      updatedBy: 'user-root'
    });
  });

  it('rejects an unknown mode or an unsupported method', async () => {
    await expect(
      settingsHandler({ method: 'POST', body: { mode: 'half' } } as any, createRes())
    ).rejects.toBeInstanceOf(ApiRequestInputParseError);

    await expect(settingsHandler({ method: 'DELETE' } as any, createRes())).rejects.toThrow(
      '请求方法不支持'
    );
    expect(mocks.saveDesktopSwitch).not.toHaveBeenCalled();
  });
});
