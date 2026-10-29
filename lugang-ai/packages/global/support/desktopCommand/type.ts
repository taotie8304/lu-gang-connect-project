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

/** 本地表单字段类型：只用于让模型理解结构，不含任何用户已填内容 */
export type DesktopFormField = {
  /** 回填时使用的稳定引用，例如 f3 / table:R2C1 */
  id: string;
  /** 字段名称或表头文字 */
  label: string;
  kind: 'text' | 'choice' | 'checkbox' | 'date' | 'table-cell' | 'unknown';
  required?: boolean;
  options?: string[];
  hint?: string;
};

/** open_form 返回的表单摘要：不含本机路径与文件内容 */
export type DesktopFormSummary = {
  format: 'docx' | 'xlsx' | 'pdf';
  name: string;
  title?: string;
  fields: DesktopFormField[];
  fieldsTruncated?: boolean;
  warnings?: string[];
};

/** fill_form 的写入结果：只回传统计与提示，不回传填写内容 */
export type DesktopFormFillResult = {
  filled: number;
  skipped?: string[];
  warnings?: string[];
};

/** open_document 返回的段落提纲：只含段落编号、摘要与样式，不含本机路径 */
export type DesktopDocumentParagraph = {
  index: number;
  text: string;
  style?: string;
};

export type DesktopDocumentTable = {
  index: number;
  rows: number;
  cells: number;
  header: string[];
};

export type DesktopDocumentSheetColumn = {
  col: string;
  header: string;
  /** 该列是合并区域的从属格，实际填写要写进主列 */
  mergedTo?: string;
  /** 该列由公式算出，不要写入普通值 */
  formula?: boolean;
};

export type DesktopDocumentSheet = {
  name: string;
  rowCount: number;
  columnCount: number;
  // 鲁港通 - 旧客户端不带这两个字段，服务端按第 1 行表头兜底
  headerRow?: number;
  header: string[];
  // 鲁港通 - 列对照：模型按真实列字母填写，合并列与公式列必须显式标出
  columns?: DesktopDocumentSheetColumn[];
  sampleRows: string[][];
  sampleRowNumbers?: number[];
  // 鲁港通 - 表单类工作表行数多时补充首列标签，模型才能按行填写
  rowLabels?: Array<{ row: number; text: string }>;
  rowLabelsTruncated?: boolean;
};

/** open_document 与 read 返回的文档提纲：不含整篇正文与文件路径；PDF 只给页数与标签提纲 */
export type DesktopDocumentSummary = {
  format: 'docx' | 'xlsx' | 'pdf';
  name: string;
  paragraphs?: DesktopDocumentParagraph[];
  tables?: DesktopDocumentTable[];
  paragraphsTruncated?: boolean;
  sheets?: DesktopDocumentSheet[];
  sheetsTruncated?: boolean;
  // 鲁港通 - PDF 叠加填写（0.8.7 起）：标签来自文本层，模型按标签给内容
  pdfPages?: number;
  pdfLabels?: string[];
  // 鲁港通 - 0.8.8 起保留同名字段的每次出现及所属分区，旧字段继续兼容 0.8.7
  pdfFields?: Array<{ page: number; label: string; section?: string }>;
  warnings?: string[];
};

/** edit_document 的写入结果：只回传统计与提示，不回传修改内容 */
export type DesktopDocumentEditResult = {
  applied: number;
  skipped?: string[];
  warnings?: string[];
};

export type DesktopCommandResult = {
  ok: boolean;
  code?: string;
  message?: string;
  changed?: boolean;
  stopped?: boolean;
  /** 浏览器操作类指令执行后的最新页面快照 */
  snapshot?: DesktopBrowserSnapshot;
  /** generate_file / upload / fill_form 的结果 */
  file?: DesktopCommandFileResult;
  /** 点击提交类按钮时的确认结果 */
  confirmation?: DesktopCommandConfirmationResult;
  /** open_form 的表单结构摘要 */
  form?: DesktopFormSummary;
  /** open_form 返回的表单引用：fill_form 回填时原样带回，不含本机路径 */
  formToken?: string;
  /** fill_form 的写入统计 */
  fill?: DesktopFormFillResult;
  /** open_document 的文档提纲 */
  document?: DesktopDocumentSummary;
  /** open_document 返回的文档引用：edit_document 修改时原样带回，不含本机路径 */
  documentToken?: string;
  /** edit_document 的写入统计 */
  edit?: DesktopDocumentEditResult;
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

/** 鲁港通 - 桌面设备视图：用于「我的设备」与管理页，不包含令牌哈希 */
export type DesktopDeviceView = {
  deviceId: string;
  deviceName?: string;
  appVersion?: string;
  tmbId: string;
  online: boolean;
  registeredAt: number;
  /** 仅管理员列表补充账号名 */
  memberName?: string;
};

export type ListDesktopDevicesResponse = {
  devices: DesktopDeviceView[];
};

export type UnbindDesktopDeviceRequest = {
  deviceId: string;
};

export type UnbindDesktopDeviceResponse = {
  revoked: boolean;
};

/** 鲁港通 - 桌面端崩溃上报：客户端已脱敏，服务端再次截断长度后存储 */
export type DesktopCrashReportType =
  | 'uncaught-exception'
  | 'unhandled-rejection'
  | 'renderer-crash'
  | 'manual';

export type DesktopCrashReportInput = {
  type: DesktopCrashReportType;
  message: string;
  stack?: string;
  /** 发生时间（毫秒时间戳） */
  occurredAt: number;
  /** 崩溃前最近的日志片段（已脱敏） */
  log?: string;
};

export type SubmitDesktopCrashReportsRequest = {
  deviceId: string;
  deviceName?: string;
  appVersion?: string;
  platform?: string;
  reports: DesktopCrashReportInput[];
};

export type SubmitDesktopCrashReportsResponse = {
  accepted: number;
};

export type DesktopCrashReportView = {
  id: string;
  deviceId: string;
  deviceName?: string;
  tmbId: string;
  appVersion?: string;
  platform?: string;
  type: DesktopCrashReportType;
  message: string;
  stack?: string;
  log?: string;
  occurredAt: number;
  createdAt: number;
  /** 仅管理员列表补充账号名 */
  memberName?: string;
};

export type ListDesktopCrashReportsResponse = {
  reports: DesktopCrashReportView[];
};

/** 鲁港通 - AI 操控远程开关：记录保存在数据库，未保存时回落环境变量 */
export type DesktopSwitchMode = 'off' | 'all' | 'list';

export type DesktopSwitchState = {
  mode: DesktopSwitchMode;
  accounts: string[];
  /** database=正在使用管理页保存的配置；env=沿用环境变量灰度 */
  source: 'database' | 'env';
  updatedAt?: number;
  updatedBy?: string;
};

export type UpdateDesktopAiSwitchRequest = {
  mode: DesktopSwitchMode;
  accounts?: string[];
};

export type UpdateDesktopAiSwitchResponse = DesktopSwitchState;
