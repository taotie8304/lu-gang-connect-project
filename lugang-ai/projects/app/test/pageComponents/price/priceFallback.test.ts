// 鲁港通 - 后台风格入口治理：价格页「返回」的兜底目标按角色分流
import { describe, expect, it } from 'vitest';
import { decidePriceFallback } from '@/pageComponents/price/priceFallback';

describe('decidePriceFallback', () => {
  it('falls back to the chat page for a normal user', () => {
    expect(decidePriceFallback({ showAdminFeatures: false })).toBe('/chat');
  });

  it('keeps the dashboard fallback for an admin', () => {
    expect(decidePriceFallback({ showAdminFeatures: true })).toBe('/dashboard/agent');
  });
});
