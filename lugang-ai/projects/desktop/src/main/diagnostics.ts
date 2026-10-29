// 鲁港通 - 桌面崩溃诊断：本地脱敏落盘、拿到设备令牌后自动补传、一键导出诊断包
import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { arch, platform, release } from 'node:os';
import { join } from 'node:path';

export const DIAGNOSTICS_MAX_PENDING = 20;
export const DIAGNOSTICS_MAX_REPORTS_PER_UPLOAD = 3;

const MAX_UPLOAD_ROUNDS = 7;
const MESSAGE_MAX_CHARS = 2000;
const STACK_MAX_CHARS = 8000;
const LOG_MAX_CHARS = 12_000;
const CRASH_LOG_EXCERPT_CHARS = 4000;
const BUNDLE_LOG_MAX_CHARS = 20_000;
const UPLOAD_TIMEOUT_MS = 15_000;

const HIDDEN = '[已隐藏]';
const HIDDEN_LONG = '[已隐藏长串]';
const HIDDEN_USER = '<用户>';

export type DiagnosticsCrashType =
  | 'uncaught-exception'
  | 'unhandled-rejection'
  | 'renderer-crash'
  | 'manual';

const CRASH_TYPES: DiagnosticsCrashType[] = [
  'uncaught-exception',
  'unhandled-rejection',
  'renderer-crash',
  'manual'
];

export type DiagnosticsDevice = {
  deviceId: string;
  deviceName: string;
  appVersion: string;
  platform?: string;
};

export type DiagnosticsCrashInput = {
  type: DiagnosticsCrashType;
  error?: unknown;
  message?: string;
  stack?: string;
  log?: string;
};

export type DiagnosticsOptions = {
  baseUrl: string;
  dir: string;
  getDevice: () => DiagnosticsDevice | undefined;
  getToken: () => string | undefined;
  readRecentLog: (maxChars: number) => string | undefined;
  saveBundle: (defaultName: string, content: string) => Promise<string | null>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  log?: (message: string, error?: unknown) => void;
};

export type Diagnostics = {
  recordCrash: (input: DiagnosticsCrashInput) => void;
  uploadPending: () => Promise<{ uploaded: number }>;
  exportBundle: () => Promise<string | null>;
};

type PendingCrashRecord = {
  id: string;
  type: DiagnosticsCrashType;
  message: string;
  stack?: string;
  log?: string;
  occurredAt: number;
};

// 鲁港通 - 崩溃信息可能带令牌、Cookie、本机用户名与内网地址，落盘与上报前统一脱敏
export const sanitizeDiagnosticText = (value: string): string => {
  let text = value;
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, `Bearer ${HIDDEN}`);
  text = text.replace(/\b(fastgpt_token)=[^;\s&"']+/gi, `$1=${HIDDEN}`);
  text = text.replace(
    /\b(?:access_token|refresh_token|api_key|apikey|token|secret|password|passwd|pwd|signature|sign|session|ticket|code)=[^&\s"'#]+/gi,
    (match) => {
      const separator = match.indexOf('=');
      return `${match.slice(0, separator + 1)}${HIDDEN}`;
    }
  );
  // 鲁港通 - 带账号密码的网址只保留协议与主机
  text = text.replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, `$1${HIDDEN}@`);
  text = text.replace(/([A-Za-z]:\\Users\\)[^\\\s"']+/gi, `$1${HIDDEN_USER}`);
  text = text.replace(
    /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g,
    `***@$1`
  );
  text = text.replace(/[A-Za-z0-9+/_=-]{40,}/g, HIDDEN_LONG);
  text = text.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP]');
  text = text.replace(/\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b/gi, '[IP]');
  return text;
};

export const describeCrashError = (error: unknown): { message: string; stack?: string } => {
  if (error instanceof Error) {
    return { message: error.message || error.name || '未知错误', stack: error.stack };
  }
  if (typeof error === 'string' && error.trim()) return { message: error };
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== '{}') return { message: serialized };
  } catch {
    // 鲁港通 - 循环引用等无法序列化的值退回字符串形式
  }
  return { message: String(error ?? '未知错误') };
};

const truncate = (value: string | undefined, maxChars: number): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}…` : trimmed;
};

const pad = (value: number) => String(value).padStart(2, '0');
const formatTime = (value: number) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
const fileStamp = (value: number) => {
  const date = new Date(value);
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const isCrashType = (value: unknown): value is DiagnosticsCrashType =>
  typeof value === 'string' && (CRASH_TYPES as string[]).includes(value);

export const createDiagnostics = (options: DiagnosticsOptions): Diagnostics => {
  const root = options.baseUrl.replace(/\/+$/, '');
  const pendingDir = join(options.dir, 'pending');
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const log = options.log;

  let uploadTask: Promise<{ uploaded: number }> | undefined;
  let recording = false;

  const ensurePendingDir = () => {
    mkdirSync(pendingDir, { recursive: true });
  };

  const listPendingNames = (): string[] => {
    try {
      return readdirSync(pendingDir)
        .filter((name) => name.endsWith('.json'))
        .sort();
    } catch {
      return [];
    }
  };

  const readPendingRecords = (): Array<{ name: string; record: PendingCrashRecord }> => {
    const records: Array<{ name: string; record: PendingCrashRecord }> = [];
    for (const name of listPendingNames()) {
      try {
        const parsed = JSON.parse(readFileSync(join(pendingDir, name), 'utf8'));
        if (!parsed || typeof parsed !== 'object') continue;
        const record = parsed as Partial<PendingCrashRecord>;
        if (
          !isCrashType(record.type) ||
          typeof record.message !== 'string' ||
          typeof record.occurredAt !== 'number'
        ) {
          continue;
        }
        records.push({ name, record: record as PendingCrashRecord });
      } catch {
        // 鲁港通 - 单条损坏的记录不能拖住其它崩溃上报
      }
    }
    return records;
  };

  const trimPending = () => {
    const names = listPendingNames();
    const overflow = names.length - DIAGNOSTICS_MAX_PENDING;
    for (let index = 0; index < overflow; index += 1) {
      try {
        unlinkSync(join(pendingDir, names[index]));
      } catch {
        // 鲁港通 - 清理旧记录失败不影响新记录落盘
      }
    }
  };

  const collectLog = (inputLog?: string): string | undefined => {
    if (inputLog) return inputLog;
    try {
      return options.readRecentLog(CRASH_LOG_EXCERPT_CHARS);
    } catch {
      return undefined;
    }
  };

  const runUpload = async (): Promise<{ uploaded: number }> => {
    let uploaded = 0;
    try {
      for (let round = 0; round < MAX_UPLOAD_ROUNDS; round += 1) {
        const device = options.getDevice();
        const token = options.getToken();
        if (!device || !token) break;

        const pending = readPendingRecords();
        if (pending.length === 0) break;

        const batch = pending.slice(0, DIAGNOSTICS_MAX_REPORTS_PER_UPLOAD);
        const response = await fetchImpl(`${root}/api/proApi/desktop/diagnostics`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            appVersion: device.appVersion,
            platform: device.platform,
            reports: batch.map(({ record }) => ({
              type: record.type,
              message: record.message,
              ...(record.stack ? { stack: record.stack } : {}),
              ...(record.log ? { log: record.log } : {}),
              occurredAt: record.occurredAt
            }))
          }),
          signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS)
        });

        if (!response.ok) {
          log?.(`desktop diagnostics upload rejected with ${response.status}`);
          break;
        }

        let removed = 0;
        for (const { name } of batch) {
          try {
            unlinkSync(join(pendingDir, name));
            removed += 1;
          } catch (error) {
            log?.('desktop diagnostics pending clean failed', error);
          }
        }
        uploaded += removed;
        // 鲁港通 - 删除失败时停止本轮循环，避免同一条记录被反复上报
        if (removed < batch.length) break;
      }
    } catch (error) {
      log?.('desktop diagnostics upload failed', error);
    }
    return { uploaded };
  };

  const uploadPending = (): Promise<{ uploaded: number }> => {
    if (uploadTask) return uploadTask;
    if (!options.getDevice() || !options.getToken()) {
      return Promise.resolve({ uploaded: 0 });
    }
    uploadTask = runUpload().finally(() => {
      uploadTask = undefined;
    });
    return uploadTask;
  };

  const recordCrash = (input: DiagnosticsCrashInput) => {
    if (recording) return;
    recording = true;
    try {
      const described =
        input.error !== undefined
          ? describeCrashError(input.error)
          : { message: input.message ?? '未知错误', stack: input.stack };
      const message =
        truncate(described.message && sanitizeDiagnosticText(described.message), MESSAGE_MAX_CHARS) ??
        '未知错误';
      const stack = truncate(described.stack && sanitizeDiagnosticText(described.stack), STACK_MAX_CHARS);
      const rawLog = collectLog(input.log);
      const logText = truncate(rawLog && sanitizeDiagnosticText(rawLog), LOG_MAX_CHARS);

      const occurredAt = now();
      const record: PendingCrashRecord = {
        id: randomUUID(),
        type: input.type,
        message,
        ...(stack ? { stack } : {}),
        ...(logText ? { log: logText } : {}),
        occurredAt
      };

      ensurePendingDir();
      const name = `${String(occurredAt).padStart(13, '0')}-${record.id.slice(0, 8)}.json`;
      const tempPath = join(pendingDir, `${name}.tmp`);
      writeFileSync(tempPath, JSON.stringify(record), 'utf8');
      renameSync(tempPath, join(pendingDir, name));
      trimPending();

      void uploadPending();
    } catch (error) {
      log?.('desktop crash record failed', error);
    } finally {
      recording = false;
    }
  };

  const buildBundle = () => {
    const createdAt = now();
    const device = options.getDevice();
    const pending = readPendingRecords();
    const rawLog = (() => {
      try {
        return options.readRecentLog(BUNDLE_LOG_MAX_CHARS);
      } catch {
        return undefined;
      }
    })();

    const lines: string[] = [
      '鲁港通桌面客户端诊断包',
      `生成时间：${formatTime(createdAt)}`,
      `客户端版本：${device?.appVersion ?? '未知（设备尚未注册）'}`,
      `操作系统：${platform()} ${release()} ${arch()}`,
      `设备名称：${device?.deviceName ?? '未知'}`,
      `设备编号：${device?.deviceId ?? '未知'}`,
      `待上报崩溃：${pending.length} 条`,
      '',
      '==== 最近日志 ====',
      rawLog ? sanitizeDiagnosticText(rawLog) : '（未读取到本地日志）',
      '',
      '==== 待上报崩溃 ===='
    ];

    if (pending.length === 0) {
      lines.push('（没有待上报的崩溃记录）');
    }

    pending.forEach(({ record }, index) => {
      lines.push(
        '',
        `[${index + 1}] ${formatTime(record.occurredAt)} · ${record.type}`,
        record.message
      );
      if (record.stack) lines.push('--- 调用栈 ---', record.stack);
      if (record.log) lines.push('--- 当时日志 ---', record.log);
    });

    return { content: lines.join('\n'), createdAt };
  };

  const exportBundle = async (): Promise<string | null> => {
    const { content, createdAt } = buildBundle();
    return options.saveBundle(`lugang-diagnostics-${fileStamp(createdAt)}.txt`, content);
  };

  return { recordCrash, uploadPending, exportBundle };
};
