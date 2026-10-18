// 鲁港通 - 主窗口关闭策略：托盘可用且非显式退出时收进托盘，否则真正关闭
type WindowCloseDecision = {
  isQuitting: boolean;
  hasTray: boolean;
};

export type WindowCloseAction = 'hide-to-tray' | 'close';

export const decideWindowCloseAction = ({
  isQuitting,
  hasTray
}: WindowCloseDecision): WindowCloseAction => {
  if (isQuitting || !hasTray) return 'close';
  return 'hide-to-tray';
};
