import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.hoisted(() => ({
  postOpenBuiltinBrowserSession: vi.fn(),
  deleteBuiltinBrowserSession: vi.fn(),
  putBuiltinBrowserViewport: vi.fn(),
  patchBuiltinBrowserNavigate: vi.fn(),
  getBuiltinBrowserTabs: vi.fn(),
  postNewBuiltinBrowserTab: vi.fn(),
  patchSelectBuiltinBrowserTab: vi.fn(),
  deleteBuiltinBrowserTab: vi.fn(),
  postReloadBuiltinBrowserSession: vi.fn()
}));

vi.mock('@/web/support/builtinBrowser/api', () => mockApi);

import { createCloudTransport } from '@/pageComponents/chat/builtinBrowser/transport/cloud';

describe('cloud transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('open 透传视口并返回会话地址', async () => {
    mockApi.postOpenBuiltinBrowserSession.mockResolvedValue({
      resourceUrl: 'https://view.example.com/session',
      expiresAt: '2026-10-18T12:00:00.000Z'
    });
    const transport = createCloudTransport();
    const result = await transport.open({ width: 400, height: 300 });
    expect(mockApi.postOpenBuiltinBrowserSession).toHaveBeenCalledWith({
      viewport: { width: 400, height: 300 }
    });
    expect(result).toEqual({
      resourceUrl: 'https://view.example.com/session',
      expiresAt: '2026-10-18T12:00:00.000Z'
    });
  });

  it('navigate / resize 映射为布尔结果', async () => {
    mockApi.patchBuiltinBrowserNavigate.mockResolvedValue({ navigated: true, tabs: [] });
    mockApi.putBuiltinBrowserViewport.mockResolvedValue({ resized: false });
    const transport = createCloudTransport();
    expect(await transport.navigate('https://a.com')).toBe(true);
    expect(await transport.resize({ width: 1, height: 1 })).toBe(false);
  });

  it('标签接口原样映射', async () => {
    mockApi.getBuiltinBrowserTabs.mockResolvedValue({
      tabs: [{ index: 1, title: 'A', url: 'https://a.com', current: true }]
    });
    mockApi.postNewBuiltinBrowserTab.mockResolvedValue({ tabs: [] });
    mockApi.patchSelectBuiltinBrowserTab.mockResolvedValue({ selected: true, tabs: [] });
    mockApi.deleteBuiltinBrowserTab.mockResolvedValue({ closed: true, tabs: [] });
    const transport = createCloudTransport();
    expect(await transport.listTabs()).toHaveLength(1);
    expect(await transport.createTab()).toEqual([]);
    expect(await transport.switchTab(1)).toEqual({ selected: true, tabs: [] });
    expect(await transport.closeTab(1)).toEqual({ closed: true, tabs: [] });
  });

  it('usesNativeView 为 false', () => {
    expect(createCloudTransport().usesNativeView).toBe(false);
  });
});
