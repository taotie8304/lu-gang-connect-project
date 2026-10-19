import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestInputParseError } from '@fastgpt/service/common/zod/requestParseError';

const mocks = vi.hoisted(() => ({
  authCert: vi.fn(),
  registerDesktopDevice: vi.fn(),
  authenticateDesktopDevice: vi.fn(),
  waitForDesktopCommand: vi.fn(),
  saveDesktopCommandResult: vi.fn(),
  revokeDesktopDevice: vi.fn()
}));

vi.mock('@/service/middleware/entry', () => ({
  NextAPI: (handler: unknown) => handler
}));

vi.mock('@fastgpt/service/support/permission/auth/common', () => ({
  authCert: mocks.authCert
}));

vi.mock('@fastgpt/service/support/desktopCommand/store', () => ({
  registerDesktopDevice: mocks.registerDesktopDevice,
  authenticateDesktopDevice: mocks.authenticateDesktopDevice,
  waitForDesktopCommand: mocks.waitForDesktopCommand,
  saveDesktopCommandResult: mocks.saveDesktopCommandResult,
  revokeDesktopDevice: mocks.revokeDesktopDevice
}));

import registerHandler from '@/pages/api/proApi/desktop/register';
import commandsHandler from '@/pages/api/proApi/desktop/commands';
import resultHandler from '@/pages/api/proApi/desktop/result';
import revokeHandler from '@/pages/api/proApi/desktop/revoke';

const deviceId = 'device_12345678';
const commandId = '0f0f0f0f-1111-4222-8333-444444444444';
const identity = {
  userId: 'user-1',
  teamId: 'team-1',
  tmbId: 'tmb-1'
};
const envelope = {
  id: commandId,
  createdAt: 1_700_000_000_000,
  command: { action: 'browser.snapshot' }
};

const createRes = () => ({ setHeader: vi.fn() }) as any;

describe('POST /api/proApi/desktop/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authCert.mockResolvedValue(identity);
    mocks.registerDesktopDevice.mockResolvedValue({
      token: 'lgd_new-token',
      expiresInMs: 1000
    });
  });

  it('registers the device for the authenticated member', async () => {
    const req = {
      method: 'POST',
      body: { deviceId, deviceName: '办公电脑', appVersion: '0.2.0' }
    } as any;

    await expect(registerHandler(req, createRes())).resolves.toEqual({
      token: 'lgd_new-token',
      expiresInMs: 1000
    });

    expect(mocks.authCert).toHaveBeenCalledWith({ req, authToken: true });
    expect(mocks.registerDesktopDevice).toHaveBeenCalledWith({
      deviceId,
      deviceName: '办公电脑',
      appVersion: '0.2.0',
      ...identity
    });
  });

  it('accepts registrations without optional device metadata', async () => {
    const req = { method: 'POST', body: { deviceId } } as any;

    await registerHandler(req, createRes());

    expect(mocks.registerDesktopDevice).toHaveBeenCalledWith({
      deviceId,
      deviceName: undefined,
      appVersion: undefined,
      ...identity
    });
  });

  it('rejects an invalid device id before authenticating', async () => {
    const req = { method: 'POST', body: { deviceId: 'short' } } as any;

    await expect(registerHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
    expect(mocks.authCert).not.toHaveBeenCalled();
    expect(mocks.registerDesktopDevice).not.toHaveBeenCalled();
  });

  it('rejects methods other than POST', async () => {
    const req = { method: 'GET', body: { deviceId } } as any;

    await expect(registerHandler(req, createRes())).rejects.toThrow('请求方法不支持');
    expect(mocks.registerDesktopDevice).not.toHaveBeenCalled();
  });
});

describe('GET /api/proApi/desktop/commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateDesktopDevice.mockResolvedValue({ ...identity, deviceId });
    mocks.waitForDesktopCommand.mockResolvedValue(envelope);
  });

  it('returns the next command for the authenticated device', async () => {
    const req = {
      method: 'GET',
      query: { deviceId, timeoutMs: '1200' },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;
    const res = createRes();

    await expect(commandsHandler(req, res)).resolves.toEqual({ command: envelope });

    expect(mocks.authenticateDesktopDevice).toHaveBeenCalledWith({
      deviceId,
      authorization: 'Bearer lgd_token'
    });
    expect(mocks.waitForDesktopCommand).toHaveBeenCalledWith({ deviceId, timeoutMs: 1200 });
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('uses the default long poll timeout and returns null when idle', async () => {
    mocks.waitForDesktopCommand.mockResolvedValue(undefined);
    const req = {
      method: 'GET',
      query: { deviceId },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(commandsHandler(req, createRes())).resolves.toEqual({ command: null });
    expect(mocks.waitForDesktopCommand).toHaveBeenCalledWith({ deviceId, timeoutMs: 25_000 });
  });

  it('rejects an out of range timeout', async () => {
    const req = {
      method: 'GET',
      query: { deviceId, timeoutMs: '25001' },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(commandsHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
    expect(mocks.authenticateDesktopDevice).not.toHaveBeenCalled();
  });

  it('does not poll when device authentication fails', async () => {
    mocks.authenticateDesktopDevice.mockRejectedValue(new Error('unAuthorization'));
    const req = {
      method: 'GET',
      query: { deviceId },
      headers: { authorization: 'Bearer lgd_bad' }
    } as any;

    await expect(commandsHandler(req, createRes())).rejects.toThrow('unAuthorization');
    expect(mocks.waitForDesktopCommand).not.toHaveBeenCalled();
  });
});

describe('POST /api/proApi/desktop/revoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateDesktopDevice.mockResolvedValue({ ...identity, deviceId });
    mocks.revokeDesktopDevice.mockResolvedValue(true);
  });

  it('revokes the authenticated device', async () => {
    const req = {
      method: 'POST',
      body: { deviceId },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(revokeHandler(req, createRes())).resolves.toEqual({ revoked: true });

    expect(mocks.authenticateDesktopDevice).toHaveBeenCalledWith({
      deviceId,
      authorization: 'Bearer lgd_token'
    });
    expect(mocks.revokeDesktopDevice).toHaveBeenCalledWith({ deviceId, tmbId: 'tmb-1' });
  });

  it('reports an already removed device as not revoked', async () => {
    mocks.revokeDesktopDevice.mockResolvedValue(false);
    const req = {
      method: 'POST',
      body: { deviceId },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(revokeHandler(req, createRes())).resolves.toEqual({ revoked: false });
  });

  it('rejects a malformed device id before authenticating', async () => {
    const req = {
      method: 'POST',
      body: { deviceId: 'short' },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(revokeHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
    expect(mocks.authenticateDesktopDevice).not.toHaveBeenCalled();
  });

  it('does not revoke when device authentication fails', async () => {
    mocks.authenticateDesktopDevice.mockRejectedValue(new Error('unAuthorization'));
    const req = {
      method: 'POST',
      body: { deviceId },
      headers: { authorization: 'Bearer lgd_bad' }
    } as any;

    await expect(revokeHandler(req, createRes())).rejects.toThrow('unAuthorization');
    expect(mocks.revokeDesktopDevice).not.toHaveBeenCalled();
  });

  it('rejects methods other than POST', async () => {
    const req = {
      method: 'GET',
      body: { deviceId },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(revokeHandler(req, createRes())).rejects.toThrow('请求方法不支持');
  });
});

describe('POST /api/proApi/desktop/result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateDesktopDevice.mockResolvedValue({ ...identity, deviceId });
    mocks.saveDesktopCommandResult.mockResolvedValue(true);
  });

  it('accepts the first result for a command', async () => {
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: { ok: true, changed: true, code: 'clicked', message: '已点击' }
      },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).resolves.toEqual({ accepted: true });

    expect(mocks.authenticateDesktopDevice).toHaveBeenCalledWith({
      deviceId,
      authorization: 'Bearer lgd_token'
    });
    expect(mocks.saveDesktopCommandResult).toHaveBeenCalledWith({
      commandId,
      result: { ok: true, changed: true, code: 'clicked', message: '已点击' }
    });
  });

  it('reports duplicate results as not accepted', async () => {
    mocks.saveDesktopCommandResult.mockResolvedValue(false);
    const req = {
      method: 'POST',
      body: { deviceId, commandId, result: { ok: false, stopped: true } },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).resolves.toEqual({ accepted: false });
  });

  it('passes a browser page snapshot through unchanged', async () => {
    const snapshot = {
      url: 'https://www.immd.gov.hk/hkt/contact.html',
      title: '聯絡我們',
      text: '查詢表格與辦事指南',
      scroll: { x: 0, y: 120, viewportWidth: 800, viewportHeight: 600, pageHeight: 2400 },
      elements: [
        {
          ref: 'e12',
          role: 'textbox',
          name: '姓名',
          tag: 'input',
          type: 'text',
          placeholder: '請輸入姓名',
          inViewport: true
        }
      ]
    };
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: { ok: true, changed: true, snapshot }
      },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).resolves.toEqual({ accepted: true });

    expect(mocks.saveDesktopCommandResult).toHaveBeenCalledWith({
      commandId,
      result: { ok: true, changed: true, snapshot }
    });
  });

  it('rejects a snapshot with too many elements', async () => {
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: {
          ok: true,
          snapshot: {
            url: 'https://www.immd.gov.hk/hkt/contact.html',
            title: '聯絡我們',
            text: '',
            scroll: { x: 0, y: 0, viewportWidth: 800, viewportHeight: 600, pageHeight: 600 },
            elements: Array.from({ length: 301 }, (_, index) => ({
              ref: `e${index + 1}`,
              role: 'button',
              name: '按钮',
              tag: 'button'
            }))
          }
        }
      },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
    expect(mocks.saveDesktopCommandResult).not.toHaveBeenCalled();
  });

  it('rejects a snapshot element with an invalid ref', async () => {
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: {
          ok: true,
          snapshot: {
            url: 'https://www.immd.gov.hk/hkt/contact.html',
            title: '聯絡我們',
            text: '',
            scroll: { x: 0, y: 0, viewportWidth: 800, viewportHeight: 600, pageHeight: 600 },
            elements: [{ ref: 'x1', role: 'button', name: '提交', tag: 'button' }]
          }
        }
      },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
  });

  it('rejects a snapshot whose page text exceeds the limit', async () => {
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: {
          ok: true,
          snapshot: {
            url: 'https://www.immd.gov.hk/hkt/contact.html',
            title: '聯絡我們',
            text: 'a'.repeat(20_001),
            scroll: { x: 0, y: 0, viewportWidth: 800, viewportHeight: 600, pageHeight: 600 },
            elements: []
          }
        }
      },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
  });

  it('rejects a result without the ok flag', async () => {
    const req = {
      method: 'POST',
      body: { deviceId, commandId, result: { changed: true } },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
    expect(mocks.authenticateDesktopDevice).not.toHaveBeenCalled();
    expect(mocks.saveDesktopCommandResult).not.toHaveBeenCalled();
  });

  it('rejects an invalid command id', async () => {
    const req = {
      method: 'POST',
      body: { deviceId, commandId: 'not-a-uuid', result: { ok: true } },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
  });

  it('rejects methods other than POST', async () => {
    const req = {
      method: 'GET',
      body: { deviceId, commandId, result: { ok: true } },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).rejects.toThrow('请求方法不支持');
    expect(mocks.saveDesktopCommandResult).not.toHaveBeenCalled();
  });
});
