// 鲁港通 - 系统托盘：关闭主窗口时收进托盘，可从托盘恢复或退出
import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron';
import { join } from 'node:path';

type CreateTrayOptions = {
  window: BrowserWindow;
  onQuit: () => void;
};

export type TrayController = {
  tray: Tray;
  notifyHidden: () => void;
  destroy: () => void;
};

export const createTray = async ({
  window,
  onQuit
}: CreateTrayOptions): Promise<TrayController> => {
  // 鲁港通 - 托盘图标随 dist 分发（build.mjs 复制），缺失时回退到 exe 图标
  let image = nativeImage.createFromPath(join(__dirname, '..', 'tray-icon.png'));
  if (image.isEmpty()) {
    try {
      image = await app.getFileIcon(process.execPath, { size: 'normal' });
    } catch {
      // 取不到系统图标时保留空图，托盘仍可操作
    }
  }

  if (image.isEmpty()) {
    throw new Error('托盘图标不可用');
  }

  const tray = new Tray(image.resize({ width: 16, height: 16 }));

  const showWindow = () => {
    if (window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  };

  tray.setToolTip('鲁港通');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开鲁港通', click: showWindow },
      { type: 'separator' },
      { label: '退出鲁港通', click: onQuit }
    ])
  );
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);

  // 鲁港通 - 每次运行只提示一次，避免反复打扰
  let balloonShown = false;
  const notifyHidden = () => {
    if (balloonShown) return;
    balloonShown = true;
    tray.displayBalloon({
      iconType: 'info',
      title: '鲁港通已收进托盘',
      content: '点击托盘图标可重新打开，右键选择「退出鲁港通」可完全退出。'
    });
  };

  return {
    tray,
    notifyHidden,
    destroy: () => tray.destroy()
  };
};
