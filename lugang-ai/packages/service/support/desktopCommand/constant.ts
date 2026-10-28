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

/** 结构化文档正文（blocks/sheets 与旧客户端降级内容）会同时下发，上限放到 128KB */
export const DESKTOP_COMMAND_MAX_BYTES = 128 * 1024;

/** 浏览器操作结果等待上限：桌面端单步操作通常在数秒内完成，30 秒未回传视为超时 */
export const DESKTOP_BROWSER_RESULT_TIMEOUT_MS = 30_000;
export const DESKTOP_BROWSER_RESULT_POLL_MS = 500;

/** 提交前原生确认框的最长等待时间：超时自动取消，不提交 */
export const DESKTOP_BROWSER_CONFIRM_TIMEOUT_MS = 5 * 60 * 1000;
/** 点击可能等待用户确认，结果等待上限需覆盖确认窗口并留出操作余量 */
export const DESKTOP_BROWSER_CLICK_RESULT_TIMEOUT_MS =
  DESKTOP_BROWSER_CONFIRM_TIMEOUT_MS + DESKTOP_BROWSER_RESULT_TIMEOUT_MS;

/** 上传需要用户亲手在原生文件框中选择，结果等待上限需覆盖人工挑选文件的时间 */
export const DESKTOP_BROWSER_UPLOAD_RESULT_TIMEOUT_MS =
  DESKTOP_BROWSER_CONFIRM_TIMEOUT_MS + DESKTOP_BROWSER_RESULT_TIMEOUT_MS;

/**
 * 指令被客户端取走后到回传结果之前不会再有长轮询请求，心跳会自然过期。
 * 执行期间用独立标记保持在线，窗口与结果等待上限对齐并留出回传余量。
 */
export const DESKTOP_BUSY_TTL_MS = DESKTOP_BROWSER_RESULT_TIMEOUT_MS + 30_000;
export const DESKTOP_BUSY_LONG_TTL_MS = DESKTOP_BROWSER_CLICK_RESULT_TIMEOUT_MS + 30_000;

/** 需要等用户亲手操作的动作：确认提交、选择上传文件、选择表单、确认填写、选择与修改文档、确认 PDF 叠加 */
export const DESKTOP_LONG_WAIT_ACTIONS = [
  'click',
  'upload',
  'open_form',
  'fill_form',
  'open_document',
  'edit_document',
  'fill_pdf'
] as const;

export const isDesktopLongWaitAction = (action?: string): boolean =>
  typeof action === 'string' &&
  (DESKTOP_LONG_WAIT_ACTIONS as readonly string[]).includes(action);

export const getDesktopCommandBusyTtlMs = (action?: string) =>
  isDesktopLongWaitAction(action) ? DESKTOP_BUSY_LONG_TTL_MS : DESKTOP_BUSY_TTL_MS;

/** 会话级浏览器续跑状态保留 10 分钟，与设计文档一致 */
export const DESKTOP_BROWSER_RESUME_TTL_MS = 10 * 60 * 1000;
