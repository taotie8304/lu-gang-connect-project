import { describe, expect, it } from 'vitest';
import {
  AI_MAX_CONSECUTIVE_FAILURES,
  AI_MAX_PAGE_REOPENS,
  AI_STOP_MESSAGES,
  createAiSessionGuard,
  recordAiActionFailure,
  recordAiActionSuccess,
  recordAiUserStop,
  requestAiPageReopen,
  stopAiSession
} from '../src/main/ai/policy';

describe('AI 会话自愈策略', () => {
  it('连续失败达到上限后停止并给出可操作提示', () => {
    expect(AI_MAX_CONSECUTIVE_FAILURES).toBe(2);
    let guard = createAiSessionGuard();

    const first = recordAiActionFailure(guard);
    guard = first.next;
    expect(first.stop).toBe(false);
    expect(guard.failures).toBe(1);
    expect(guard.stopped).toBe(false);

    const second = recordAiActionFailure(guard);
    guard = second.next;
    expect(second.stop).toBe(true);
    expect(guard.stopped).toBe(true);
    expect(guard.stopReason).toBe('too_many_failures');
    expect(second.message).toContain('连续两次');
    expect(second.message).toContain('停止');
  });

  it('任意一次成功会清零连续失败计数', () => {
    let guard = recordAiActionFailure(createAiSessionGuard()).next;
    expect(guard.failures).toBe(1);
    guard = recordAiActionSuccess(guard);
    expect(guard.failures).toBe(0);
  });

  it('页面关闭只自动重开一次，第二次要求用户确认', () => {
    expect(AI_MAX_PAGE_REOPENS).toBe(1);
    const first = requestAiPageReopen(createAiSessionGuard());
    expect(first.allowed).toBe(true);
    expect(first.next.pageReopens).toBe(1);

    const second = requestAiPageReopen(first.next);
    expect(second.allowed).toBe(false);
    expect(second.next.stopped).toBe(true);
    expect(second.next.stopReason).toBe('page_closed_twice');
    expect(second.message).toContain('再次关闭');
  });

  it('用户主动停止后不再继续执行', () => {
    const stopped = recordAiUserStop(createAiSessionGuard());
    expect(stopped.stopped).toBe(true);
    expect(stopped.stopReason).toBe('stopped_by_user');
  });

  it('停止文案必须为可操作中文', () => {
    const guard = recordAiUserStop(createAiSessionGuard());
    expect(guard.stopMessage).toContain('已停止');
    expect(guard.stopMessage).toContain('继续');
  });

  it('取消选文件、交还用户、拒绝确认与确认超时都有明确停止说明', () => {
    const cancelled = stopAiSession(createAiSessionGuard(), 'cancelled_by_user');
    expect(cancelled.stopped).toBe(true);
    expect(cancelled.stopReason).toBe('cancelled_by_user');
    expect(cancelled.stopMessage).toContain('取消');

    const handedOver = stopAiSession(createAiSessionGuard(), 'handed_over');
    expect(handedOver.stopReason).toBe('handed_over');
    expect(handedOver.stopMessage).toContain('提交');

    const declined = stopAiSession(createAiSessionGuard(), 'confirmation_declined');
    expect(declined.stopReason).toBe('confirmation_declined');
    expect(declined.stopMessage).toContain('没有提交');

    const timeout = stopAiSession(createAiSessionGuard(), 'confirmation_timeout');
    expect(timeout.stopReason).toBe('confirmation_timeout');
    expect(timeout.stopMessage).toContain('超时');

    const unavailable = stopAiSession(createAiSessionGuard(), 'confirmation_unavailable');
    expect(unavailable.stopReason).toBe('confirmation_unavailable');
    expect(unavailable.stopMessage).toContain('手动');
  });

  it('提交成功后结束本轮自动操作并提示可继续下一步', () => {
    const submitted = stopAiSession(createAiSessionGuard(), 'submitted');
    expect(submitted.stopReason).toBe('submitted');
    expect(submitted.stopMessage).toContain('提交');
    expect(submitted.stopMessage).toContain('结束');
  });

  it('提交已执行但结果未确认时提示用户自行核对', () => {
    const unconfirmed = stopAiSession(createAiSessionGuard(), 'submission_unconfirmed');
    expect(unconfirmed.stopReason).toBe('submission_unconfirmed');
    expect(unconfirmed.stopMessage).toContain('确认');
    expect(unconfirmed.stopMessage).toContain('页面');
  });

  it('资金类拦截文案只描述支付相关操作', () => {
    expect(AI_STOP_MESSAGES.high_risk_blocked).toContain('支付');
    expect(AI_STOP_MESSAGES.high_risk_blocked).not.toContain('提交');
  });
});
