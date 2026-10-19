import { describe, expect, it } from 'vitest';
import {
  AI_AUDIT_RETENTION_DAYS,
  buildAiAuditRecord,
  isAiAuditFileExpired
} from '../src/main/ai/audit';

describe('AI 操作审计', () => {
  it('审计记录不包含用户输入值', () => {
    const record = buildAiAuditRecord({
      commandId: 'cmd-1',
      action: 'type',
      outcome: 'ok',
      url: 'https://www.gov.hk/sc/forms/apply?token=secret#part2',
      target: '申请人姓名',
      durationMs: 120,
      now: new Date('2026-10-19T08:00:00.000Z')
    });

    expect(record).toMatchObject({
      commandId: 'cmd-1',
      action: 'type',
      outcome: 'ok',
      host: 'www.gov.hk',
      path: '/sc/forms/apply',
      target: '申请人姓名',
      durationMs: 120
    });
    expect(JSON.stringify(record)).not.toContain('secret');
    expect(JSON.stringify(record)).not.toContain('张三');
    expect(record.time).toBe('2026-10-19T08:00:00.000Z');
  });

  it('记录提交确认结果但只保留决策与动作名称', () => {
    const record = buildAiAuditRecord({
      commandId: 'cmd-3',
      action: 'click',
      outcome: 'stopped',
      url: 'https://www.gov.hk/sc/forms/apply',
      target: '提交申请',
      confirmation: { required: true, decision: 'allow', label: '提交申请' }
    });

    expect(record.confirmation).toEqual({
      required: true,
      decision: 'allow',
      label: '提交申请'
    });
    expect(JSON.stringify(record)).not.toContain('文件内容');
  });

  it('非法网址只记录无敏感信息的占位', () => {
    const record = buildAiAuditRecord({
      commandId: 'cmd-2',
      action: 'navigate',
      outcome: 'blocked',
      errorCode: 'not_allowed',
      url: 'javascript:alert(1)'
    });
    expect(record.host).toBeUndefined();
    expect(record.path).toBeUndefined();
    expect(record.errorCode).toBe('not_allowed');
  });

  it('审计保留 90 天', () => {
    expect(AI_AUDIT_RETENTION_DAYS).toBe(90);
    const now = new Date('2026-10-19T00:00:00.000Z');
    expect(isAiAuditFileExpired('2026-07-21.jsonl', now)).toBe(false);
    expect(isAiAuditFileExpired('2026-07-20.jsonl', now)).toBe(true);
    expect(isAiAuditFileExpired('2026-01-01.jsonl', now)).toBe(true);
    expect(isAiAuditFileExpired('not-a-date.jsonl', now)).toBe(false);
  });
});
