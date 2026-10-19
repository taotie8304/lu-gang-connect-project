// 鲁港通 - 桌面客户端 AI 指令通道类型（P2 阶段一）：
// 指令由服务端入队，桌面端长轮询取走并回传结果；服务端不解析指令内部参数。
export type DesktopAiCommand = {
  action: string;
  [key: string]: unknown;
};

export type DesktopCommandEnvelope = {
  /** 指令 ID，用于结果回传与幂等去重 */
  id: string;
  /** 入队时间（毫秒时间戳） */
  createdAt: number;
  command: DesktopAiCommand;
};

/** 鲁港通 - 桌面浏览器页面快照：与桌面端 snapshot.ts 的 AiPageSnapshot 结构保持一致 */
export type DesktopBrowserScroll = {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
  pageHeight: number;
};

export type DesktopBrowserElement = {
  ref: string;
  role: string;
  name: string;
  tag: string;
  type?: string;
  placeholder?: string;
  text?: string;
  value?: string;
  autocomplete?: string;
  href?: string;
  checked?: boolean;
  disabled?: boolean;
  visible?: boolean;
  inViewport?: boolean;
  rect?: { x: number; y: number; width: number; height: number };
};

export type DesktopBrowserSnapshot = {
  url: string;
  title: string;
  text: string;
  scroll: DesktopBrowserScroll;
  elements: DesktopBrowserElement[];
  textTruncated?: boolean;
  elementsTruncated?: boolean;
};

/** 会话级浏览器任务续跑状态（按成员 + 聊天隔离，10 分钟过期） */
export type DesktopBrowserResumeState = {
  goal: string;
  url: string;
  updatedAt: number;
};

/** 本地生成或用户选择的文件：只回传文件名与所在目录，不回传内容 */
export type DesktopCommandFileResult = {
  name: string;
  format?: 'docx' | 'xlsx' | 'pdf' | 'other';
  folder?: string;
};

/** 提交前原生确认结果：只回传决定，不回传页面细节 */
export type DesktopCommandConfirmationResult = {
  required: boolean;
  decision: 'allow' | 'handoff' | 'cancel' | 'timeout' | 'unavailable';
  label?: string;
};

export type DesktopCommandResult = {
  ok: boolean;
  code?: string;
  message?: string;
  changed?: boolean;
  stopped?: boolean;
  /** 浏览器操作类指令执行后的最新页面快照 */
  snapshot?: DesktopBrowserSnapshot;
  /** generate_file / upload 的结果 */
  file?: DesktopCommandFileResult;
  /** 点击提交类按钮时的确认结果 */
  confirmation?: DesktopCommandConfirmationResult;
};

/** 设备注册（POST）：deviceId 由客户端生成并在本机持久化 */
export type RegisterDesktopDeviceRequest = {
  deviceId: string;
  deviceName?: string;
  appVersion?: string;
};

/** 设备注册响应：令牌仅返回一次，服务端只保存哈希 */
export type RegisterDesktopDeviceResponse = {
  token: string;
  expiresInMs: number;
};

/** 指令长轮询（GET）响应：无指令时 command 为 null */
export type GetDesktopCommandsResponse = {
  command: DesktopCommandEnvelope | null;
};

/** 结果回传（POST）：首次写入 accepted=true，重复回传 accepted=false */
export type SubmitDesktopCommandResultRequest = {
  deviceId: string;
  commandId: string;
  result: DesktopCommandResult;
};

export type SubmitDesktopCommandResultResponse = {
  accepted: boolean;
};

/** 设备撤销（POST）：设备用自身令牌确认身份后注销，已失效设备返回 revoked=false */
export type RevokeDesktopDeviceRequest = {
  deviceId: string;
};

export type RevokeDesktopDeviceResponse = {
  revoked: boolean;
};
