import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestInputParseError } from '@fastgpt/service/common/zod/requestParseError';

const mocks = vi.hoisted(() => ({
  authCert: vi.fn(),
  authenticateDesktopDevice: vi.fn(),
  saveDesktopCrashReports: vi.fn(),
  listDesktopCrashReports: vi.fn(),
  findMembers: vi.fn()
}));

vi.mock('@/service/middleware/entry', () => ({
  NextAPI: (handler: unknown) => handler
}));

vi.mock('@fastgpt/service/support/permission/auth/common', () => ({
  authCert: mocks.authCert
}));

vi.mock('@fastgpt/service/support/desktopCommand/store', () => ({
  authenticateDesktopDevice: mocks.authenticateDesktopDevice
}));

vi.mock('@fastgpt/service/support/desktopCommand/crashReportStore', () => ({
  saveDesktopCrashReports: mocks.saveDesktopCrashReports,
  listDesktopCrashReports: mocks.listDesktopCrashReports
}));

vi.mock('@fastgpt/service/support/user/team/teamMemberSchema', () => ({
  MongoTeamMember: {
    find: mocks.findMembers
  }
}));

import diagnosticsHandler from '@/pages/api/proApi/desktop/diagnostics';
import crashesHandler from '@/pages/api/proApi/desktop/admin/crashes';

const deviceId = 'device_12345678';
const session = { deviceId, tmbId: 'tmb-1', userId: 'user-1', teamId: 'team-1' };
const identity = { userId: 'user-1', teamId: 'team-1', tmbId: 'tmb-1', isRoot: false };

const report = {
  type: 'uncaught-exception',
  message: 'TypeError: boom',
  stack: 'at main.js:1:1',
  occurredAt: 1_760_000_000_000
};

const createRes = () => ({ setHeader: vi.fn() }) as any;

const mockMembers = (members: Array<{ _id: string; name: string }>) => {
  mocks.findMembers.mockReturnValue({
    select: () => ({ lean: async () => members })
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authCert.mockResolvedValue(identity);
  mocks.authenticateDesktopDevice.mockResolvedValue(session);
  mocks.saveDesktopCrashReports.mockResolvedValue(1);
  mocks.listDesktopCrashReports.mockResolvedValue([]);
  mockMembers([]);
});

describe('POST /api/proApi/desktop/diagnostics', () => {
  const body = {
    deviceId,
    deviceName: '办公电脑',
    appVersion: '0.8.9',
    platform: 'win32 10.0.19045',
    reports: [report]
  };

  it('stores sanitized reports under the authenticated device identity', async () => {
    const req = {
      method: 'POST',
      body,
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(diagnosticsHandler(req, createRes())).resolves.toEqual({ accepted: 1 });

    expect(mocks.authenticateDesktopDevice).toHaveBeenCalledWith({
      deviceId,
      authorization: 'Bearer lgd_token'
    });
    expect(mocks.saveDesktopCrashReports).toHaveBeenCalledWith({
      deviceId,
      deviceName: '办公电脑',
      appVersion: '0.8.9',
      platform: 'win32 10.0.19045',
      tmbId: 'tmb-1',
      uid: 'user-1',
      reports: [report]
    });
  });

  it('rejects more than three reports in one upload', async () => {
    const req = {
      method: 'POST',
      body: { ...body, reports: [report, report, report, report] },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(diagnosticsHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
    expect(mocks.authenticateDesktopDevice).not.toHaveBeenCalled();
    expect(mocks.saveDesktopCrashReports).not.toHaveBeenCalled();
  });

  it('rejects an unknown crash type', async () => {
    const req = {
      method: 'POST',
      body: { ...body, reports: [{ ...report, type: 'segfault' }] },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(diagnosticsHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
    expect(mocks.saveDesktopCrashReports).not.toHaveBeenCalled();
  });

  it('does not store when device authentication fails', async () => {
    mocks.authenticateDesktopDevice.mockRejectedValue(new Error('unAuthorization'));
    const req = {
      method: 'POST',
      body,
      headers: { authorization: 'Bearer lgd_bad' }
    } as any;

    await expect(diagnosticsHandler(req, createRes())).rejects.toThrow('unAuthorization');
    expect(mocks.saveDesktopCrashReports).not.toHaveBeenCalled();
  });

  it('rejects methods other than POST', async () => {
    const req = { method: 'GET', body, headers: {} } as any;

    await expect(diagnosticsHandler(req, createRes())).rejects.toThrow('请求方法不支持');
  });
});

describe('GET /api/proApi/desktop/admin/crashes', () => {
  const crash = {
    id: 'report-1',
    deviceId,
    deviceName: '办公电脑',
    tmbId: 'tmb-1',
    appVersion: '0.8.9',
    platform: 'win32 10.0.19045',
    type: 'uncaught-exception',
    message: 'TypeError: boom',
    occurredAt: 1_760_000_000_000,
    createdAt: 1_760_000_100_000
  };

  it('rejects members without the root role', async () => {
    const req = { method: 'GET' } as any;

    await expect(crashesHandler(req, createRes())).rejects.toThrow(
      '仅管理员可以查看崩溃报告'
    );
    expect(mocks.listDesktopCrashReports).not.toHaveBeenCalled();
  });

  it('returns the latest reports with member names for root', async () => {
    mocks.authCert.mockResolvedValue({ ...identity, isRoot: true });
    mocks.listDesktopCrashReports.mockResolvedValue([crash]);
    mockMembers([{ _id: 'tmb-1', name: '金辉' }]);
    const req = { method: 'GET' } as any;

    await expect(crashesHandler(req, createRes())).resolves.toEqual({
      reports: [{ ...crash, memberName: '金辉' }]
    });

    expect(mocks.listDesktopCrashReports).toHaveBeenCalledWith({ limit: 50 });
  });

  it('skips the member lookup when there is no report', async () => {
    mocks.authCert.mockResolvedValue({ ...identity, isRoot: true });
    const req = { method: 'GET' } as any;

    await expect(crashesHandler(req, createRes())).resolves.toEqual({ reports: [] });
    expect(mocks.findMembers).not.toHaveBeenCalled();
  });

  it('rejects methods other than GET', async () => {
    mocks.authCert.mockResolvedValue({ ...identity, isRoot: true });
    const req = { method: 'POST' } as any;

    await expect(crashesHandler(req, createRes())).rejects.toThrow('请求方法不支持');
  });
});
