// 鲁港通 - 桌面客户端桥类型：与 projects/desktop/src/shared/ipc.ts 保持结构一致
export type DesktopCssRect = { x: number; y: number; width: number; height: number };

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

export type DesktopUpdateStatus = {
  state: DesktopUpdateState;
  currentVersion: string;
  latestVersion?: string;
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
