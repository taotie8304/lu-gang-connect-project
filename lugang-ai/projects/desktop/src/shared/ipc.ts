// 鲁港通 - 桌面桥 IPC 通道与数据类型（preload 与主进程共用）
import type { CssRect } from './geometry';

export const IPC_CHANNELS = {
  getVersion: 'lugang:get-version',
  openPanel: 'lugang:open-panel',
  closePanel: 'lugang:close-panel',
  getState: 'lugang:get-state',
  setBounds: 'lugang:set-bounds',
  setVisible: 'lugang:set-visible',
  navigate: 'lugang:navigate',
  reload: 'lugang:reload',
  goBack: 'lugang:go-back',
  goForward: 'lugang:go-forward',
  tabCreate: 'lugang:tab-create',
  tabSwitch: 'lugang:tab-switch',
  tabClose: 'lugang:tab-close',
  tabList: 'lugang:tab-list',
  tabRetry: 'lugang:tab-retry',
  stateChanged: 'lugang:state-changed',
  retryLoad: 'lugang:retry-load',
  aiStatus: 'lugang:ai-status',
  aiStop: 'lugang:ai-stop',
  aiExecute: 'lugang:ai-execute',
  aiStatusChanged: 'lugang:ai-status-changed',
  sessionSync: 'lugang:session-sync',
  sessionLogout: 'lugang:session-logout',
  confirmDecision: 'lugang:confirm-decision',
  formConfirmDecision: 'lugang:form-confirm-decision',
  formConfirmPayload: 'lugang:form-confirm-payload',
  windowMinimize: 'lugang:window-minimize',
  windowToggleMaximize: 'lugang:window-toggle-maximize',
  windowIsMaximized: 'lugang:window-is-maximized',
  windowClose: 'lugang:window-close',
  windowMaximizeChanged: 'lugang:window-maximize-changed',
  updateStatus: 'lugang:update-status',
  updateCheck: 'lugang:update-check',
  updateInstall: 'lugang:update-install',
  updateStatusChanged: 'lugang:update-status-changed',
  documentsOpenLocal: 'lugang:documents-open-local',
  documentsList: 'lugang:documents-list',
  documentsGet: 'lugang:documents-get',
  documentsClaim: 'lugang:documents-claim',
  documentsDecide: 'lugang:documents-decide',
  documentsApplyAll: 'lugang:documents-apply-all',
  documentsClose: 'lugang:documents-close',
  documentsOpenCopy: 'lugang:documents-open-copy',
  documentsRead: 'lugang:documents-read',
  documentsOpenExternal: 'lugang:documents-open-external',
  documentsSetActive: 'lugang:documents-set-active',
  documentsChanged: 'lugang:documents-changed'
} as const;

export type DesktopTab = { id: number; title: string; url: string; current: boolean };

export type DesktopBrowserState = {
  panelOpen: boolean;
  activeTabId: number | null;
  tabs: DesktopTab[];
  loading: boolean;
};

export type DesktopVersionInfo = { appVersion: string; protocolVersion: number };

export type DesktopAiStatus = 'idle' | 'running' | 'stopped';

export type DesktopAiState = {
  status: DesktopAiStatus;
  reopens: number;
  stopReason?: string;
  message?: string;
  sessionUrl?: string;
};

export type DesktopAiCommand = {
  action: string;
  [key: string]: unknown;
};

export type DesktopAiExecuteRequest = {
  command: DesktopAiCommand;
  resume?: boolean;
  commandId?: string;
};

export type DesktopAiExecuteResponse = {
  result: {
    ok: boolean;
    code?: string;
    message?: string;
    changed?: boolean;
    stopped?: boolean;
  };
  state: DesktopAiState;
};

/** 会话同步结果：只有 registered=true 表示设备已拿到令牌并开始接收指令 */
export type DesktopSessionSyncResponse = {
  registered: boolean;
};

/** 自动更新状态：unsupported 只在开发环境出现，网页端据此决定是否显示入口 */
export type DesktopUpdateState =
  | 'unsupported'
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'downloading'
  | 'downloaded'
  | 'error';

export type DesktopUpdateStatus = {
  state: DesktopUpdateState;
  currentVersion: string;
  latestVersion?: string;
};

/** 鲁港通 - 文档预览：文件标签与右栏预览共用同一份快照结构 */
export type DesktopDocumentFormat = 'docx' | 'xlsx' | 'pdf';

export type DesktopDocumentPreviewState =
  | 'pending'
  | 'reviewing'
  | 'finalizing'
  | 'viewing'
  | 'done'
  | 'no_change'
  | 'failed'
  | 'declined'
  | 'timeout';

export type DesktopDocumentChangeStatus = 'pending' | 'applied' | 'skipped' | 'unavailable';

export type DesktopDocumentMark = 'pending' | 'applied';

export type DesktopDocumentChange = {
  index: number;
  target: string;
  section?: string;
  before: string;
  after: string;
  status: DesktopDocumentChangeStatus;
  note?: string;
};

export type DesktopDocumentParagraphBlock = {
  id: string;
  kind: 'paragraph';
  index: number;
  text: string;
  heading?: number;
  originalText?: string;
  mark?: DesktopDocumentMark;
};

export type DesktopDocumentTableCellMark = {
  row: number;
  cell: number;
  mark: DesktopDocumentMark;
  original: string;
};

export type DesktopDocumentTableBlock = {
  id: string;
  kind: 'table';
  index: number;
  rows: string[][];
  mark?: DesktopDocumentMark;
  cellMarks?: DesktopDocumentTableCellMark[];
};

export type DesktopDocumentBlock = DesktopDocumentParagraphBlock | DesktopDocumentTableBlock;

export type DesktopDocumentSheet = {
  name: string;
  rowCount: number;
  columnCount: number;
  header: string[];
  sampleRows: string[][];
  rows?: string[][];
  truncatedRows?: boolean;
  truncatedColumns?: boolean;
  cellMarks?: DesktopDocumentTableCellMark[];
  appendedRows?: DesktopDocumentAppendedRow[];
};

export type DesktopDocumentAppendedRow = {
  rowNumber: number;
  values: string[];
  mark: DesktopDocumentMark;
};

export type DesktopDocumentSnapshot = {
  token: string;
  mode: 'review' | 'view';
  format: DesktopDocumentFormat;
  fileName: string;
  state: DesktopDocumentPreviewState;
  changes: DesktopDocumentChange[];
  blocks: DesktopDocumentBlock[];
  sheets?: DesktopDocumentSheet[];
  warnings: string[];
  copy?: { name: string; folder: string };
  message?: string;
};

export type DesktopDocumentSummary = {
  token: string;
  mode: 'review' | 'view';
  format: DesktopDocumentFormat;
  fileName: string;
  state: DesktopDocumentPreviewState;
  total: number;
  decided: number;
};

/** 鲁港通 - PDF 查看只把文件字节交给本机渲染进程，返回值里不出现本机路径 */
export type DesktopDocumentBytes = { name: string; data: Uint8Array };

export type { CssRect };
