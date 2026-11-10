// 鲁港通 - 后台风格入口治理：价格页「返回」的兜底目标按角色分流
import { describe, expect, it } from 'vitest';
import { decidePriceBackAction, decidePriceFallback } from '@/pageComponents/price/priceFallback';

describe('decidePriceFallback', () => {
  it('falls back to the chat page for a normal user', () => {
    expect(decidePriceFallback({ showAdminFeatures: false })).toBe('/chat');
  });

  it('keeps the dashboard fallback for an admin', () => {
    expect(decidePriceFallback({ showAdminFeatures: true })).toBe('/dashboard/agent');
  });
});

describe('decidePriceBackAction', () => {
  it('goes back when the Navigation API reports real same-origin history', () => {
    expect(
      decidePriceBackAction({
        navigationIndex: 1,
        historyLength: 3,
        referrer: '',
        showAdminFeatures: false
      })
    ).toEqual({ type: 'back' });
  });

  it('lands on the chat page when a new tab only has the blank entry (history.length is unreliable)', () => {
    // 新标签页自带一条不可见历史：history.length=2 但 Navigation API index 仍是 0
    expect(
      decidePriceBackAction({
        navigationIndex: 0,
        historyLength: 2,
        referrer: '',
        showAdminFeatures: false
      })
    ).toEqual({ type: 'push', path: '/chat' });
  });

  it('lands on the dashboard fallback for an admin without history', () => {
    expect(
      decidePriceBackAction({
        navigationIndex: 0,
        historyLength: 2,
        referrer: '',
        showAdminFeatures: true
      })
    ).toEqual({ type: 'push', path: '/dashboard/agent' });
  });

  it('falls back to the referrer guard when the Navigation API is unavailable', () => {
    // 旧浏览器：无 referrer 的新开页不可后退
    expect(
      decidePriceBackAction({
        historyLength: 2,
        referrer: '',
        showAdminFeatures: false
      })
    ).toEqual({ type: 'push', path: '/chat' });

    // 旧浏览器：确有来源页时可以后退
    expect(
      decidePriceBackAction({
        historyLength: 2,
        referrer: 'https://www.airscend.com/chat',
        showAdminFeatures: false
      })
    ).toEqual({ type: 'back' });
  });

  it('does not trust history.length alone when referrer is empty', () => {
    expect(
      decidePriceBackAction({
        historyLength: 5,
        referrer: '',
        showAdminFeatures: false
      })
    ).toEqual({ type: 'push', path: '/chat' });
  });
});
