// 鲁港通 - 退出登录完整清理：桌面客户端先关闭内置浏览器并撤销设备注册，再清理本地会话与登录态
export type LogoutDeps = {
  closeBrowserPanel?: () => unknown;
  clearDesktopSession?: () => unknown;
  resetChatCache: () => void;
  clearUserInfo: () => void;
  clearToken: () => unknown;
  redirectToLogin: () => void;
};

export const performLogout = ({
  closeBrowserPanel,
  clearDesktopSession,
  resetChatCache,
  clearUserInfo,
  clearToken,
  redirectToLogin
}: LogoutDeps) => {
  if (closeBrowserPanel) {
    try {
      void Promise.resolve(closeBrowserPanel()).catch(() => undefined);
    } catch {
      // 鲁港通 - 内置浏览器关闭失败不阻断退出，避免用户被留在已登录状态
    }
  }
  // 鲁港通 - 设备撤销必须早于 clearToken：登录 Cookie 一旦清除，主进程就无法再同步设备身份
  if (clearDesktopSession) {
    try {
      void Promise.resolve(clearDesktopSession()).catch(() => undefined);
    } catch {
      // 鲁港通 - 设备撤销失败不阻断退出，服务端登录态失效后设备令牌自然作废
    }
  }
  resetChatCache();
  clearUserInfo();
  clearToken();
  redirectToLogin();
};
