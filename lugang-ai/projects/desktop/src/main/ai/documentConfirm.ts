// 鲁港通 - 文档修改确认窗：生成副本前展示改动清单，取消为默认选项，5 分钟不操作自动取消
import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { IPC_CHANNELS } from '../../shared/ipc';
import { createConfirmationGate, AI_CONFIRM_TIMEOUT_MS } from './confirmationGate';
import type {
  AiDocumentConfirmDecision,
  AiDocumentConfirmRequest,
  AiDocumentConfirmer
} from './executor';

const DOCUMENT_CONFIRM_WINDOW_WIDTH = 560;
const DOCUMENT_CONFIRM_WINDOW_HEIGHT = 560;

type DocumentConfirmerDecision = Extract<AiDocumentConfirmDecision, 'allow' | 'cancel'>;

const isDecision = (value: unknown): value is DocumentConfirmerDecision =>
  value === 'allow' || value === 'cancel';

export type CreateAiDocumentConfirmerOptions = {
  getParentWindow: () => BrowserWindow | undefined;
  preloadPath: string;
  rendererDir: string;
  timeoutMs?: number;
};

export const createAiDocumentConfirmer = (
  options: CreateAiDocumentConfirmerOptions
): AiDocumentConfirmer => {
  let cancelActive: (() => void) | undefined;

  const confirmer = (async (
    request: AiDocumentConfirmRequest
  ): Promise<AiDocumentConfirmDecision> => {
    const parent = options.getParentWindow();
    if (!parent || parent.isDestroyed()) return 'unavailable';
    if (cancelActive) return 'cancel';

    const timeoutMs = options.timeoutMs ?? AI_CONFIRM_TIMEOUT_MS;
    const page = new BrowserWindow({
      parent,
      modal: true,
      show: false,
      center: true,
      width: DOCUMENT_CONFIRM_WINDOW_WIDTH,
      height: DOCUMENT_CONFIRM_WINDOW_HEIGHT,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      title: '修改前确认',
      webPreferences: {
        preload: options.preloadPath,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    page.removeMenu();
    page.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    page.webContents.on('will-navigate', (event) => event.preventDefault());

    const gate = createConfirmationGate({ timeoutMs });
    cancelActive = () => gate.decide('cancel');

    const onDecision = (event: Electron.IpcMainEvent, decision: unknown) => {
      if (event.sender !== page.webContents || !isDecision(decision)) return;
      gate.decide(decision);
    };
    page.webContents.ipc.on(IPC_CHANNELS.documentConfirmDecision, onDecision);
    // 鲁港通 - 用户直接关掉确认窗时按取消处理，绝不生成副本
    page.on('closed', () => gate.decide('cancel'));

    let loaded = true;
    try {
      await page.loadFile(join(options.rendererDir, 'documentConfirm.html'), {
        query: { timeoutMs: String(timeoutMs) }
      });
      // 鲁港通 - 改动内容可能含个人写作内容，只走进程间消息，不进 URL
      if (!page.isDestroyed()) {
        page.webContents.send(IPC_CHANNELS.documentConfirmPayload, request);
        page.show();
      }
    } catch {
      loaded = false;
      gate.decide('cancel');
    }

    const decision = await gate.promise;
    cancelActive = undefined;
    page.webContents.ipc.removeListener(IPC_CHANNELS.documentConfirmDecision, onDecision);
    if (!page.isDestroyed()) page.destroy();
    if (!loaded) return 'unavailable';
    if (decision === 'allow') return 'allow';
    if (decision === 'timeout') return 'timeout';
    return 'cancel';
  }) as AiDocumentConfirmer;

  // 鲁港通 - 用户点停止或页面被关闭时立即取消等待中的修改确认
  confirmer.cancel = () => cancelActive?.();

  return confirmer;
};