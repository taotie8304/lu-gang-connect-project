import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('@/components/common/ThinkingFace', () => ({
  default: () => React.createElement('svg', { 'data-testid': 'brand' })
}));

import HelpShell from '@/pageComponents/help/HelpShell';

// 鲁港通 - 帮助中心顶部导航回归：不得再出现指向登录页的入口，否则已登录用户会被 clearToken 踢下线
describe('HelpShell 顶部导航', () => {
  const html = renderToStaticMarkup(React.createElement(HelpShell, null, 'content'));

  it('不再展示「返回官网」，也不存在指向 /login 的入口', () => {
    expect(html).not.toContain('nav.backHome');
    expect(html).not.toContain('href="/login"');
  });

  it('「返回」回到聊天页，不再经过登录页', () => {
    expect(html).toContain('nav.back');
    expect(html).toContain('href="/chat"');
  });
});
