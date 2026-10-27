// 鲁港通 - 文档修改确认窗预加载：只接收主进程下发的改动清单回传两个固定决定
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';

const DECISIONS = new Set(['allow', 'cancel']);

if (window.location.protocol === 'file:') {
  let pending: unknown;
  let hasPending = false;
  let onPayload: ((payload: unknown) => void) | undefined;

  ipcRenderer.on(IPC_CHANNELS.documentConfirmPayload, (_event, payload) => {
    if (onPayload) {
      onPayload(payload);
      return;
    }
    pending = payload;
    hasPending = true;
  });

  contextBridge.exposeInMainWorld('lugangDocumentConfirm', {
    onPayload: (callback: unknown) => {
      if (typeof callback !== 'function') return;
      onPayload = callback as (payload: unknown) => void;
      if (!hasPending) return;
      hasPending = false;
      onPayload(pending);
      pending = undefined;
    },
    decide: (decision: unknown) => {
      if (typeof decision === 'string' && DECISIONS.has(decision)) {
        ipcRenderer.send(IPC_CHANNELS.documentConfirmDecision, decision);
      }
    }
  });
}