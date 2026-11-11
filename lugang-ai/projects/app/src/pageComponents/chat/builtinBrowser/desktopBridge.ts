// 鲁港通 - 桌面客户端桥类型：与 projects/desktop/src/shared/ipc.ts 保持结构一致
export type DesktopCssRect = { x: number; y: number; width: number; height: number };

export type DesktopTab = {
  id: number;
  title: string;
  url: string;
  current: boolean;
  /** 鲁港通 - AI 会话绑定的标签：显示锁徽标并拦截关闭入口 */
  locked?: boolean;
};

export type DesktopBrowserState = {
  panelOpen: boolean;
  activeTabId: number | null;
  tabs: DesktopTab[];
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  zoomPercent: number;
};

/** 鲁港通 - 地址栏导航状态：与 projects/desktop/src/shared/ipc.ts 对应 */
export type DesktopBrowserNavState = {
  canGoBack: boolean;
  canGoForward: boolean;
  zoomPercent: number;
};

export type DesktopFindResult = {
  activeMatchOrdinal: number;
  matches: number;
  finalUpdate: boolean;
};

export type DesktopZoomRestore = {
  origin: string;
  percent: number;
};

export type DesktopDownloadStatus = 'progressing' | 'completed' | 'cancelled' | 'interrupted';

export type DesktopDownloadItem = {
  id: string;
  fileName: string;
  receivedBytes: number;
  totalBytes: number;
  status: DesktopDownloadStatus;
};

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

/** 鲁港通 - 内置浏览器 P0 能力；0.10.0 起提供，老客户端没有这个对象 */
export type DesktopBrowserControls = {
  getNav(): Promise<DesktopBrowserNavState>;
  onNavChange(callback: (state: DesktopBrowserNavState) => void): () => void;
  goBack(): Promise<boolean>;
  goForward(): Promise<boolean>;
  findStart(query: string): Promise<void>;
  findNext(direction: 'next' | 'previous'): Promise<void>;
  findStop(): Promise<void>;
  onFindResult(callback: (result: DesktopFindResult) => void): () => void;
  setZoom(percent: number): Promise<number>;
  resetZoom(): Promise<number>;
  onZoomChange(callback: (percent: number) => void): () => void;
  onZoomRestore(callback: (payload: DesktopZoomRestore) => void): () => void;
  listDownloads(): Promise<DesktopDownloadItem[]>;
  onDownloadsChange(callback: (list: DesktopDownloadItem[]) => void): () => void;
  openDownload(id: string): Promise<boolean>;
  showDownloadInFolder(id: string): Promise<boolean>;
  cancelDownload(id: string): Promise<void>;
  dismissDownload(id: string): Promise<void>;
  print(): Promise<boolean>;
  savePdf(): Promise<boolean>;
  copyLink(): Promise<boolean>;
  openExternal(): Promise<boolean>;
  openMenu(): Promise<void>;
  clearData(options: DesktopClearBrowsingDataOptions): Promise<boolean>;
  onCommand(callback: (command: DesktopPanelCommand) => void): () => void;
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

export type DesktopSessionSyncResponse = {
  registered: boolean;
};

/** 自绘标题栏的窗口按钮；老客户端没有这个能力，网页端据此决定是否渲染标题栏 */
export type DesktopWindowControls = {
  minimize(): void;
  toggleMaximize(): Promise<boolean>;
  close(): void;
  isMaximized(): Promise<boolean>;
  onMaximizeChange(callback: (maximized: boolean) => void): () => void;
};

/** 设置面板「检查更新」；老客户端没有这个能力，网页端据此隐藏该入口 */
export type DesktopUpdateState =
  | 'unsupported'
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'downloading'
  | 'downloaded'
  | 'error';

/** 鲁港通 - 下载进度：与 projects/desktop/src/shared/ipc.ts 对应，0.9.0 起下发 */
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

export type DesktopUpdateControls = {
  getStatus(): Promise<DesktopUpdateStatus>;
  check(): Promise<DesktopUpdateStatus>;
  install(): Promise<void>;
  onStatusChange(callback: (status: DesktopUpdateStatus) => void): () => void;
};

/** 设置面板「导出诊断包」；0.8.9 起支持，老客户端没有该能力时隐藏入口 */
export type DesktopDiagnosticsControls = {
  exportBundle(): Promise<{ saved: boolean }>;
};

/** 鲁港通 - 文档预览类型镜像：与 projects/desktop/src/shared/ipc.ts 对应 */
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

export type DesktopDocumentAppendedRow = {
  rowNumber: number;
  values: string[];
  mark: DesktopDocumentMark;
};

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

/** 鲁港通 - PDF 黄底叠加：矩形按页面宽高归一化（0~1，原点左上），网页端按渲染尺寸直接换算 */
export type DesktopPdfOverlayItem = {
  index: number;
  page: number;
  label: string;
  value: string;
  status: DesktopDocumentChangeStatus;
  labelRect?: DesktopCssRect;
  valueRect?: DesktopCssRect;
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

/** 文件只在本机解析；老客户端没有这个对象，网页端据此隐藏文件入口 */
export type DesktopDocuments = {
  openLocal(): Promise<DesktopDocumentSnapshot | null>;
  list(): Promise<DesktopDocumentSummary[]>;
  get(token: string): Promise<DesktopDocumentSnapshot | null>;
  claim(token: string): Promise<DesktopDocumentSnapshot | null>;
  decide(
    token: string,
    index: number,
    decision: 'apply' | 'skip'
  ): Promise<DesktopDocumentSnapshot | null>;
  applyAll(token: string): Promise<DesktopDocumentSnapshot | null>;
  close(token: string): Promise<void>;
  openCopy(token: string): Promise<boolean>;
  /** 0.8.0 起支持；老客户端缺少此能力时 PDF 回退到系统默认程序 */
  read?(token: string): Promise<DesktopDocumentBytes | null>;
  openExternal?(token: string): Promise<boolean>;
  /** 0.8.1 起支持；把右栏当前文件标签同步给主进程，供 AI 直接读取 */
  setActive?(token: string | null): void;
  onChanged(callback: (list: DesktopDocumentSummary[]) => void): () => void;
};

export type DesktopBridge = {
  isAvailable(): boolean;
  getVersion(): Promise<DesktopVersionInfo>;
  openPanel(): Promise<DesktopBrowserState>;
  closePanel(): Promise<DesktopBrowserState>;
  getState(): Promise<DesktopBrowserState>;
  setBounds(rect: DesktopCssRect): void;
  setVisible(visible: boolean): void;
  navigate(url: string): Promise<boolean>;
  reload(): Promise<boolean>;
  goBack(): Promise<boolean>;
  goForward(): Promise<boolean>;
  /** 0.10.0 起提供：后退/前进、页内查找、缩放、下载与页面动作 */
  browser?: DesktopBrowserControls;
  documents?: DesktopDocuments;
  tabs: {
    create(url?: string): Promise<DesktopBrowserState>;
    switch(id: number): Promise<DesktopBrowserState>;
    close(id: number): Promise<DesktopBrowserState>;
    list(): Promise<DesktopBrowserState>;
  };
  onStateChange(callback: (state: DesktopBrowserState) => void): () => void;
  ai: {
    getState(): Promise<DesktopAiState>;
    stop(): Promise<DesktopAiState>;
    /** 0.11.0 起提供：一键接管暂停 AI，页面状态保留 */
    takeover?(): Promise<DesktopAiState>;
    /** 0.11.0 起提供：让 AI 继续 */
    resume?(): Promise<DesktopAiState>;
    execute(request: DesktopAiExecuteRequest): Promise<DesktopAiExecuteResponse>;
    onStateChange(callback: (state: DesktopAiState) => void): () => void;
  };
  session: {
    sync(): Promise<DesktopSessionSyncResponse>;
    logout(): Promise<void>;
  };
  windowControls?: DesktopWindowControls;
  update?: DesktopUpdateControls;
  diagnostics?: DesktopDiagnosticsControls;
  retryLoad(): void;
};

declare global {
  interface Window {
    lugangDesktop?: DesktopBridge;
  }
}

export const isDesktopBridgeAvailable = (): boolean =>
  typeof window !== 'undefined' && window.lugangDesktop?.isAvailable?.() === true;
