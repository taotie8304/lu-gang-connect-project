// 鲁港通 - 顶栏跳转一律同窗完成：window.open 会让桌面客户端弹出第二个窗口，
// 且新窗口不带客户端桥，用户无法从新窗口退回原来的会话。
export type NavbarNavigation = { type: 'navigate'; href: string } | { type: 'noop' };

export const decideNavbarNavigation = ({
  href,
  asPath
}: {
  href: string;
  asPath: string;
}): NavbarNavigation => (href === asPath ? { type: 'noop' } : { type: 'navigate', href });
