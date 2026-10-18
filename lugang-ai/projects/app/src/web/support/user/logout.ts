// 鲁港通 - 退出登录完整清理：桌面客户端先关闭内置浏览器，再清理本地会话与登录态
export type LogoutDeps = {
  closeBrowserPanel?: () => unknown;
  resetChatCache: () => void;
  clearUserInfo: () => void;
  clearToken: () => unknown;
  redirectToLogin: () => void;
};

export const performLogout = ({
  closeBrowserPanel,
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
  resetChatCache();
  clearUserInfo();
  clearToken();
  redirectToLogin();
};
