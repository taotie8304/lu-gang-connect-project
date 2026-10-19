// 鲁港通 - 桌面 AI 指令通道常量（P2 阶段一）
export const DESKTOP_COMMAND_NAMESPACE = 'desktop-command';
export const DESKTOP_COMMAND_KEY_VERSION = 1;

export const DESKTOP_TOKEN_PREFIX = 'lgd_';
/** 设备令牌与所有者映射保留 30 天；每次打开桌面端都会重新注册 */
export const DESKTOP_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 桌面端长轮询间隔会持续续期心跳，60 秒无请求视为离线 */
export const DESKTOP_HEARTBEAT_TTL_SECONDS = 60;

/** 待执行指令 10 分钟未被取走即失效，避免陈旧操作突然执行 */
export const DESKTOP_QUEUE_TTL_MS = 10 * 60 * 1000;

export const DESKTOP_RESULT_TTL_SECONDS = 5 * 60;

export const DESKTOP_LONG_POLL_DEFAULT_MS = 25_000;
export const DESKTOP_LONG_POLL_MAX_MS = 25_000;
export const DESKTOP_LONG_POLL_INTERVAL_MS = 500;

export const DESKTOP_COMMAND_MAX_BYTES = 32 * 1024;

/** 浏览器操作结果等待上限：桌面端单步操作通常在数秒内完成，30 秒未回传视为超时 */
export const DESKTOP_BROWSER_RESULT_TIMEOUT_MS = 30_000;
export const DESKTOP_BROWSER_RESULT_POLL_MS = 500;

/** 会话级浏览器续跑状态保留 10 分钟，与设计文档一致 */
export const DESKTOP_BROWSER_RESUME_TTL_MS = 10 * 60 * 1000;
