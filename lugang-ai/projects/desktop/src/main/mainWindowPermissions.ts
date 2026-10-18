// 鲁港通 - 主窗口权限策略：只对应用源开放剪贴板读写，其余权限一律拒绝
const normalizeOrigin = (input: string): string | null => {
  try {
    const origin = new URL(input).origin;
    // 鲁港通 - file/data 等非层级协议的 origin 是字符串 "null"，不能作为可信来源
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
};

export const decideMainWindowPermission = ({
  permission,
  requestingOrigin,
  appOrigin
}: {
  permission: string;
  requestingOrigin: string;
  appOrigin: string;
}): boolean => {
  const app = normalizeOrigin(appOrigin);
  const requester = normalizeOrigin(requestingOrigin);
  if (!app || !requester || requester !== app) return false;
  return permission === 'clipboard-read' || permission === 'clipboard-sanitized-write';
};
