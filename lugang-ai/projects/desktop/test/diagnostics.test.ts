import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDiagnostics,
  DIAGNOSTICS_MAX_PENDING,
  DIAGNOSTICS_MAX_REPORTS_PER_UPLOAD,
  sanitizeDiagnosticText,
  type DiagnosticsDevice
} from '../src/main/diagnostics';

const BASE_URL = 'https://www.airscend.com';
const dirs: string[] = [];

const DEVICE: DiagnosticsDevice = {
  deviceId: '4b8a5f0e-1111-4222-8333-444444444444',
  deviceName: '办公电脑',
  appVersion: '0.8.9',
  platform: 'win32 x64'
};

type FetchCall = { url: string; init?: RequestInit };

const apiResponse = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ code: 200, statusText: 'success', data })
  }) as Response;

const errorResponse = (status: number) =>
  ({
    ok: false,
    status,
    json: async () => ({ error: 'server' })
  }) as Response;

const createHarness = (
  options: {
    device?: DiagnosticsDevice;
    token?: string;
    recentLog?: string;
    savePath?: string | null;
    route?: (call: FetchCall) => Response | Promise<Response> | undefined;
  } = {}
) => {
  const dir = mkdtempSync(join(tmpdir(), 'lugang-diagnostics-'));
  dirs.push(dir);
  const calls: FetchCall[] = [];
  const saved: Array<{ name: string; content: string }> = [];
  let token = options.token;
  let clock = 1_700_000_000_000;

  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    const routed = options.route?.(call);
    if (routed) return await routed;
    return apiResponse({ accepted: true });
  });

  const diagnostics = createDiagnostics({
    baseUrl: BASE_URL,
    dir,
    getDevice: () => options.device ?? DEVICE,
    getToken: () => token,
    readRecentLog: () => options.recentLog,
    saveBundle: async (name, content) => {
      saved.push({ name, content });
      return options.savePath === undefined ? 'C:\\Users\\me\\Downloads\\diag.txt' : options.savePath;
    },
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => clock
  });

  return {
    diagnostics,
    calls,
    saved,
    dir,
    pendingDir: join(dir, 'pending'),
    fetchImpl,
    setToken: (next: string | undefined) => {
      token = next;
    },
    setClock: (next: number) => {
      clock = next;
    },
    tick: (ms = 1) => {
      clock += ms;
    }
  };
};

const pendingFiles = (harness: ReturnType<typeof createHarness>) => {
  try {
    return readdirSync(harness.pendingDir)
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch {
    return [];
  }
};

const readPending = (harness: ReturnType<typeof createHarness>, name: string) =>
  JSON.parse(readFileSync(join(harness.pendingDir, name), 'utf8'));

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('诊断信息脱敏', () => {
  it('masks tokens, cookies, query secrets, emails, user folders, IPs and long opaque strings', () => {
    const input = [
      'Authorization: Bearer lgd_secret_token_value',
      'Cookie: fastgpt_token=abc123; other=1',
      'url=https://x.com/cb?token=abc&code=xyz&q=ok',
      'mail: zhang.san@example.com',
      'path C:\\Users\\zhang.san\\AppData\\Roaming',
      'ip 192.168.1.20',
      `long ${'a'.repeat(48)}`
    ].join('\n');

    const output = sanitizeDiagnosticText(input);

    expect(output).not.toContain('lgd_secret_token_value');
    expect(output).toContain('Bearer [已隐藏]');
    expect(output).not.toContain('abc123');
    expect(output).toContain('fastgpt_token=[已隐藏]');
    expect(output).toContain('token=[已隐藏]');
    expect(output).toContain('code=[已隐藏]');
    expect(output).toContain('q=ok');
    expect(output).not.toContain('zhang.san@');
    expect(output).toContain('***@example.com');
    expect(output).not.toContain('C:\\Users\\zhang.san');
    expect(output).toContain('C:\\Users\\<用户>');
    expect(output).not.toContain('192.168.1.20');
    expect(output).toContain('[IP]');
    expect(output).not.toContain('a'.repeat(48));
    expect(output).toContain('[已隐藏长串]');
  });

  it('keeps ordinary Chinese text untouched', () => {
    const text = '填写表格时找不到「申请人姓名」字段，请检查第 3 行';
    expect(sanitizeDiagnosticText(text)).toBe(text);
  });
});

describe('桌面崩溃落盘', () => {
  it('stores a sanitized crash record with its error stack', () => {
    const harness = createHarness();
    harness.diagnostics.recordCrash({
      type: 'uncaught-exception',
      error: new Error('failed at C:\\Users\\li\\x with password=hunter2')
    });

    const files = pendingFiles(harness);
    expect(files).toHaveLength(1);
    const record = readPending(harness, files[0]);
    expect(record).toMatchObject({
      type: 'uncaught-exception',
      occurredAt: 1_700_000_000_000
    });
    expect(record.message).toContain('C:\\Users\\<用户>');
    expect(record.message).not.toContain('hunter2');
    expect(record.stack).toContain('Error');
  });

  it('keeps only the newest pending crashes when the cap is exceeded', () => {
    const harness = createHarness();
    for (let index = 0; index < DIAGNOSTICS_MAX_PENDING + 5; index += 1) {
      harness.diagnostics.recordCrash({ type: 'manual', message: `crash ${index}` });
      harness.tick();
    }

    const files = pendingFiles(harness);
    expect(files).toHaveLength(DIAGNOSTICS_MAX_PENDING);
    const messages = files.map((name) => readPending(harness, name).message);
    expect(messages[0]).toBe('crash 5');
    expect(messages[messages.length - 1]).toBe(`crash ${DIAGNOSTICS_MAX_PENDING + 4}`);
  });

  it('never throws when recording a crash', () => {
    const harness = createHarness();
    expect(() => harness.diagnostics.recordCrash({ type: 'manual', message: '' })).not.toThrow();
    expect(pendingFiles(harness)).toHaveLength(1);
  });
});

describe('崩溃自动上报', () => {
  it('does nothing without a device token', async () => {
    const harness = createHarness();
    harness.diagnostics.recordCrash({ type: 'manual', message: 'crash' });

    await expect(harness.diagnostics.uploadPending()).resolves.toEqual({ uploaded: 0 });
    expect(harness.calls).toHaveLength(0);
    expect(pendingFiles(harness)).toHaveLength(1);
  });

  it('uploads pending crashes in batches and removes them on success', async () => {
    const harness = createHarness();
    for (let index = 0; index < 5; index += 1) {
      harness.diagnostics.recordCrash({ type: 'manual', message: `crash ${index}` });
      harness.tick();
    }
    harness.setToken('lgd_device-token');

    await expect(harness.diagnostics.uploadPending()).resolves.toEqual({ uploaded: 5 });

    expect(harness.calls).toHaveLength(2);
    const first = JSON.parse(String(harness.calls[0].init?.body));
    const second = JSON.parse(String(harness.calls[1].init?.body));
    expect(harness.calls[0].url).toBe(`${BASE_URL}/api/proApi/desktop/diagnostics`);
    expect(harness.calls[0].init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer lgd_device-token'
    });
    expect(first).toMatchObject({
      deviceId: DEVICE.deviceId,
      deviceName: DEVICE.deviceName,
      appVersion: DEVICE.appVersion,
      platform: DEVICE.platform
    });
    expect(first.reports).toHaveLength(DIAGNOSTICS_MAX_REPORTS_PER_UPLOAD);
    expect(second.reports).toHaveLength(2);
    expect(pendingFiles(harness)).toHaveLength(0);
  });

  it('keeps the pending files when the upload fails', async () => {
    let failing = true;
    const harness = createHarness({
      token: 'lgd_device-token',
      route: () => (failing ? errorResponse(500) : undefined)
    });
    harness.diagnostics.recordCrash({ type: 'manual', message: 'crash' });
    await vi.waitFor(() => expect(harness.calls.length).toBeGreaterThanOrEqual(1));
    // 鲁港通 - 等首次自动上报彻底结束，再验证失败后仍保留文件
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(pendingFiles(harness)).toHaveLength(1);

    failing = false;
    await expect(harness.diagnostics.uploadPending()).resolves.toEqual({ uploaded: 1 });
    expect(pendingFiles(harness)).toHaveLength(0);
  });

  it('uploads automatically once a crash happens with a device token', async () => {
    const harness = createHarness({ token: 'lgd_device-token' });
    harness.diagnostics.recordCrash({ type: 'unhandled-rejection', message: 'boom' });

    await vi.waitFor(() => expect(harness.calls).toHaveLength(1));
    expect(pendingFiles(harness)).toHaveLength(0);
  });

  it('does not run two uploads at the same time', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const harness = createHarness({
      token: 'lgd_device-token',
      route: async () => {
        await gate;
        return apiResponse({ accepted: 1 });
      }
    });
    harness.diagnostics.recordCrash({ type: 'manual', message: 'crash' });
    await vi.waitFor(() => expect(harness.calls).toHaveLength(1));

    const concurrent = harness.diagnostics.uploadPending();
    release?.();
    await expect(concurrent).resolves.toEqual({ uploaded: 1 });
    expect(harness.calls).toHaveLength(1);
  });
});

describe('诊断包导出', () => {
  it('writes a single text bundle with version, device, log and pending crashes', async () => {
    const harness = createHarness({
      recentLog: '2026-10-29 [error] Authorization: Bearer lgd_secret'
    });
    harness.diagnostics.recordCrash({
      type: 'uncaught-exception',
      error: new Error('render failed at C:\\Users\\li\\app')
    });

    await expect(harness.diagnostics.exportBundle()).resolves.toBe('C:\\Users\\me\\Downloads\\diag.txt');

    expect(harness.saved).toHaveLength(1);
    const { name, content } = harness.saved[0];
    expect(name).toMatch(/^lugang-diagnostics-\d{8}-\d{6}\.txt$/);
    expect(content).toContain('客户端版本：0.8.9');
    expect(content).toContain('设备编号：4b8a5f0e-1111-4222-8333-444444444444');
    expect(content).toContain('设备名称：办公电脑');
    expect(content).toContain('待上报崩溃：1 条');
    expect(content).toContain('render failed at C:\\Users\\<用户>');
    expect(content).toContain('Authorization: Bearer [已隐藏]');
    expect(content).not.toContain('lgd_secret');
  });

  it('returns null when the user cancels the save dialog', async () => {
    const harness = createHarness({ savePath: null });

    await expect(harness.diagnostics.exportBundle()).resolves.toBeNull();
  });
});
