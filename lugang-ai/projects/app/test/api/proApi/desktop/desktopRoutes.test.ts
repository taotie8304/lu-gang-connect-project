import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestInputParseError } from '@fastgpt/service/common/zod/requestParseError';

const mocks = vi.hoisted(() => ({
  authCert: vi.fn(),
  registerDesktopDevice: vi.fn(),
  authenticateDesktopDevice: vi.fn(),
  waitForDesktopCommand: vi.fn(),
  saveDesktopCommandResult: vi.fn(),
  clearDesktopDeviceBusy: vi.fn(),
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
  clearDesktopDeviceBusy: mocks.clearDesktopDeviceBusy,
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

  it('passes generated file and confirmation details through unchanged', async () => {
    const file = {
      name: '香港慈善组织申请说明.docx',
      format: 'docx',
      folder: 'C:\\Users\\tester\\Downloads\\鲁港通生成文件'
    };
    const confirmation = { required: true, decision: 'allow', label: '提交申请' };
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: { ok: true, changed: true, file, confirmation }
      },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).resolves.toEqual({ accepted: true });

    expect(mocks.saveDesktopCommandResult).toHaveBeenCalledWith({
      commandId,
      result: { ok: true, changed: true, file, confirmation }
    });
  });

  it('passes a document outline and token through unchanged', async () => {
    const document = {
      format: 'docx',
      name: '入职登记表.docx',
      paragraphs: [
        { index: 0, text: '入职登记表', style: 'Heading1' },
        { index: 1, text: '姓名：', style: 'Normal' }
      ],
      tables: [{ index: 0, rows: 3, cells: 4, header: ['姓名', '电话'] }],
      paragraphsTruncated: false,
      warnings: ['文档含 1 处批注，已忽略']
    };
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: { ok: true, document, documentToken: 'doc-token-1' }
      },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).resolves.toEqual({ accepted: true });

    expect(mocks.saveDesktopCommandResult).toHaveBeenCalledWith({
      commandId,
      result: { ok: true, document, documentToken: 'doc-token-1' }
    });
  });

  it('keeps excel row numbers, row labels and column map from the client outline', async () => {
    const document = {
      format: 'xlsx',
      name: '民青局交流項目申請表.xlsx',
      sheets: [
        {
          name: 'Form',
          rowCount: 83,
          columnCount: 10,
          headerRow: 40,
          header: ['支出項目', '單位', '數量', '單價', '小計'],
          columns: [
            { col: 'A', header: '支出項目' },
            { col: 'B', header: '單位' },
            { col: 'C', header: '數量' },
            { col: 'D', header: '單價' },
            { col: 'E', header: '小計', formula: true }
          ],
          sampleRows: [['1. 往返交通費', '人／程', '33', '3200', '105600']],
          sampleRowNumbers: [41],
          rowLabels: [
            { row: 2, text: '團體名稱' },
            { row: 41, text: '往返交通費' }
          ],
          rowLabelsTruncated: false
        }
      ]
    };
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: { ok: true, document, documentToken: 'doc-token-1' }
      },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).resolves.toEqual({ accepted: true });

    expect(mocks.saveDesktopCommandResult).toHaveBeenCalledWith({
      commandId,
      result: { ok: true, document, documentToken: 'doc-token-1' }
    });
  });

  it('passes a form summary, token and fill stats through unchanged', async () => {
    const form = {
      format: 'pdf',
      name: '签证申请表.pdf',
      title: '签证申请表',
      fields: [
        { id: 'f1', label: '姓名', kind: 'text', required: true },
        { id: 'f2', label: '性别', kind: 'choice', options: ['男', '女'] },
        { id: 'f3', label: '出生日期', kind: 'date', hint: 'YYYY-MM-DD' }
      ],
      fieldsTruncated: false,
      warnings: ['PDF 有 2 页，只读取了前 1 页的表单域']
    };
    const fill = {
      filled: 2,
      skipped: ['「性别」的可选项里没有“未知”，已跳过'],
      warnings: ['已另存为副本']
    };
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: { ok: true, form, formToken: 'form-token-1', fill }
      },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).resolves.toEqual({ accepted: true });

    expect(mocks.saveDesktopCommandResult).toHaveBeenCalledWith({
      commandId,
      result: { ok: true, form, formToken: 'form-token-1', fill }
    });
  });

  it('passes document edit stats through unchanged', async () => {
    const edit = {
      applied: 3,
      skipped: ['第 7 段找不到要替换的内容，已跳过'],
      warnings: ['替换次数较多，本次只处理了前 200 处。']
    };
    const req = {
      method: 'POST',
      body: { deviceId, commandId, result: { ok: true, edit } },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).resolves.toEqual({ accepted: true });

    expect(mocks.saveDesktopCommandResult).toHaveBeenCalledWith({
      commandId,
      result: { ok: true, edit }
    });
  });

  it('rejects a document paragraph whose text exceeds the limit', async () => {
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: {
          ok: true,
          document: {
            format: 'docx',
            name: '长文.docx',
            paragraphs: [{ index: 0, text: 'a'.repeat(501) }]
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

  it('rejects a document summary without a file name', async () => {
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: { ok: true, document: { format: 'docx', name: '' } }
      },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
    expect(mocks.saveDesktopCommandResult).not.toHaveBeenCalled();
  });

  it('rejects a form field with an unknown kind', async () => {
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: {
          ok: true,
          form: {
            format: 'docx',
            name: '表单.docx',
            fields: [{ id: 'f1', label: '姓名', kind: 'signature' }]
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

  it('rejects negative fill counts', async () => {
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: { ok: true, fill: { filled: -1 } }
      },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
    expect(mocks.saveDesktopCommandResult).not.toHaveBeenCalled();
  });

  it('rejects an unknown confirmation decision', async () => {
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: { ok: true, confirmation: { required: true, decision: 'approve' } }
      },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
    expect(mocks.saveDesktopCommandResult).not.toHaveBeenCalled();
  });

  it('rejects a generated file result without a file name', async () => {
    const req = {
      method: 'POST',
      body: {
        deviceId,
        commandId,
        result: { ok: true, file: { name: '', folder: 'C:\\tmp' } }
      },
      headers: { authorization: 'Bearer lgd_token' }
    } as any;

    await expect(resultHandler(req, createRes())).rejects.toBeInstanceOf(
      ApiRequestInputParseError
    );
    expect(mocks.saveDesktopCommandResult).not.toHaveBeenCalled();
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
