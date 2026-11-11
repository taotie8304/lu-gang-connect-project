import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_FAILURE_HIGHLIGHT_DURATION_MS,
  buildAiClearFailureHighlightExpression,
  buildAiFailureHighlightExpression
} from '../src/main/ai/failureHighlightScript';
import type { AiFailureHighlight } from '../src/main/ai/executor';

const HOST_ID = 'lugang-ai-failure-highlight';

const evalInPage = <T>(expression: string): T => window.eval(expression) as T;

const getHost = () => document.getElementById(HOST_ID);
const getRoot = () => getHost()?.shadowRoot ?? null;

const coveredHighlight: AiFailureHighlight = {
  kind: 'covered',
  target: { x: 10, y: 40, width: 120, height: 32 },
  cover: { x: 0, y: 0, width: 1024, height: 800 },
  coverName: '隐私提示',
  message: '「注册」被「隐私提示」挡住，请先关闭提示后再让 AI 继续。'
};

describe('AI 失败标注页面脚本', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    evalInPage(buildAiClearFailureHighlightExpression());
    vi.useRealTimers();
  });

  it('遮挡失败画目标框与遮挡框，并展示可关闭的说明条', () => {
    const injected = evalInPage<boolean>(buildAiFailureHighlightExpression(coveredHighlight));
    expect(injected).toBe(true);

    const host = getHost();
    expect(host).toBeTruthy();
    expect(host?.style.pointerEvents).toBe('none');
    expect(host?.style.zIndex).toBe('2147483646');

    const root = getRoot()!;
    const frames = root.querySelectorAll('div');
    const labels = Array.from(
      root.querySelectorAll('[data-lugang-ai-highlight-label]')
    ).map((node) => node.textContent);
    expect(labels).toEqual(['AI 要操作的位置', '遮挡层：隐私提示']);

    const targetFrame = frames[0] as HTMLElement;
    expect(targetFrame.style.left).toBe('10px');
    expect(targetFrame.style.top).toBe('40px');
    expect(targetFrame.style.width).toBe('120px');
    expect(targetFrame.style.height).toBe('32px');
    expect(targetFrame.style.border).toContain('dashed');

    const coverFrame = frames[1] as HTMLElement;
    expect(coverFrame.style.width).toBe('1024px');
    expect(coverFrame.style.height).toBe('800px');

    const banner = root.querySelector('[data-lugang-ai-highlight-banner]') as HTMLElement;
    expect(banner).toBeTruthy();
    expect(banner.style.pointerEvents).toBe('auto');
    expect(banner.textContent).toContain('AI 没能完成这一步');
    expect(
      root.querySelector('[data-lugang-ai-highlight-message]')?.textContent
    ).toBe(coveredHighlight.message);

    (root.querySelector('button') as HTMLButtonElement).click();
    expect(getHost()).toBeNull();
  });

  it('找不到目标时只显示说明条，不画空框', () => {
    evalInPage(
      buildAiFailureHighlightExpression({
        kind: 'page',
        message: '页面上没有找到「提交申请」，请确认是否已切换到正确页面。'
      })
    );

    const root = getRoot()!;
    expect(root.querySelectorAll('[data-lugang-ai-highlight-label]')).toHaveLength(0);
    expect(root.querySelector('[data-lugang-ai-highlight-banner]')).toBeTruthy();
  });

  it('重复失败替换旧标注，不叠加多个宿主节点', () => {
    evalInPage(buildAiFailureHighlightExpression(coveredHighlight));
    evalInPage(
      buildAiFailureHighlightExpression({
        kind: 'target',
        target: { x: 1, y: 2, width: 3, height: 4 },
        message: '输入框不可编辑。'
      })
    );

    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1);
    const labels = Array.from(
      getRoot()!.querySelectorAll('[data-lugang-ai-highlight-label]')
    ).map((node) => node.textContent);
    expect(labels).toEqual(['AI 要操作的位置']);
  });

  it('约 9 秒后自动消失，清除脚本可立即撤掉标注', () => {
    vi.useFakeTimers();
    evalInPage(buildAiFailureHighlightExpression(coveredHighlight));
    expect(getHost()).toBeTruthy();

    vi.advanceTimersByTime(AI_FAILURE_HIGHLIGHT_DURATION_MS - 1);
    expect(getHost()).toBeTruthy();
    vi.advanceTimersByTime(1);
    expect(getHost()).toBeNull();

    evalInPage(buildAiFailureHighlightExpression(coveredHighlight));
    expect(getHost()).toBeTruthy();
    evalInPage(buildAiClearFailureHighlightExpression());
    expect(getHost()).toBeNull();
  });

  it('说明文案中的特殊替换字符按原文渲染', () => {
    const message = '价格 $& 与 $1 不能被当作替换模板。';
    evalInPage(buildAiFailureHighlightExpression({ kind: 'page', message }));
    expect(
      getRoot()!.querySelector('[data-lugang-ai-highlight-message]')?.textContent
    ).toBe(message);
  });
});
