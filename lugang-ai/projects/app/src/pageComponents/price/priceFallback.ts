// 鲁港通 - 价格页兜底返回目标：普通用户没有后台首页（/dashboard/agent），
// 无历史记录可退时只能回到聊天页。
export const decidePriceFallback = ({ showAdminFeatures }: { showAdminFeatures: boolean }) =>
  showAdminFeatures ? '/dashboard/agent' : '/chat';

export type PriceBackAction = { type: 'back' } | { type: 'push'; path: string };

// 鲁港通 - #684：新标签页自带一条不可见的 about:blank 历史，history.length > 1 会把
// 「无历史」误判成「可后退」，back 后落到空白页。Navigation API 的 index 只统计同源真实
// 页面，优先采信；旧浏览器退回 history.length + referrer 双重守卫。
export const decidePriceBackAction = ({
  navigationIndex,
  historyLength,
  referrer,
  showAdminFeatures
}: {
  navigationIndex?: number;
  historyLength: number;
  referrer: string;
  showAdminFeatures: boolean;
}): PriceBackAction => {
  const canGoBack =
    typeof navigationIndex === 'number'
      ? navigationIndex > 0
      : historyLength > 1 && referrer !== '';

  return canGoBack
    ? { type: 'back' }
    : { type: 'push', path: decidePriceFallback({ showAdminFeatures }) };
};
