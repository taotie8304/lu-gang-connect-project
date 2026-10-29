import { DesktopCommandStore } from '@fastgpt/service/support/desktopCommand/store';

type FakeEntry = { value: string; expiresAt?: number };

export class FakeRedis {
  private readonly entries = new Map<string, FakeEntry>();
  readonly setCalls: Array<{ key: string; ttlMs?: number }> = [];

  constructor(private readonly now: () => number) {}

  private alive(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== undefined && entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  async get(key: string) {
    return this.alive(key)?.value ?? null;
  }

  async set({ key, value, ttlMs }: { key: string; value: string; ttlMs?: number }) {
    this.setCalls.push({ key, ttlMs });
    this.entries.set(key, {
      value,
      expiresAt: ttlMs === undefined ? undefined : this.now() + ttlMs
    });
  }

  async setIfAbsent({
    key,
    value,
    ttlSeconds
  }: {
    key: string;
    value: string;
    ttlSeconds: number;
  }) {
    if (this.alive(key)) return false;
    this.entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
    return true;
  }

  async delete(key: string) {
    return this.entries.delete(key);
  }

  async evalScript({
    script,
    keys,
    args = []
  }: {
    script: string;
    keys: readonly string[];
    args?: readonly (string | number)[];
  }) {
    const key = keys[0];
    const existing = this.alive(key)?.value;

    if (script.includes('desktop-command:push')) {
      const queue = existing ? (JSON.parse(existing) as string[]) : [];
      queue.push(String(args[0]));
      this.setCalls.push({ key, ttlMs: Number(args[1]) });
      this.entries.set(key, {
        value: JSON.stringify(queue),
        expiresAt: this.now() + Number(args[1])
      });
      return queue.length;
    }

    if (script.includes('desktop-command:pop')) {
      if (!existing) return null;
      const queue = JSON.parse(existing) as string[];
      if (queue.length === 0) return null;
      const item = queue.shift()!;
      if (queue.length === 0) {
        this.entries.delete(key);
      } else {
        this.entries.set(key, { value: JSON.stringify(queue), expiresAt: this.alive(key)?.expiresAt });
      }
      return item;
    }

    if (script.includes('desktop-command:index-add')) {
      const entry = JSON.parse(String(args[0])) as { deviceId: string };
      const limit = Number(args[1]);
      const ttlMs = Number(args[2]);
      const list = existing ? (JSON.parse(existing) as Array<{ deviceId: string }>) : [];
      const next = [entry, ...list.filter((item) => item?.deviceId !== entry.deviceId)].slice(
        0,
        limit
      );
      this.setCalls.push({ key, ttlMs });
      this.entries.set(key, { value: JSON.stringify(next), expiresAt: this.now() + ttlMs });
      return next.length;
    }

    if (script.includes('desktop-command:index-remove')) {
      if (!existing) return 0;
      const deviceId = String(args[0]);
      const expiresAt = this.alive(key)?.expiresAt;
      const next = (JSON.parse(existing) as Array<{ deviceId: string }>).filter(
        (item) => item?.deviceId !== deviceId
      );
      if (next.length === 0) {
        this.entries.delete(key);
      } else {
        this.entries.set(key, { value: JSON.stringify(next), expiresAt });
      }
      return next.length;
    }

    throw new Error(`Unexpected script: ${script}`);
  }
}

/** 可控时钟 + 内存 Redis 的指令通道测试实例。 */
export const createTestStore = () => {
  let clock = 1_000;
  const now = () => clock;
  const redis = new FakeRedis(now);
  const store = new DesktopCommandStore({
    redis: redis as any,
    now,
    sleep: async (ms) => {
      clock += ms;
    }
  });

  return {
    store,
    redis,
    now,
    advance: (ms: number) => {
      clock += ms;
    }
  };
};
