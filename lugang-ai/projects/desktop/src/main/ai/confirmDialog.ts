// 鲁港通 - 提交前原生确认窗：确认仅当前步骤有效，取消为默认选项，5 分钟不操作自动取消
import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { IPC_CHANNELS } from '../../shared/ipc';
import { createConfirmationGate, AI_CONFIRM_TIMEOUT_MS } from './confirmationGate';
import type { AiConfirmationDecision, AiConfirmer } from './executor';

const CONFIRM_WINDOW_WIDTH = 480;
const CONFIRM_WINDOW_HEIGHT = 420;

type ConfirmerDecision = Extract<AiConfirmationDecision, 'allow' | 'handoff' | 'cancel'>;

const isDecision = (value: unknown): value is ConfirmerDecision =>
  value === 'allow' || value === 'handoff' || value === 'cancel';

export type CreateAiConfirmerOptions = {
  getParentWindow: () => BrowserWindow | undefined;
  preloadPath: string;
  rendererDir: string;
  timeoutMs?: number;
};

export const createAiConfirmer = (options: CreateAiConfirmerOptions): AiConfirmer => {
  let cancelActive: (() => void) | undefined;

  const confirmer = (async (request: {
    host: string;
    label: string;
    url?: string;
  }): Promise<AiConfirmationDecision> => {
    const parent = options.getParentWindow();
    if (!parent || parent.isDestroyed()) return 'cancel';
    if (cancelActive) return 'cancel';

    const timeoutMs = options.timeoutMs ?? AI_CONFIRM_TIMEOUT_MS;
    const page = new BrowserWindow({
      parent,
      modal: true,
      show: false,
      center: true,
      width: CONFIRM_WINDOW_WIDTH,
      height: CONFIRM_WINDOW_HEIGHT,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      title: '提交前确认',
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
    page.webContents.ipc.on(IPC_CHANNELS.confirmDecision, onDecision);
    // 鲁港通 - 用户直接关掉确认窗时按取消处理，绝不放行提交
    page.on('closed', () => gate.decide('cancel'));

    try {
      await page.loadFile(join(options.rendererDir, 'confirm.html'), {
        query: {
          host: request.host,
          label: request.label,
          url: request.url ?? '',
          timeoutMs: String(timeoutMs)
        }
      });
      if (!page.isDestroyed()) page.show();
    } catch {
      gate.decide('cancel');
    }

    const decision = await gate.promise;
    cancelActive = undefined;
    page.webContents.ipc.removeListener(IPC_CHANNELS.confirmDecision, onDecision);
    if (!page.isDestroyed()) page.destroy();
    return decision;
  }) as AiConfirmer;

  // 鲁港通 - 用户点停止时立即取消等待中的确认，避免停止后仍被误提交
  confirmer.cancel = () => cancelActive?.();

  return confirmer;
};
