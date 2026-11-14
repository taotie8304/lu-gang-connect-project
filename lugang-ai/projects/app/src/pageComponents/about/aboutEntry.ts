export type AboutEntry = { kind: 'login' } | { kind: 'href'; href: string };

/**
 * 鲁港通 - 关于页「开始使用」目标：未登录去登录卡，已登录直达默认助手。
 * 与登录页跳转口径保持一致：root 进工作台，普通用户优先进入默认应用。
 */
export const resolveAboutEntry = ({
  username,
  defaultAppId
}: {
  username?: string;
  defaultAppId?: string;
}): AboutEntry => {
  if (!username) return { kind: 'login' };
  if (username !== 'root' && defaultAppId) {
    return { kind: 'href', href: `/chat?appId=${defaultAppId}&pane=ra` };
  }
  return { kind: 'href', href: '/dashboard/agent' };
};
