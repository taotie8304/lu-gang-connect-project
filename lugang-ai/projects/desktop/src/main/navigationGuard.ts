// 鲁港通 - 导航守卫：will-navigate 与 will-redirect 共用同一决策，服务端 302 重定向同样受控
// will-redirect 会对子帧触发，决策需带上帧上下文，避免把第三方 iframe 跳转当顶层导航处理
export type NavigationGuardDecision =
  | { type: 'allow' }
  | { type: 'prevent'; openExternal?: string };

export type NavigationGuardContext = { isMainFrame: boolean };

type NavigationGuardEvent = { preventDefault: () => void };
// 鲁港通 - 用两个重载表达 on：Electron 的 WebContents.on 是重载方法，联合签名无法直接结构化匹配
type NavigationGuardTarget = {
  on(
    event: 'will-navigate',
    listener: (event: NavigationGuardEvent, url: string) => void
  ): unknown;
  on(
    event: 'will-redirect',
    listener: (
      event: NavigationGuardEvent,
      url: string,
      isInPlace?: boolean,
      isMainFrame?: boolean
    ) => void
  ): unknown;
};

type InstallNavigationGuardOptions = {
  target: NavigationGuardTarget;
  decide: (url: string, context: NavigationGuardContext) => NavigationGuardDecision;
  // 鲁港通 - 外开动作注入，避免单测依赖 electron 运行时
  openExternal?: (url: string) => void;
};

export const installNavigationGuard = ({
  target,
  decide,
  openExternal
}: InstallNavigationGuardOptions) => {
  const apply = (event: NavigationGuardEvent, url: string, context: NavigationGuardContext) => {
    const decision = decide(url, context);
    if (decision.type === 'allow') return;
    event.preventDefault();
    if (decision.openExternal) openExternal?.(decision.openExternal);
  };
  target.on('will-navigate', (event, url) => apply(event, url, { isMainFrame: true }));
  // 鲁港通 - isMainFrame 缺省（旧签名或无帧信息）时按主帧处理，保持原有拦截强度
  target.on('will-redirect', (event, url, _isInPlace, isMainFrame) =>
    apply(event, url, { isMainFrame: isMainFrame !== false })
  );
};
