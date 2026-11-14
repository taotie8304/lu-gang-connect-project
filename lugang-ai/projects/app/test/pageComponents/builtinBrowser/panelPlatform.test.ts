// 鲁港通 - 网页面板主动连接与四语种文案：网页端不空跑云会话，桌面端保持即开即用
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  connectActionLabelKey,
  connectErrorTextKey,
  initialConnectPhase,
  shouldAutoConnectOnMount
} from '@/pageComponents/chat/builtinBrowser/connection';

const LOCALES = ['zh-CN', 'zh-Hant', 'en', 'ko-KR'] as const;

const readLocale = (locale: string): Record<string, string> =>
  JSON.parse(
    readFileSync(
      path.resolve(process.cwd(), `packages/web/i18n/${locale}/common.json`),
      'utf8'
    )
  ) as Record<string, string>;

describe('网页面板连接状态', () => {
  it('网页端挂载后处于空闲态，不自动开台', () => {
    expect(initialConnectPhase(false)).toBe('idle');
    expect(shouldAutoConnectOnMount(false)).toBe(false);
  });

  it('桌面端挂载即进入加载态并自动开台', () => {
    expect(initialConnectPhase(true)).toBe('loading');
    expect(shouldAutoConnectOnMount(true)).toBe(true);
  });

  it('空闲态给出连接按钮，连接中给出进行中文案', () => {
    expect(connectActionLabelKey('idle')).toBe('common:builtin_browser_web_connect');
    expect(connectActionLabelKey('loading')).toBe(
      'common:builtin_browser_web_connect_loading'
    );
  });

  it('连接失败给出可重试按钮与可操作错误文案', () => {
    expect(connectActionLabelKey('error')).toBe('common:builtin_browser_retry');
    expect(connectErrorTextKey('error')).toBe(
      'common:builtin_browser_web_connect_failed'
    );
    expect(connectErrorTextKey('idle')).toBeNull();
    expect(connectErrorTextKey('active')).toBeNull();
  });
});

describe.each(LOCALES)('%s 文案', (locale) => {
  const dict = readLocale(locale);
  const keys = [
    'builtin_browser_scenario_desktop_only',
    'builtin_browser_scenario_desktop_only_desc',
    'builtin_browser_scenario_download_client',
    'builtin_browser_web_connect',
    'builtin_browser_web_connect_loading',
    'builtin_browser_web_connect_failed',
    'builtin_browser_web_readonly_desc'
  ];

  it.each(keys)('%s 存在且非空', (key) => {
    expect((dict[key] ?? '').trim().length).toBeGreaterThan(0);
  });
});

describe('只读文案准确性', () => {
  it('中文只读文案说明只能查看进度，代操作请在桌面客户端进行', () => {
    const desc = readLocale('zh-CN').builtin_browser_web_readonly_desc;
    expect(desc).toContain('办理进度');
    expect(desc).toContain('桌面客户端');
  });
});
