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
  findStart: 'lugang:find-start',
  findNext: 'lugang:find-next',
  findStop: 'lugang:find-stop',
  findResult: 'lugang:find-result',
  zoomSet: 'lugang:zoom-set',
  zoomReset: 'lugang:zoom-reset',
  zoomChanged: 'lugang:zoom-changed',
  zoomRestored: 'lugang:zoom-restored',
  downloadsList: 'lugang:downloads-list',
  downloadOpen: 'lugang:download-open',
  downloadShowInFolder: 'lugang:download-show-in-folder',
  downloadCancel: 'lugang:download-cancel',
  downloadDismiss: 'lugang:download-dismiss',
  downloadsChanged: 'lugang:downloads-changed',
  pagePrint: 'lugang:page-print',
  pageSavePdf: 'lugang:page-save-pdf',
  pageCopyLink: 'lugang:page-copy-link',
  pageOpenExternal: 'lugang:page-open-external',
  pageMenu: 'lugang:page-menu',
  siteAiMenu: 'lugang:site-ai-menu',
  siteAiPrefGet: 'lugang:site-ai-pref-get',
  siteAiPrefSet: 'lugang:site-ai-pref-set',
  siteAiPrefChanged: 'lugang:site-ai-pref-changed',
  clearBrowsingData: 'lugang:clear-browsing-data',
  panelCommand: 'lugang:panel-command',
  retryLoad: 'lugang:retry-load',
  aiStatus: 'lugang:ai-status',
  aiStop: 'lugang:ai-stop',
  aiTakeover: 'lugang:ai-takeover',
  aiResume: 'lugang:ai-resume',
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
  documentsChanged: 'lugang:documents-changed',
  libraryList: 'lugang:library-list',
  libraryImport: 'lugang:library-import',
  libraryOpen: 'lugang:library-open',
  libraryStar: 'lugang:library-star',
  libraryReveal: 'lugang:library-reveal',
  libraryOpenExternal: 'lugang:library-open-external',
  libraryTrash: 'lugang:library-trash',
  libraryRemove: 'lugang:library-remove',
  libraryRelocate: 'lugang:library-relocate',
  libraryChanged: 'lugang:library-changed',
  diagnosticsExport: 'lugang:diagnostics-export'
} as const;

export type DesktopTab = {
  id: number;
  title: string;
  url: string;
  current: boolean;
  /** 鲁港通 - AI 会话绑定的标签：面板显示锁徽标，关闭入口统一拦截 */
  locked?: boolean;
};

/** 鲁港通 - 站点级 AI 权限：默认允许，仅由用户在本机主动收紧 */
export type DesktopSiteAiMode = 'allow' | 'read_only' | 'blocked';

export type DesktopSiteAiPrefChange = {
  origin: string;
  mode: DesktopSiteAiMode;
};

export type DesktopBrowserState = {
  panelOpen: boolean;
  activeTabId: number | null;
  tabs: DesktopTab[];
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  zoomPercent: number;
  /** 鲁港通 - 当前活动站点生效的 AI 权限；旧版客户端可能不返回 */
  siteAiMode?: DesktopSiteAiMode;
};

/** 鲁港通 - 地址栏导航状态：后退/前进可用态、当前站点缩放档位与 AI 权限 */
export type DesktopBrowserNavState = {
  canGoBack: boolean;
  canGoForward: boolean;
  zoomPercent: number;
  siteAiMode: DesktopSiteAiMode;
};

/** 鲁港通 - 页内查找命中：activeMatchOrdinal 从 1 起，matches 为 0 表示无结果 */
export type DesktopFindResult = {
  activeMatchOrdinal: number;
  matches: number;
  finalUpdate: boolean;
};

/** 鲁港通 - 换到已记忆缩放的站点时通知面板做一次轻提示 */
export type DesktopZoomRestore = {
  origin: string;
  percent: number;
};

export type DesktopDownloadStatus = 'progressing' | 'completed' | 'cancelled' | 'interrupted';

/** 鲁港通 - 下载任务条只暴露展示字段，本机保存路径始终留在主进程 */
export type DesktopDownloadItem = {
  id: string;
  fileName: string;
  receivedBytes: number;
  totalBytes: number;
  status: DesktopDownloadStatus;
};

/** 鲁港通 - 主进程向面板发出的 UI 指令（网页焦点在原生视图时使用） */
export type DesktopPanelCommand =
  | 'find'
  | 'close-find'
  | 'focus-url'
  | 'clear-data'
  | 'shortcuts'
  | 'timeline';

export type DesktopClearBrowsingDataOptions = {
  cookies: boolean;
  cache: boolean;
  permissions: boolean;
};

export type DesktopVersionInfo = { appVersion: string; protocolVersion: number };

export type DesktopAiStatus = 'idle' | 'running' | 'paused' | 'stopped';

/** 鲁港通 - 时间线步骤状态：运行中 / 成功 / 失败 / 等待确认 / 已接管 */
export type DesktopAiStepStatus = 'running' | 'ok' | 'failed' | 'confirming' | 'paused';

export type DesktopAiStep = {
  id: string;
  at: number;
  action: string;
  label: string;
  /** 鲁港通 - 只放元素描述或域名，输入框内容绝不进入时间线 */
  target?: string;
  url?: string;
  status: DesktopAiStepStatus;
  code?: string;
};

export type DesktopAiState = {
  status: DesktopAiStatus;
  reopens: number;
  stopReason?: string;
  message?: string;
  sessionUrl?: string;
  lockedTabId: number | null;
  /** 鲁港通 - 最近 30 步，正序；完整 50 步只留在主进程内存 */
  steps: DesktopAiStep[];
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

/** 鲁港通 - 下载进度：仅在 downloading 状态出现，下载完成/出错即清除 */
export type DesktopUpdateProgress = {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
};

export type DesktopUpdateStatus = {
  state: DesktopUpdateState;
  currentVersion: string;
  latestVersion?: string;
  progress?: DesktopUpdateProgress;
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

/** 鲁港通 - PDF 黄底叠加：矩形按页面宽高归一化（0~1，原点左上），网页端按渲染尺寸直接换算 */
export type DesktopPdfOverlayRect = { x: number; y: number; width: number; height: number };

export type DesktopPdfOverlayItem = {
  index: number;
  page: number;
  label: string;
  value: string;
  status: DesktopDocumentChangeStatus;
  labelRect?: DesktopPdfOverlayRect;
  valueRect?: DesktopPdfOverlayRect;
  note?: string;
};

export type DesktopPdfOverlay = {
  pages: number;
  items: DesktopPdfOverlayItem[];
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
  pdf?: DesktopPdfOverlay;
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

/** 鲁港通 - 资料库格式分档：只用于展示与预览分流，不等于完整 MIME */
export type DesktopLibraryKind = 'docx' | 'xlsx' | 'pdf' | 'image' | 'archive' | 'other';

/** 鲁港通 - 资料库来源：AI 生成、网页下载、编辑副本、本机导入 */
export type DesktopLibrarySource = 'ai' | 'download' | 'edit' | 'import';

/** 鲁港通 - 资料库条目：只含展示字段，绝对路径留在主进程 */
export type DesktopLibraryItem = {
  id: string;
  name: string;
  kind: DesktopLibraryKind;
  source: DesktopLibrarySource;
  size: number;
  addedAt: number;
  usedAt: number;
  starred: boolean;
  missing: boolean;
  origin?: string;
  parentName?: string;
};

/** 鲁港通 - 打开资料库条目的四种结果：文档会话、图片字节、不支持预览、文件缺失 */
export type DesktopLibraryOpenResult =
  | { type: 'document'; snapshot: DesktopDocumentSnapshot }
  | { type: 'image'; name: string; data: Uint8Array }
  | { type: 'unsupported'; reason?: 'image_too_large' }
  | { type: 'missing' };

/** 鲁港通 - 诊断包导出只回传是否已保存，具体保存路径由用户在本机选择 */
export type DesktopDiagnosticsExportResponse = { saved: boolean };

export type { CssRect };
