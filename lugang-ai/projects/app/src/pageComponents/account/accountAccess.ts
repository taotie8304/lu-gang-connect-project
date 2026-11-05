// 鲁港通 - 账号页访问判定：/account/* 是 FastGPT 后台风格页，普通用户即使手敲网址
// 也不应进入（客户端与网页版统一）。userInfo 尚未拉到时先放行，否则会闪一次无效跳转。
export type AccountAccess = { type: 'allow' } | { type: 'redirect'; href: string };

export const decideAccountAccess = ({
  isUserInfoLoaded,
  showAdminFeatures,
  fallbackHref
}: {
  isUserInfoLoaded: boolean;
  showAdminFeatures: boolean;
  fallbackHref: string;
}): AccountAccess =>
  !isUserInfoLoaded || showAdminFeatures
    ? { type: 'allow' }
    : { type: 'redirect', href: fallbackHref };
