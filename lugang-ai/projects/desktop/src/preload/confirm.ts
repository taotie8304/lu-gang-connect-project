// 鲁港通 - 提交确认窗预加载：只允许回传三个固定决定
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';

const DECISIONS = new Set(['allow', 'handoff', 'cancel']);

if (window.location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('lugangConfirm', {
    decide: (decision: unknown) => {
      if (typeof decision === 'string' && DECISIONS.has(decision)) {
        ipcRenderer.send(IPC_CHANNELS.confirmDecision, decision);
      }
    }
  });
}
