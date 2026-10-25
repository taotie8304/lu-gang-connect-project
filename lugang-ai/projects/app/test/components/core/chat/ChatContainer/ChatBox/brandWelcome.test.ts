import { describe, expect, it } from 'vitest';
import { ChatSourceTypeEnum } from '@fastgpt/global/core/chat/constants';
import { isBrandWelcomeApp } from '@/components/core/chat/ChatContainer/ChatBox/utils/brandWelcome';

describe('isBrandWelcomeApp', () => {
  const defaultAppId = 'default-app';

  it('returns true for the default landing app', () => {
    expect(
      isBrandWelcomeApp({
        sourceType: ChatSourceTypeEnum.app,
        sourceId: defaultAppId,
        defaultAppId
      })
    ).toBe(true);
  });

  it('returns false for another app that has its own welcome', () => {
    expect(
      isBrandWelcomeApp({
        sourceType: ChatSourceTypeEnum.app,
        sourceId: 'school-helper',
        defaultAppId
      })
    ).toBe(false);
  });

  it('returns false when the deployment has no default app configured', () => {
    expect(
      isBrandWelcomeApp({
        sourceType: ChatSourceTypeEnum.app,
        sourceId: 'default-app',
        defaultAppId: ''
      })
    ).toBe(false);
  });

  it('returns false for non-app sources', () => {
    expect(
      isBrandWelcomeApp({
        sourceType: ChatSourceTypeEnum.skillEdit,
        sourceId: defaultAppId,
        defaultAppId
      })
    ).toBe(false);
  });
});
