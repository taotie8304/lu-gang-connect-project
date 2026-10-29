import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestInputParseError } from '@fastgpt/service/common/zod/requestParseError';

const mocks = vi.hoisted(() => ({
  authCert: vi.fn(),
  listDesktopDevices: vi.fn(),
  revokeDesktopDevice: vi.fn(),
  findMembers: vi.fn()
}));

vi.mock('@/service/middleware/entry', () => ({
  NextAPI: (handler: unknown) => handler
}));

vi.mock('@fastgpt/service/support/permission/auth/common', () => ({
  authCert: mocks.authCert
}));

vi.mock('@fastgpt/service/support/desktopCommand/store', () => ({
  listDesktopDevices: mocks.listDesktopDevices,
  revokeDesktopDevice: mocks.revokeDesktopDevice
}));

vi.mock('@fastgpt/service/support/user/team/teamMemberSchema', () => ({
  MongoTeamMember: {
    find: mocks.findMembers
  }
}));

import userDevicesHandler from '@/pages/api/proApi/desktop/devices/index';
import userUnbindHandler from '@/pages/api/proApi/desktop/devices/unbind';
import adminDevicesHandler from '@/pages/api/proApi/desktop/admin/devices/index';
import adminUnbindHandler from '@/pages/api/proApi/desktop/admin/devices/unbind';

const deviceId = 'device_12345678';
const identity = { userId: 'user-1', teamId: 'team-1', tmbId: 'tmb-1', isRoot: false };
const device = {
  deviceId,
  deviceName: '办公电脑',
  appVersion: '0.8.9',
  tmbId: 'tmb-1',
  online: true,
  registeredAt: 1_700_000_000_000
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
  mocks.listDesktopDevices.mockResolvedValue([device]);
  mocks.revokeDesktopDevice.mockResolvedValue(true);
  mockMembers([{ _id: 'tmb-1', name: '金辉' }]);
});

describe('GET /api/proApi/desktop/devices', () => {
  it('lists only the devices of the authenticated member', async () => {
    const req = { method: 'GET' } as any;

    await expect(userDevicesHandler(req, createRes())).resolves.toEqual({ devices: [device] });

    expect(mocks.authCert).toHaveBeenCalledWith({ req, authToken: true });
    expect(mocks.listDesktopDevices).toHaveBeenCalledWith({ tmbId: 'tmb-1' });
  });

  it('rejects methods other than GET', async () => {
    const req = { method: 'POST' } as any;

    await expect(userDevicesHandler(req, createRes())).rejects.toThrow('请求方法不支持');
    expect(mocks.listDesktopDevices).not.toHaveBeenCalled();
  });
});

describe('POST /api/proApi/desktop/devices/unbind', () => {
  it('unbinds the device for its owner', async () => {
    const req = { method: 'POST', body: { deviceId } } as any;

    await expect(userUnbindHandler(req, createRes())).resolves.toEqual({ revoked: true });

    expect(mocks.authCert).toHaveBeenCalledWith({ req, authToken: true });
    expect(mocks.revokeDesktopDevice).toHaveBeenCalledWith({ deviceId, tmbId: 'tmb-1' });
  });

  it('reports devices owned by someone else as not revoked', async () => {
    mocks.revokeDesktopDevice.mockResolvedValue(false);
    const req = { method: 'POST', body: { deviceId } } as any;

    await expect(userUnbindHandler(req, createRes())).resolves.toEqual({ revoked: false });
  });

  it('rejects a malformed device id before authenticating', async () => {
    const req = { method: 'POST', body: { deviceId: 'short' } } as any;

    await expect(userUnbindHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
    expect(mocks.authCert).not.toHaveBeenCalled();
    expect(mocks.revokeDesktopDevice).not.toHaveBeenCalled();
  });

  it('rejects methods other than POST', async () => {
    const req = { method: 'GET', body: { deviceId } } as any;

    await expect(userUnbindHandler(req, createRes())).rejects.toThrow('请求方法不支持');
  });
});

describe('GET /api/proApi/desktop/admin/devices', () => {
  it('rejects members without the root role', async () => {
    const req = { method: 'GET' } as any;

    await expect(adminDevicesHandler(req, createRes())).rejects.toThrow(
      '仅管理员可以查看桌面设备'
    );
    expect(mocks.listDesktopDevices).not.toHaveBeenCalled();
  });

  it('lists all devices with member names for root', async () => {
    mocks.authCert.mockResolvedValue({ ...identity, isRoot: true });
    mocks.listDesktopDevices.mockResolvedValue([
      device,
      { ...device, deviceId: 'device_22222222', tmbId: 'tmb-2' }
    ]);
    mockMembers([{ _id: 'tmb-1', name: '金辉' }]);
    const req = { method: 'GET' } as any;

    await expect(adminDevicesHandler(req, createRes())).resolves.toEqual({
      devices: [
        { ...device, memberName: '金辉' },
        { ...device, deviceId: 'device_22222222', tmbId: 'tmb-2' }
      ]
    });

    expect(mocks.listDesktopDevices).toHaveBeenCalledWith();
    expect(mocks.findMembers).toHaveBeenCalledWith({
      _id: { $in: ['tmb-1', 'tmb-2'] }
    });
  });

  it('skips the member lookup when no device is registered', async () => {
    mocks.authCert.mockResolvedValue({ ...identity, isRoot: true });
    mocks.listDesktopDevices.mockResolvedValue([]);
    const req = { method: 'GET' } as any;

    await expect(adminDevicesHandler(req, createRes())).resolves.toEqual({ devices: [] });
    expect(mocks.findMembers).not.toHaveBeenCalled();
  });
});

describe('POST /api/proApi/desktop/admin/devices/unbind', () => {
  it('rejects members without the root role', async () => {
    const req = { method: 'POST', body: { deviceId } } as any;

    await expect(adminUnbindHandler(req, createRes())).rejects.toThrow(
      '仅管理员可以解绑桌面设备'
    );
    expect(mocks.revokeDesktopDevice).not.toHaveBeenCalled();
  });

  it('force unbinds any device for root', async () => {
    mocks.authCert.mockResolvedValue({ ...identity, isRoot: true });
    const req = { method: 'POST', body: { deviceId } } as any;

    await expect(adminUnbindHandler(req, createRes())).resolves.toEqual({ revoked: true });
    expect(mocks.revokeDesktopDevice).toHaveBeenCalledWith({ deviceId });
  });

  it('reports unknown devices as not revoked', async () => {
    mocks.authCert.mockResolvedValue({ ...identity, isRoot: true });
    mocks.revokeDesktopDevice.mockResolvedValue(false);
    const req = { method: 'POST', body: { deviceId } } as any;

    await expect(adminUnbindHandler(req, createRes())).resolves.toEqual({ revoked: false });
  });

  it('rejects a malformed device id before authenticating', async () => {
    mocks.authCert.mockResolvedValue({ ...identity, isRoot: true });
    const req = { method: 'POST', body: { deviceId: 'short' } } as any;

    await expect(adminUnbindHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
    expect(mocks.authCert).not.toHaveBeenCalled();
  });
});
