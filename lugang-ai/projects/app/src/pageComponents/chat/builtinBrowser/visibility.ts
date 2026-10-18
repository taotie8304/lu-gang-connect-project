// 鲁港通 - 办事浏览器可见性：手机端不开放；桌面客户端登录即用；网页端仍按灰度名单
import { BUILTIN_BROWSER_ALLOWED_USERNAMES } from '@fastgpt/global/support/builtinBrowser/constant';

export const canUseBuiltinBrowser = ({
  isPhone,
  username,
  isDesktop
}: {
  isPhone: boolean;
  username?: string;
  isDesktop: boolean;
}) => {
  if (isPhone || !username) return false;
  if (isDesktop) return true;
  return BUILTIN_BROWSER_ALLOWED_USERNAMES.includes(username);
};
