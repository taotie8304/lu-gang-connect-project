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
  aiExecuteSchema,
  booleanSchema,
  createTabSchema,
  cssRectSchema,
  documentDecideSchema,
  documentTokenPayloadSchema,
  navigateUrlSchema,
  tabIdSchema
} from './ipcSchemas';
import type { CssRect } from '../shared/geometry';
import type { BrowserManager } from './browser/manager';
import type { AiController } from './ai/controller';
import type { DeviceChannel } from './ai/deviceChannel';
import type { AiCommand } from './ai/protocol';
import type { DocumentPreviewManager } from './ai/documentPreview';
import type { WindowControls } from './windowChrome';
import type { UpdateController } from './update';

type RegisterIpcOptions = {
  mainWindow: BrowserWindow;
  appUrl: string;
  appVersion: string;
  browser: BrowserManager;
  ai: AiController;
  deviceChannel: Pick<DeviceChannel, 'syncSession' | 'clearSession' | 'stopAi'>;
  documents: Pick<
    DocumentPreviewManager,
    | 'openLocal'
    | 'list'
    | 'get'
    | 'claim'
    | 'decide'
    | 'applyAll'
    | 'close'
    | 'openCopy'
    | 'readDocument'
    | 'openExternal'
  >;
  windowControls: WindowControls;
  update: Pick<UpdateController, 'getStatus' | 'check' | 'install' | 'subscribe'>;
};

const INVALID_PAYLOAD = '请求参数无效，请刷新页面后重试';
const INVALID_SENDER = '请求来源无效';

export const registerIpc = ({
  mainWindow,
  appUrl,
  appVersion,
  browser,
  ai,
  deviceChannel,
  documents,
  windowControls,
  update
}: RegisterIpcOptions) => {
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

  handle(IPC_CHANNELS.aiStatus, () => ai.getState());
  handle(IPC_CHANNELS.aiStop, () => deviceChannel.stopAi());
  handle(
    IPC_CHANNELS.aiExecute,
    async (payload) => {
      const request = payload as {
        command: AiCommand;
        resume?: boolean;
        commandId?: string;
      };
      const result = await ai.execute(request.command, {
        resume: request.resume,
        commandId: request.commandId
      });
      return { result, state: ai.getState() };
    },
    aiExecuteSchema
  );

  // 鲁港通 - 网页端只能触发会话同步与退出清理，设备令牌始终留在主进程
  handle(IPC_CHANNELS.sessionSync, () => deviceChannel.syncSession());
  handle(IPC_CHANNELS.sessionLogout, () => deviceChannel.clearSession());

  // 鲁港通 - 文档预览：右栏文件标签读取本机会话，全部参数经 schema 校验
  handle(IPC_CHANNELS.documentsOpenLocal, () => documents.openLocal());
  handle(IPC_CHANNELS.documentsList, () => documents.list());
  handle(
    IPC_CHANNELS.documentsGet,
    (payload) => documents.get((payload as { token: string }).token),
    documentTokenPayloadSchema
  );
  handle(
    IPC_CHANNELS.documentsClaim,
    (payload) => documents.claim((payload as { token: string }).token),
    documentTokenPayloadSchema
  );
  handle(
    IPC_CHANNELS.documentsDecide,
    (payload) => {
      const { token, index, decision } = payload as {
        token: string;
        index: number;
        decision: 'apply' | 'skip';
      };
      return documents.decide(token, index, decision);
    },
    documentDecideSchema
  );
  handle(
    IPC_CHANNELS.documentsApplyAll,
    (payload) => documents.applyAll((payload as { token: string }).token),
    documentTokenPayloadSchema
  );
  handle(
    IPC_CHANNELS.documentsClose,
    (payload) => documents.close((payload as { token: string }).token),
    documentTokenPayloadSchema
  );
  handle(
    IPC_CHANNELS.documentsOpenCopy,
    (payload) => documents.openCopy((payload as { token: string }).token),
    documentTokenPayloadSchema
  );
  handle(
    IPC_CHANNELS.documentsRead,
    (payload) => documents.readDocument((payload as { token: string }).token),
    documentTokenPayloadSchema
  );
  handle(
    IPC_CHANNELS.documentsOpenExternal,
    (payload) => documents.openExternal((payload as { token: string }).token),
    documentTokenPayloadSchema
  );

  // 鲁港通 - 自绘标题栏的窗口按钮：全部走主窗口校验，关闭仍复用收进托盘策略
  handle(IPC_CHANNELS.windowMinimize, () => windowControls.minimize());
  handle(IPC_CHANNELS.windowToggleMaximize, () => windowControls.toggleMaximize());
  handle(IPC_CHANNELS.windowIsMaximized, () => windowControls.isMaximized());
  handle(IPC_CHANNELS.windowClose, () => windowControls.close());

  // 鲁港通 - 检查更新由网页端按钮触发，下载仍由 electron-updater 在后台完成
  handle(IPC_CHANNELS.updateStatus, () => update.getStatus());
  handle(IPC_CHANNELS.updateCheck, () => update.check());
  handle(IPC_CHANNELS.updateInstall, () => update.install());

  // 鲁港通 - 控制器状态变化实时推送给网页端，停止按钮与工作状态依赖此通道
  const unsubscribe = ai.subscribe((state) => {
    if (mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(IPC_CHANNELS.aiStatusChanged, state);
  });
  mainWindow.on('closed', unsubscribe);

  // 鲁港通 - 最大化/还原（含系统贴边与双击标题栏）同步给标题栏按钮图标
  const unsubscribeMaximize = windowControls.subscribe((maximized) => {
    if (mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(IPC_CHANNELS.windowMaximizeChanged, maximized);
  });
  mainWindow.on('closed', unsubscribeMaximize);

  // 鲁港通 - 更新状态推送给设置面板，检查/下载/失败都实时反映
  const unsubscribeUpdate = update.subscribe((status) => {
    if (mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(IPC_CHANNELS.updateStatusChanged, status);
  });
  mainWindow.on('closed', unsubscribeUpdate);

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
