import { pushChatItemUsage } from '@fastgpt/service/support/wallet/usage/controller';
import * as pointsController from '@fastgpt/service/support/wallet/points/controller';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('pushChatItemUsage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves PDF page counts when workflow usage is persisted', () => {
    const pushUsageItemsHandler = vi.fn();
    global.pushUsageItemsHandler = pushUsageItemsHandler;

    pushChatItemUsage({
      teamId: 'team_1',
      usageId: 'usage_1',
      nodeUsages: [
        {
          moduleName: 'PDF enhanced parse',
          totalPoints: 12,
          pages: 3
        }
      ]
    });

    expect(pushUsageItemsHandler).toHaveBeenCalledWith({
      teamId: 'team_1',
      usageId: 'usage_1',
      list: [
        {
          moduleName: 'PDF enhanced parse',
          amount: 12,
          model: undefined,
          inputTokens: undefined,
          outputTokens: undefined,
          pages: 3
        }
      ]
    });
  });

  it('鲁港通 - 提供 tmbId 时按本轮节点用量合计扣除个人积分', () => {
    global.pushUsageItemsHandler = vi.fn();
    const deductSpy = vi.spyOn(pointsController, 'deductUserPoints').mockResolvedValue();

    pushChatItemUsage({
      teamId: 'team_1',
      usageId: 'usage_1',
      tmbId: 'tmb_1',
      nodeUsages: [
        { moduleName: 'AI 对话', totalPoints: 30 },
        { moduleName: '向量检索', totalPoints: 12 },
        { moduleName: '零消耗节点', totalPoints: 0 }
      ]
    });

    expect(deductSpy).toHaveBeenCalledTimes(1);
    expect(deductSpy).toHaveBeenCalledWith({ tmbId: 'tmb_1', points: 42 });
  });

  it('鲁港通 - 未提供 tmbId 时不扣费（兼容既有调用方）', () => {
    global.pushUsageItemsHandler = vi.fn();
    const deductSpy = vi.spyOn(pointsController, 'deductUserPoints').mockResolvedValue();

    pushChatItemUsage({
      teamId: 'team_1',
      usageId: 'usage_1',
      nodeUsages: [{ moduleName: 'AI 对话', totalPoints: 30 }]
    });

    expect(deductSpy).not.toHaveBeenCalled();
  });
});
