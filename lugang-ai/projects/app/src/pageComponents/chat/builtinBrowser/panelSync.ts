// 鲁港通 - 桌面原生面板与网页外壳联动：AI 自动打开面板时立即铺开
import type { DesktopAiState, DesktopBrowserState } from './desktopBridge';

export const shouldAutoOpenPanel = (input: {
  isOpen: boolean;
  browser?: Pick<DesktopBrowserState, 'panelOpen'>;
  ai?: Pick<DesktopAiState, 'status'>;
}): boolean => {
  if (input.isOpen) return false;
  return input.browser?.panelOpen === true || input.ai?.status === 'running';
};
