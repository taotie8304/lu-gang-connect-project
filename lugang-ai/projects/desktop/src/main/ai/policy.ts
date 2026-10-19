// 鲁港通 - AI 会话自愈策略：连续失败两次停止；页面被关只自动重开一次
export const AI_MAX_CONSECUTIVE_FAILURES = 2;
export const AI_MAX_PAGE_REOPENS = 1;

export type AiStopReason =
  | 'stopped_by_user'
  | 'too_many_failures'
  | 'page_closed_twice'
  | 'sensitive_blocked'
  | 'high_risk_blocked'
  | 'domain_not_allowed'
  | 'cancelled_by_user'
  | 'handed_over'
  | 'confirmation_declined'
  | 'confirmation_timeout'
  | 'confirmation_unavailable'
  | 'submission_unconfirmed'
  | 'submitted';

export type AiSessionGuard = {
  failures: number;
  pageReopens: number;
  stopped: boolean;
  stopReason?: AiStopReason;
  stopMessage?: string;
};

export const AI_STOP_MESSAGES: Record<AiStopReason, string> = {
  stopped_by_user: '已停止操作。你可以继续手动填写；需要我继续时请告诉我。',
  too_many_failures:
    '连续两次操作没有成功，我已停止，避免继续误操作。请检查页面状态后告诉我下一步，我再继续。',
  page_closed_twice:
    '页面被再次关闭，我已停止自动重开。请确认是否还要继续操作这个页面，确认后我再继续。',
  sensitive_blocked: '密码、验证码、银行卡等敏感信息需要你亲自填写，我不能代为输入。',
  high_risk_blocked: '支付、转账、购买等资金操作不能由我代为进行，需要你本人完成。',
  domain_not_allowed: '该网站不在允许自动操作的范围内，需要你亲自处理。',
  cancelled_by_user: '你取消了选择文件，我已停止上传操作。需要继续时请告诉我。',
  handed_over: '已把页面交还给你手动提交，我不会再继续操作。你完成提交后如果需要我继续，请告诉我。',
  confirmation_declined: '你取消了本次提交，页面没有提交任何内容。需要继续时请告诉我。',
  confirmation_timeout:
    '等待提交确认超时，已自动取消本次提交，页面没有提交任何内容。需要继续时请告诉我。',
  confirmation_unavailable:
    '当前客户端无法弹出提交确认框，需要你手动完成本次提交。升级到最新版本后，我可以协助后续步骤。',
  submission_unconfirmed:
    '已按你的确认点击提交，但页面没有显示提交成功，请手动核对页面。为避免重复提交，我已停止，不会再点一次。',
  submitted: '已按你的确认完成提交，本轮自动操作到此结束。后续步骤需要继续时请告诉我。'
};

export const createAiSessionGuard = (): AiSessionGuard => ({
  failures: 0,
  pageReopens: 0,
  stopped: false
});

export const recordAiActionFailure = (
  guard: AiSessionGuard
): { next: AiSessionGuard; stop: boolean; message?: string } => {
  const failures = guard.failures + 1;
  if (failures >= AI_MAX_CONSECUTIVE_FAILURES) {
    const message = AI_STOP_MESSAGES.too_many_failures;
    return {
      next: {
        ...guard,
        failures,
        stopped: true,
        stopReason: 'too_many_failures',
        stopMessage: message
      },
      stop: true,
      message
    };
  }
  return { next: { ...guard, failures }, stop: false };
};

export const recordAiActionSuccess = (guard: AiSessionGuard): AiSessionGuard => ({
  ...guard,
  failures: 0
});

export const requestAiPageReopen = (
  guard: AiSessionGuard
): { allowed: boolean; next: AiSessionGuard; message?: string } => {
  if (guard.pageReopens >= AI_MAX_PAGE_REOPENS) {
    const message = AI_STOP_MESSAGES.page_closed_twice;
    return {
      allowed: false,
      next: {
        ...guard,
        stopped: true,
        stopReason: 'page_closed_twice',
        stopMessage: message
      },
      message
    };
  }
  return {
    allowed: true,
    next: { ...guard, pageReopens: guard.pageReopens + 1 }
  };
};

export const recordAiUserStop = (guard: AiSessionGuard): AiSessionGuard => ({
  ...guard,
  stopped: true,
  stopReason: 'stopped_by_user',
  stopMessage: AI_STOP_MESSAGES.stopped_by_user
});

export const stopAiSession = (
  guard: AiSessionGuard,
  reason: AiStopReason
): AiSessionGuard => ({
  ...guard,
  stopped: true,
  stopReason: reason,
  stopMessage: AI_STOP_MESSAGES[reason]
});
