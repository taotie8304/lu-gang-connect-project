// 鲁港通 - 桌面 AI 指令通道存储（P2 阶段一）：
// 设备令牌只存哈希；指令队列用 Lua 保证入队/出队原子性；在线状态由长轮询心跳维护。
import { randomUUID } from 'node:crypto';
import { ERROR_ENUM } from '@fastgpt/global/common/error/errorCode';
import type {
  DesktopAiCommand,
  DesktopBrowserResumeState,
  DesktopCommandEnvelope,
  DesktopCommandResult,
  RegisterDesktopDeviceResponse
} from '@fastgpt/global/support/desktopCommand/type';
import {
  createRedisLogicalKey,
  redisCacheAdapter,
  type RedisCacheAdapter,
  type RedisLogicalKey
} from '@fastgpt/dal/redis/adapter';
import {
  DESKTOP_BROWSER_RESULT_POLL_MS,
  DESKTOP_BROWSER_RESUME_TTL_MS,
  DESKTOP_COMMAND_KEY_VERSION,
  DESKTOP_COMMAND_MAX_BYTES,
  DESKTOP_COMMAND_NAMESPACE,
  DESKTOP_HEARTBEAT_TTL_SECONDS,
  DESKTOP_LONG_POLL_INTERVAL_MS,
  DESKTOP_LONG_POLL_MAX_MS,
  DESKTOP_QUEUE_TTL_MS,
  DESKTOP_RESULT_TTL_SECONDS,
  DESKTOP_TOKEN_TTL_MS,
  getDesktopCommandBusyTtlMs
} from './constant';
import {
  createDesktopToken,
  DESKTOP_TOKEN_PATTERN,
  hashDesktopToken,
  parseBearerToken
} from './token';

type DesktopCommandRedis = Pick<
  RedisCacheAdapter,
  'get' | 'set' | 'setIfAbsent' | 'delete' | 'evalScript'
>;

export type DesktopDeviceRecord = {
  deviceId: string;
  tmbId: string;
  userId: string;
  teamId: string;
  deviceName?: string;
  appVersion?: string;
  tokenHash: string;
  registeredAt: number;
};

export type DesktopDeviceSession = Pick<
  DesktopDeviceRecord,
  'deviceId' | 'tmbId' | 'userId' | 'teamId'
>;

export type RegisterDesktopDeviceParams = Omit<
  DesktopDeviceRecord,
  'tokenHash' | 'registeredAt'
>;

export type DesktopCommandStoreOptions = {
  redis?: DesktopCommandRedis;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

const PUSH_COMMAND_SCRIPT = `
-- desktop-command:push
local existing = redis.call("get", KEYS[1])
local queue = {}
if existing then
  queue = cjson.decode(existing)
end
table.insert(queue, ARGV[1])
redis.call("set", KEYS[1], cjson.encode(queue), "PX", ARGV[2])
return #queue
`;

const POP_COMMAND_SCRIPT = `
-- desktop-command:pop
local existing = redis.call("get", KEYS[1])
if not existing then
  return nil
end
local queue = cjson.decode(existing)
if #queue == 0 then
  return nil
end
local item = table.remove(queue, 1)
if #queue == 0 then
  redis.call("del", KEYS[1])
else
  redis.call("set", KEYS[1], cjson.encode(queue), "KEEPTTL")
end
return item
`;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const parseEnvelope = (raw: unknown): DesktopCommandEnvelope | undefined => {
  if (typeof raw !== 'string' || !raw) return undefined;

  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object') return undefined;
    if (typeof value.id !== 'string' || typeof value.createdAt !== 'number') return undefined;
    if (!value.command || typeof value.command !== 'object') return undefined;
    if (typeof value.command.action !== 'string' || !value.command.action) return undefined;
    return value as DesktopCommandEnvelope;
  } catch {
    return undefined;
  }
};

const parseResult = (raw: string | null): DesktopCommandResult | undefined => {
  if (!raw) return undefined;

  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || typeof value.ok !== 'boolean') return undefined;
    return value as DesktopCommandResult;
  } catch {
    return undefined;
  }
};

const parseDeviceRecord = (raw: string | null): DesktopDeviceRecord | undefined => {
  if (!raw) return undefined;

  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object') return undefined;
    if (typeof value.deviceId !== 'string' || typeof value.tmbId !== 'string') return undefined;
    if (typeof value.tokenHash !== 'string') return undefined;
    return value as DesktopDeviceRecord;
  } catch {
    return undefined;
  }
};

const parseTokenRecord = (raw: string | null): DesktopDeviceSession | undefined => {
  if (!raw) return undefined;

  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object') return undefined;
    if (typeof value.deviceId !== 'string' || typeof value.tmbId !== 'string') return undefined;
    if (typeof value.userId !== 'string' || typeof value.teamId !== 'string') return undefined;
    return value as DesktopDeviceSession;
  } catch {
    return undefined;
  }
};

/**
 * 桌面设备与指令通道存储。
 *
 * - 令牌：注册时生成，只返回一次，Redis 仅保存 sha256。
 * - 队列：每个设备一条 JSON 队列，Lua 脚本保证并发轮询下不会重复取走指令。
 * - 在线：长轮询请求持续刷新 60 秒心跳；离线时服务端工具应直接提示用户。
 */
export class DesktopCommandStore {
  private readonly redis: DesktopCommandRedis;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor({
    redis = redisCacheAdapter,
    now = Date.now,
    sleep = defaultSleep
  }: DesktopCommandStoreOptions = {}) {
    this.redis = redis;
    this.now = now;
    this.sleep = sleep;
  }

  private key(...segments: string[]): RedisLogicalKey {
    return createRedisLogicalKey({
      namespace: DESKTOP_COMMAND_NAMESPACE,
      version: DESKTOP_COMMAND_KEY_VERSION,
      segments
    });
  }

  private deviceKey = (deviceId: string) => this.key('device', deviceId);
  private tokenKey = (tokenHash: string) => this.key('token', tokenHash);
  private ownerKey = (tmbId: string) => this.key('owner', tmbId);
  private heartbeatKey = (deviceId: string) => this.key('hb', deviceId);
  private busyKey = (deviceId: string) => this.key('busy', deviceId);
  private queueKey = (deviceId: string) => this.key('queue', deviceId);
  private resultKey = (commandId: string) => this.key('result', commandId);
  private browserResumeKey = (tmbId: string, chatId: string) =>
    this.key('browser-resume', tmbId, chatId);

  private async touchHeartbeat(deviceId: string) {
    await this.redis.set({
      key: this.heartbeatKey(deviceId),
      value: '1',
      ttlMs: DESKTOP_HEARTBEAT_TTL_SECONDS * 1000
    });
  }

  /** 指令执行期间客户端不再长轮询，用执行标记兜住在心跳过期后的窗口。 */
  async markBusy(deviceId: string, ttlMs: number) {
    await this.redis.set({
      key: this.busyKey(deviceId),
      value: '1',
      ttlMs: Math.max(1000, ttlMs)
    });
  }

  async clearBusy(deviceId: string) {
    await this.redis.delete(this.busyKey(deviceId));
  }

  private async getDevice(deviceId: string) {
    return parseDeviceRecord(await this.redis.get(this.deviceKey(deviceId)));
  }

  /** 注册或重新注册设备；同一设备重新注册会让旧令牌立即失效。 */
  async register({
    deviceId,
    deviceName,
    appVersion,
    tmbId,
    userId,
    teamId
  }: RegisterDesktopDeviceParams): Promise<RegisterDesktopDeviceResponse> {
    const previous = await this.getDevice(deviceId);
    if (previous) {
      await this.redis.delete(this.tokenKey(previous.tokenHash));
      if (previous.tmbId !== tmbId) {
        const ownerDeviceId = await this.redis.get(this.ownerKey(previous.tmbId));
        if (ownerDeviceId === deviceId) {
          await this.redis.delete(this.ownerKey(previous.tmbId));
        }
      }
    }

    const token = createDesktopToken();
    const tokenHash = hashDesktopToken(token);
    const record: DesktopDeviceRecord = {
      deviceId,
      tmbId,
      userId,
      teamId,
      deviceName,
      appVersion,
      tokenHash,
      registeredAt: this.now()
    };

    await this.redis.set({
      key: this.deviceKey(deviceId),
      value: JSON.stringify(record),
      ttlMs: DESKTOP_TOKEN_TTL_MS
    });
    await this.redis.set({
      key: this.tokenKey(tokenHash),
      value: JSON.stringify({ deviceId, tmbId, userId, teamId }),
      ttlMs: DESKTOP_TOKEN_TTL_MS
    });
    await this.redis.set({
      key: this.ownerKey(tmbId),
      value: deviceId,
      ttlMs: DESKTOP_TOKEN_TTL_MS
    });
    await this.touchHeartbeat(deviceId);

    return { token, expiresInMs: DESKTOP_TOKEN_TTL_MS };
  }

  /** 校验设备令牌并刷新在线心跳；令牌缺失、非法或与设备不匹配统一按未授权处理。 */
  async authenticate({
    deviceId,
    authorization
  }: {
    deviceId: string;
    authorization?: string | string[];
  }): Promise<DesktopDeviceSession> {
    const token = parseBearerToken(authorization);
    if (!token || !DESKTOP_TOKEN_PATTERN.test(token)) {
      throw new Error(ERROR_ENUM.unAuthorization);
    }

    const session = parseTokenRecord(
      await this.redis.get(this.tokenKey(hashDesktopToken(token)))
    );
    if (!session || session.deviceId !== deviceId) {
      throw new Error(ERROR_ENUM.unAuthorization);
    }

    await this.touchHeartbeat(deviceId);
    return session;
  }

  /** 把一条指令追加到设备队列，返回带指令 ID 的信封供结果关联。 */
  async enqueue({
    deviceId,
    command
  }: {
    deviceId: string;
    command: DesktopAiCommand;
  }): Promise<DesktopCommandEnvelope> {
    const serialized = JSON.stringify(command);
    if (Buffer.byteLength(serialized, 'utf8') > DESKTOP_COMMAND_MAX_BYTES) {
      throw new Error('操作指令过大，请缩小操作范围后重试');
    }

    const envelope: DesktopCommandEnvelope = {
      id: randomUUID(),
      createdAt: this.now(),
      command
    };
    await this.redis.evalScript({
      script: PUSH_COMMAND_SCRIPT,
      keys: [this.queueKey(deviceId)],
      args: [JSON.stringify(envelope), DESKTOP_QUEUE_TTL_MS]
    });

    return envelope;
  }

  /** 原子取走队首指令；队列为空或数据损坏时返回 undefined。 */
  async dequeue(deviceId: string): Promise<DesktopCommandEnvelope | undefined> {
    const raw = await this.redis.evalScript({
      script: POP_COMMAND_SCRIPT,
      keys: [this.queueKey(deviceId)]
    });
    return parseEnvelope(raw);
  }

  /** 长轮询：在超时前每 500ms 检查一次队列；无指令时返回 undefined。 */
  async waitForCommand({
    deviceId,
    timeoutMs
  }: {
    deviceId: string;
    timeoutMs: number;
  }): Promise<DesktopCommandEnvelope | undefined> {
    const deadline = this.now() + Math.max(0, Math.min(timeoutMs, DESKTOP_LONG_POLL_MAX_MS));

    for (;;) {
      const command = await this.dequeue(deviceId);
      if (command) {
        await this.markBusy(deviceId, getDesktopCommandBusyTtlMs(command.command.action));
        return command;
      }

      const remaining = deadline - this.now();
      if (remaining <= 0) return undefined;
      await this.sleep(Math.min(DESKTOP_LONG_POLL_INTERVAL_MS, remaining));
    }
  }

  /** 保存指令执行结果；重复回传返回 false，由路由层转为 accepted=false。 */
  async saveResult({
    commandId,
    result
  }: {
    commandId: string;
    result: DesktopCommandResult;
  }): Promise<boolean> {
    return this.redis.setIfAbsent({
      key: this.resultKey(commandId),
      value: JSON.stringify(result),
      ttlSeconds: DESKTOP_RESULT_TTL_SECONDS
    });
  }

  async getResult(commandId: string): Promise<DesktopCommandResult | undefined> {
    return parseResult(await this.redis.get(this.resultKey(commandId)));
  }

  /** 浏览器操作等待结果：在超时前轮询结果键，超时返回 undefined 由调用方转为超时提示。 */
  async waitForResult({
    commandId,
    timeoutMs,
    pollIntervalMs = DESKTOP_BROWSER_RESULT_POLL_MS
  }: {
    commandId: string;
    timeoutMs: number;
    pollIntervalMs?: number;
  }): Promise<DesktopCommandResult | undefined> {
    const deadline = this.now() + Math.max(0, timeoutMs);

    for (;;) {
      const result = await this.getResult(commandId);
      if (result) return result;

      const remaining = deadline - this.now();
      if (remaining <= 0) return undefined;
      await this.sleep(Math.min(pollIntervalMs, remaining));
    }
  }

  /** 保存会话级浏览器续跑状态；只保留目标与页面地址，10 分钟后自动失效。 */
  async saveBrowserResume({
    tmbId,
    chatId,
    resume
  }: {
    tmbId: string;
    chatId: string;
    resume: DesktopBrowserResumeState;
  }): Promise<void> {
    await this.redis.set({
      key: this.browserResumeKey(tmbId, chatId),
      value: JSON.stringify(resume),
      ttlMs: DESKTOP_BROWSER_RESUME_TTL_MS
    });
  }

  async getBrowserResume({
    tmbId,
    chatId
  }: {
    tmbId: string;
    chatId: string;
  }): Promise<DesktopBrowserResumeState | undefined> {
    const raw = await this.redis.get(this.browserResumeKey(tmbId, chatId));
    if (!raw) return undefined;

    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object') return undefined;
      if (typeof value.goal !== 'string' || typeof value.url !== 'string') return undefined;
      if (typeof value.updatedAt !== 'number') return undefined;
      return value as DesktopBrowserResumeState;
    } catch {
      return undefined;
    }
  }

  /** 长轮询心跳在 60 秒内视为在线；执行中的指令单独保活。 */
  async isDeviceOnline(deviceId: string): Promise<boolean> {
    const [heartbeat, busy] = await Promise.all([
      this.redis.get(this.heartbeatKey(deviceId)),
      this.redis.get(this.busyKey(deviceId))
    ]);
    return heartbeat === '1' || busy === '1';
  }

  /**
   * 注销设备：只允许设备所属成员撤销。
   * 令牌、设备记录、在线心跳与未消费队列一并删除，避免退出登录后仍可被调用。
   */
  async revoke({ deviceId, tmbId }: { deviceId: string; tmbId: string }): Promise<boolean> {
    const device = await this.getDevice(deviceId);
    if (!device || device.tmbId !== tmbId) return false;

    await this.redis.delete(this.tokenKey(device.tokenHash));
    await this.redis.delete(this.deviceKey(deviceId));
    await this.redis.delete(this.heartbeatKey(deviceId));
    await this.redis.delete(this.busyKey(deviceId));
    await this.redis.delete(this.queueKey(deviceId));

    const ownerDeviceId = await this.redis.get(this.ownerKey(tmbId));
    if (ownerDeviceId === deviceId) {
      await this.redis.delete(this.ownerKey(tmbId));
    }

    return true;
  }

  /** 返回该成员最近一次注册的桌面设备。 */
  async getDeviceByOwner(tmbId: string): Promise<string | undefined> {
    return (await this.redis.get(this.ownerKey(tmbId))) ?? undefined;
  }

  /** 返回该成员设备的客户端版本号；版本由注册时上报，缺失表示旧客户端。 */
  async getDeviceAppVersionByOwner(tmbId: string): Promise<string | undefined> {
    const deviceId = await this.getDeviceByOwner(tmbId);
    if (!deviceId) return undefined;
    return (await this.getDevice(deviceId))?.appVersion;
  }
}

export const desktopCommandStore = new DesktopCommandStore();

export const registerDesktopDevice = (params: RegisterDesktopDeviceParams) =>
  desktopCommandStore.register(params);

export const authenticateDesktopDevice = (params: {
  deviceId: string;
  authorization?: string | string[];
}) => desktopCommandStore.authenticate(params);

export const enqueueDesktopCommand = (params: {
  deviceId: string;
  command: DesktopAiCommand;
}) => desktopCommandStore.enqueue(params);

export const waitForDesktopCommand = (params: { deviceId: string; timeoutMs: number }) =>
  desktopCommandStore.waitForCommand(params);

export const saveDesktopCommandResult = (params: {
  commandId: string;
  result: DesktopCommandResult;
}) => desktopCommandStore.saveResult(params);

export const getDesktopCommandResult = (commandId: string) =>
  desktopCommandStore.getResult(commandId);

export const isDesktopDeviceOnline = (deviceId: string) =>
  desktopCommandStore.isDeviceOnline(deviceId);

export const clearDesktopDeviceBusy = (deviceId: string) =>
  desktopCommandStore.clearBusy(deviceId);

export const getDesktopDeviceByOwner = (tmbId: string) =>
  desktopCommandStore.getDeviceByOwner(tmbId);

export const getDesktopDeviceAppVersionByOwner = (tmbId: string) =>
  desktopCommandStore.getDeviceAppVersionByOwner(tmbId);

export const revokeDesktopDevice = (params: { deviceId: string; tmbId: string }) =>
  desktopCommandStore.revoke(params);

export const waitForDesktopCommandResult = (params: {
  commandId: string;
  timeoutMs: number;
  pollIntervalMs?: number;
}) => desktopCommandStore.waitForResult(params);

export const saveDesktopBrowserResume = (params: {
  tmbId: string;
  chatId: string;
  resume: DesktopBrowserResumeState;
}) => desktopCommandStore.saveBrowserResume(params);

export const getDesktopBrowserResume = (params: { tmbId: string; chatId: string }) =>
  desktopCommandStore.getBrowserResume(params);
