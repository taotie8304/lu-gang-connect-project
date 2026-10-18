// 鲁港通 - 导航守卫：will-navigate 与 will-redirect 共用同一决策，服务端 302 重定向同样受控
export type NavigationGuardDecision =
  | { type: 'allow' }
  | { type: 'prevent'; openExternal?: string };

type NavigationGuardEvent = { preventDefault: () => void };
type NavigationGuardListener = (event: NavigationGuardEvent, url: string) => void;
// 鲁港通 - 用两个重载表达 on：Electron 的 WebContents.on 是重载方法，联合签名无法直接结构化匹配
type NavigationGuardTarget = {
  on: {
    (event: 'will-navigate', listener: NavigationGuardListener): unknown;
    (event: 'will-redirect', listener: NavigationGuardListener): unknown;
  };
};

type InstallNavigationGuardOptions = {
  target: NavigationGuardTarget;
  decide: (url: string) => NavigationGuardDecision;
  // 鲁港通 - 外开动作注入，避免单测依赖 electron 运行时
  openExternal?: (url: string) => void;
};

export const installNavigationGuard = ({
  target,
  decide,
  openExternal
}: InstallNavigationGuardOptions) => {
  const handler = (event: NavigationGuardEvent, url: string) => {
    const decision = decide(url);
    if (decision.type === 'allow') return;
    event.preventDefault();
    if (decision.openExternal) openExternal?.(decision.openExternal);
  };
  target.on('will-navigate', handler);
  target.on('will-redirect', handler);
};
