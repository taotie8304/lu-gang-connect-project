// 鲁港通 - 后台风格入口治理：管理功能可见性判定（从 navbar.tsx 抽出为纯函数）
import { describe, expect, it } from 'vitest';
import { decideShowAdminFeatures } from '@/components/Layout/adminFeatures';

describe('decideShowAdminFeatures', () => {
  it('hides admin features for a member when the chat-only mode is on', () => {
    expect(decideShowAdminFeatures({ isOwner: false, enableUserChatOnly: true })).toBe(false);
  });

  it('shows admin features for the team owner even in chat-only mode', () => {
    expect(decideShowAdminFeatures({ isOwner: true, enableUserChatOnly: true })).toBe(true);
  });

  it('shows admin features to everyone when chat-only mode is off', () => {
    expect(decideShowAdminFeatures({ isOwner: false, enableUserChatOnly: false })).toBe(true);
  });
});
