import { describe, expect, it } from 'vitest';
import { ChatSidebarPaneEnum } from '@/pageComponents/chat/constants';
import { resolveChatPaneRedirect } from '@/web/core/chat/context/chatPaneRouting';

const base = {
  isPlus: false,
  isRoot: false,
  defaultAppId: 'default-app-id',
  pane: ChatSidebarPaneEnum.RECENTLY_USED_APPS as string | undefined,
  queryAppId: 'default-app-id' as string | undefined
};

describe('resolveChatPaneRedirect', () => {
  it('普通用户已在最近使用且应用已就绪时不跳转（避免无限 replace）', () => {
    expect(resolveChatPaneRedirect(base)).toBeNull();
  });

  it('普通用户在最近使用里切换到其他应用时放行', () => {
    expect(resolveChatPaneRedirect({ ...base, queryAppId: 'another-app-id' })).toBeNull();
  });

  it('普通用户打开聊天页缺少 pane 时回退到默认助手', () => {
    expect(resolveChatPaneRedirect({ ...base, pane: undefined, queryAppId: undefined })).toEqual({
      pane: ChatSidebarPaneEnum.RECENTLY_USED_APPS,
      appId: 'default-app-id'
    });
  });

  it('普通用户 pane 非法时回退到默认助手', () => {
    expect(
      resolveChatPaneRedirect({ ...base, pane: 'unknown-pane', queryAppId: undefined })
    ).toEqual({
      pane: ChatSidebarPaneEnum.RECENTLY_USED_APPS,
      appId: 'default-app-id'
    });
  });

  it('普通用户在团队应用列表时回退到默认助手', () => {
    expect(resolveChatPaneRedirect({ ...base, pane: ChatSidebarPaneEnum.ALL_APPS })).toEqual({
      pane: ChatSidebarPaneEnum.RECENTLY_USED_APPS,
      appId: 'default-app-id'
    });
  });

  it('普通用户位于最近使用但缺少应用 ID 时补默认助手', () => {
    expect(resolveChatPaneRedirect({ ...base, queryAppId: undefined })).toEqual({
      pane: ChatSidebarPaneEnum.RECENTLY_USED_APPS,
      appId: 'default-app-id'
    });
  });

  it('root 用户不受默认助手限制', () => {
    expect(
      resolveChatPaneRedirect({ ...base, isRoot: true, pane: ChatSidebarPaneEnum.ALL_APPS })
    ).toBeNull();
  });

  it('商业版用户不受默认助手限制', () => {
    expect(
      resolveChatPaneRedirect({ ...base, isPlus: true, pane: ChatSidebarPaneEnum.HOME })
    ).toBeNull();
  });

  it('无默认助手的普通用户不允许进入团队应用列表', () => {
    expect(
      resolveChatPaneRedirect({
        ...base,
        defaultAppId: '',
        pane: ChatSidebarPaneEnum.HOME,
        queryAppId: undefined
      })
    ).toEqual({ pane: ChatSidebarPaneEnum.ALL_APPS, appId: '' });
  });
});
