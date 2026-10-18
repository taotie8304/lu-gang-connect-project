// 鲁港通 - 标签页预加载：仅在本地错误页暴露重试入口
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';

if (window.location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('lugangTab', {
    retry: () => ipcRenderer.send(IPC_CHANNELS.tabRetry)
  });
}
