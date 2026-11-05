// 鲁港通 - 价格页兜底返回目标：普通用户没有后台首页（/dashboard/agent），
// 无历史记录可退时只能回到聊天页。
export const decidePriceFallback = ({ showAdminFeatures }: { showAdminFeatures: boolean }) =>
  showAdminFeatures ? '/dashboard/agent' : '/chat';
