import { describe, expect, it } from 'vitest';
import {
  DESKTOP_CRASH_LOG_MAX_CHARS,
  DESKTOP_CRASH_MESSAGE_MAX_CHARS,
  DESKTOP_CRASH_STACK_MAX_CHARS,
  normalizeDesktopCrashReport,
  truncateDesktopCrashText
} from '@fastgpt/service/support/desktopCommand/crashReport';

const now = 1_760_000_000_000;

const report = (overrides: Record<string, unknown> = {}) => ({
  type: 'uncaught-exception' as const,
  message: 'TypeError: Cannot read properties of undefined',
  stack: 'at handler (C:\\app\\main.js:12:3)',
  log: 'window loaded',
  occurredAt: now - 1000,
  ...overrides
});

describe('desktop crash report normalization', () => {
  it('keeps ordinary reports intact', () => {
    expect(normalizeDesktopCrashReport(report(), { now })).toEqual({
      type: 'uncaught-exception',
      message: 'TypeError: Cannot read properties of undefined',
      stack: 'at handler (C:\\app\\main.js:12:3)',
      log: 'window loaded',
      occurredAt: new Date(now - 1000)
    });
  });

  it('truncates oversized text to the server limits', () => {
    const normalized = normalizeDesktopCrashReport(
      report({
        message: 'm'.repeat(DESKTOP_CRASH_MESSAGE_MAX_CHARS + 10),
        stack: 's'.repeat(DESKTOP_CRASH_STACK_MAX_CHARS + 10),
        log: 'l'.repeat(DESKTOP_CRASH_LOG_MAX_CHARS + 10)
      }),
      { now }
    );

    expect(normalized.message).toBe(`${'m'.repeat(DESKTOP_CRASH_MESSAGE_MAX_CHARS)}…`);
    expect(normalized.stack).toBe(`${'s'.repeat(DESKTOP_CRASH_STACK_MAX_CHARS)}…`);
    expect(normalized.log).toBe(`${'l'.repeat(DESKTOP_CRASH_LOG_MAX_CHARS)}…`);
  });

  it('drops blank optional fields', () => {
    const normalized = normalizeDesktopCrashReport(report({ stack: '   ', log: undefined }), {
      now
    });

    expect(normalized.stack).toBeUndefined();
    expect(normalized.log).toBeUndefined();
  });

  it('falls back to a readable message when it is blank', () => {
    expect(normalizeDesktopCrashReport(report({ message: '  ' }), { now }).message).toBe(
      '（缺少错误信息）'
    );
  });

  it('clamps a future occurredAt and replaces invalid values with now', () => {
    expect(normalizeDesktopCrashReport(report({ occurredAt: now + 60_000 }), { now }).occurredAt).toEqual(
      new Date(now)
    );
    expect(
      normalizeDesktopCrashReport(report({ occurredAt: Number.NaN }), { now }).occurredAt
    ).toEqual(new Date(now));
  });

  it('trims surrounding whitespace', () => {
    expect(truncateDesktopCrashText('  at line 1  ', 100)).toBe('at line 1');
  });
});
