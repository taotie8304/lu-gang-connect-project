// 鲁港通 - IPC 注册：只接受主窗口主框架与标签错误页的请求，参数全部校验
import {
  ipcMain,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../shared/ipc';
import {
  booleanSchema,
  createTabSchema,
  cssRectSchema,
  navigateUrlSchema,
  tabIdSchema
} from './ipcSchemas';
import type { CssRect } from '../shared/geometry';
import type { BrowserManager } from './browser/manager';

type RegisterIpcOptions = {
  mainWindow: BrowserWindow;
  appUrl: string;
  appVersion: string;
  browser: BrowserManager;
};

const INVALID_PAYLOAD = '请求参数无效，请刷新页面后重试';
const INVALID_SENDER = '请求来源无效';

export const registerIpc = ({ mainWindow, appUrl, appVersion, browser }: RegisterIpcOptions) => {
  const appOrigin = new URL(appUrl).origin;

  const isMainSender = (event: IpcMainEvent | IpcMainInvokeEvent): boolean => {
    if (event.sender.id !== mainWindow.webContents.id) return false;
    const frame = event.senderFrame;
    if (!frame) return false;
    if (frame.frameTreeNodeId !== event.sender.mainFrame.frameTreeNodeId) return false;
    try {
      const url = new URL(frame.url);
      return url.protocol === 'file:' || url.origin === appOrigin;
    } catch {
      return false;
    }
  };

  const parsePayload = <T>(schema: z.ZodType<T>, payload: unknown): T => {
    const result = schema.safeParse(payload);
    if (!result.success) throw new Error(INVALID_PAYLOAD);
    return result.data;
  };

  const handle = (
    channel: string,
    run: (payload: unknown) => unknown,
    schema?: z.ZodType
  ) => {
    ipcMain.handle(channel, (event, payload) => {
      if (!isMainSender(event)) throw new Error(INVALID_SENDER);
      return run(schema ? parsePayload(schema, payload) : payload);
    });
  };

  const listen = (channel: string, run: (payload: unknown) => void, schema?: z.ZodType) => {
    ipcMain.on(channel, (event, payload) => {
      if (!isMainSender(event)) return;
      if (!schema) {
        run(payload);
        return;
      }
      const result = schema.safeParse(payload);
      if (result.success) run(result.data);
    });
  };

  handle(IPC_CHANNELS.getVersion, () => ({ appVersion, protocolVersion: 0 }));
  handle(IPC_CHANNELS.openPanel, () => browser.openPanel());
  handle(IPC_CHANNELS.closePanel, () => browser.closePanel());
  handle(IPC_CHANNELS.getState, () => browser.getState());
  handle(IPC_CHANNELS.navigate, (payload) => browser.navigate(payload as string), navigateUrlSchema);
  handle(IPC_CHANNELS.reload, () => browser.reload());
  handle(IPC_CHANNELS.goBack, () => browser.goBack());
  handle(IPC_CHANNELS.goForward, () => browser.goForward());
  handle(
    IPC_CHANNELS.tabCreate,
    (payload) => browser.createTab((payload as { url?: string } | undefined)?.url),
    createTabSchema
  );
  handle(IPC_CHANNELS.tabSwitch, (payload) => browser.selectTab(payload as number), tabIdSchema);
  handle(IPC_CHANNELS.tabClose, (payload) => browser.closeTab(payload as number), tabIdSchema);
  handle(IPC_CHANNELS.tabList, () => browser.getState());

  listen(IPC_CHANNELS.setBounds, (payload) => browser.setBounds(payload as CssRect), cssRectSchema);
  listen(IPC_CHANNELS.setVisible, (payload) => browser.setVisible(payload as boolean), booleanSchema);
  listen(IPC_CHANNELS.retryLoad, () => {
    void mainWindow.loadURL(appUrl).catch(() => undefined);
  });

  ipcMain.on(IPC_CHANNELS.tabRetry, (event) => {
    // 鲁港通 - 仅接受标签错误页（file://）主框架的重试请求
    const frame = event.senderFrame;
    if (!frame || !frame.url.startsWith('file://')) return;
    browser.retryTab(event.sender.id);
  });
};
