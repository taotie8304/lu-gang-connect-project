import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAiPrepareInputExpression,
  buildAiResolveExpression,
  buildAiScrollExpression,
  buildAiSelectExpression,
  buildAiSnapshotExpression
} from '../src/main/ai/pageScript';

type RectInput = { x?: number; y?: number; width?: number; height?: number };

const stubRect = (element: Element, rect: RectInput = {}) => {
  const { x = 10, y = 20, width = 120, height = 32 } = rect;
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x,
      y,
      width,
      height,
      top: y,
      left: x,
      right: x + width,
      bottom: y + height,
      toJSON: () => ({})
    })
  });
};

const evalInPage = <T>(expression: string): T => window.eval(expression) as T;

const installPage = () => {
  document.title = '政府表格';
  document.body.innerHTML = `
    <label for="fullName">申请人姓名</label>
    <input id="fullName" name="fullName" placeholder="请输入姓名" value="张三" autocomplete="name" />
    <label>账户密码 <input id="pwd" type="password" autocomplete="current-password" value="超级机密" /></label>
    <input id="hidden" type="hidden" value="token-123" />
    <button id="next" type="button">下一步</button>
    <button id="disabled" type="button" disabled>继续</button>
    <a id="link" href="https://www.gov.hk/notice">查看须知</a>
    <select id="area" aria-label="服务区域">
      <option value="hk">香港岛</option>
      <option value="kl">九龙</option>
    </select>
    <textarea id="notes" aria-label="备注" placeholder="补充说明">已填写内容</textarea>
    <div style="display:none"><button id="hiddenBtn" type="button">隐藏按钮</button></div>
  `;

  const byId = (id: string) => document.getElementById(id)!;
  stubRect(byId('fullName'), { x: 10, y: 20 });
  stubRect(byId('pwd'), { x: 10, y: 60 });
  stubRect(byId('hidden'));
  stubRect(byId('next'), { x: 10, y: 100 });
  stubRect(byId('disabled'), { x: 10, y: 140 });
  stubRect(byId('link'), { x: 10, y: 180 });
  stubRect(byId('area'), { x: 10, y: 220 });
  stubRect(byId('notes'), { x: 10, y: 260 });
  stubRect(byId('hiddenBtn'), { x: 10, y: 300 });
};

describe('AI 页面脚本', () => {
  beforeEach(() => {
    installPage();
  });

  it('生成页面快照：可见交互元素、标签名、角色与链接', () => {
    const snapshot = evalInPage<{
      title: string;
      text: string;
      elements: Array<{
        ref: string;
        name: string;
        role: string;
        tag: string;
        type?: string;
        placeholder?: string;
        value?: string;
        disabled?: boolean;
        href?: string;
      }>;
      scroll: { viewportHeight: number };
    }>(buildAiSnapshotExpression());

    expect(snapshot.title).toBe('政府表格');
    expect(snapshot.text).toContain('申请人姓名');
    expect(snapshot.elements.length).toBeGreaterThan(0);

    const nameInput = snapshot.elements.find((item) => item.name === '申请人姓名');
    expect(nameInput).toMatchObject({
      tag: 'input',
      role: 'textbox',
      placeholder: '请输入姓名',
      value: '张三'
    });
    expect(nameInput?.ref).toMatch(/^e\d+$/);
    expect(document.getElementById('fullName')?.getAttribute('data-lugang-ai-ref')).toBe(
      nameInput?.ref
    );

    const link = snapshot.elements.find((item) => item.name === '查看须知');
    expect(link).toMatchObject({ tag: 'a', role: 'link', href: 'https://www.gov.hk/notice' });

    const disabled = snapshot.elements.find((item) => item.name === '继续');
    expect(disabled?.disabled).toBe(true);

    const area = snapshot.elements.find((item) => item.name === '服务区域');
    expect(area?.role).toBe('combobox');

    expect(snapshot.elements.some((item) => item.tag === 'input' && item.type === 'hidden')).toBe(
      false
    );
    expect(snapshot.elements.some((item) => item.name === '隐藏按钮')).toBe(false);
    expect(snapshot.scroll.viewportHeight).toBeGreaterThan(0);
  });

  it('快照不返回密码值', () => {
    const snapshot = evalInPage<{
      elements: Array<{ name: string; type?: string; value?: string }>;
    }>(buildAiSnapshotExpression());
    const password = snapshot.elements.find((item) => item.type === 'password');
    expect(password).toBeTruthy();
    expect(password?.value).toBeUndefined();
  });

  it('按引用解析元素并支持滚动到可视区域', () => {
    const snapshot = evalInPage<{ elements: Array<{ ref: string; name: string }> }>(
      buildAiSnapshotExpression()
    );
    const next = snapshot.elements.find((item) => item.name === '下一步')!;
    const resolved = evalInPage<{
      found: boolean;
      visible: boolean;
      rect: { x: number; y: number; width: number; height: number };
    }>(buildAiResolveExpression(next.ref, { scrollIntoView: true }));
    expect(resolved.found).toBe(true);
    expect(resolved.visible).toBe(true);
    expect(resolved.rect).toMatchObject({ x: 10, y: 100, width: 120, height: 32 });

    const scrollIntoView = vi.fn();
    Object.defineProperty(document.getElementById('next')!, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 50 });
    evalInPage(buildAiResolveExpression(next.ref, { scrollIntoView: true }));
    expect(scrollIntoView).toHaveBeenCalled();

    const stale = evalInPage<{ found: boolean }>(buildAiResolveExpression('e999'));
    expect(stale.found).toBe(false);
  });

  it('准备输入框：聚焦并全选现有内容，按钮不可输入', () => {
    const snapshot = evalInPage<{ elements: Array<{ ref: string; name: string }> }>(
      buildAiSnapshotExpression()
    );
    const nameInput = snapshot.elements.find((item) => item.name === '申请人姓名')!;
    const prepared = evalInPage<{ ok: boolean; value: string }>(
      buildAiPrepareInputExpression(nameInput.ref)
    );
    const input = document.getElementById('fullName') as HTMLInputElement;
    expect(prepared).toMatchObject({ ok: true, value: '张三' });
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(2);

    const button = snapshot.elements.find((item) => item.name === '下一步')!;
    const rejected = evalInPage<{ ok: boolean; reason: string }>(
      buildAiPrepareInputExpression(button.ref)
    );
    expect(rejected).toMatchObject({ ok: false, reason: 'not_editable' });
  });

  it('下拉选择按选项文字匹配并触发 change 事件', () => {
    const snapshot = evalInPage<{ elements: Array<{ ref: string; name: string }> }>(
      buildAiSnapshotExpression()
    );
    const area = snapshot.elements.find((item) => item.name === '服务区域')!;
    const select = document.getElementById('area') as HTMLSelectElement;
    const onChange = vi.fn();
    select.addEventListener('change', onChange);

    const selected = evalInPage<{ ok: boolean; value: string; text: string }>(
      buildAiSelectExpression(area.ref, '九龙')
    );
    expect(selected).toMatchObject({ ok: true, value: 'kl', text: '九龙' });
    expect(select.value).toBe('kl');
    expect(onChange).toHaveBeenCalledTimes(1);

    const missing = evalInPage<{ ok: boolean; reason: string; options: string[] }>(
      buildAiSelectExpression(area.ref, '新界')
    );
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe('option_not_found');
    expect(missing.options).toContain('香港岛');
  });

  it('滚动返回前后位置并可回到顶部', () => {
    let scrollY = 0;
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      get: () => scrollY
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 2400
    });
    Object.defineProperty(window, 'scrollBy', {
      configurable: true,
      value: (_x: number, y: number) => {
        scrollY = Math.max(0, scrollY + y);
      }
    });
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: (_x: number, y: number) => {
        scrollY = y;
      }
    });

    const down = evalInPage<{
      before: { y: number };
      after: { y: number };
      changed: boolean;
    }>(buildAiScrollExpression('down', 300));
    expect(down).toMatchObject({ before: { y: 0 }, after: { y: 300 }, changed: true });

    const bottom = evalInPage<{ after: { y: number } }>(buildAiScrollExpression('bottom'));
    expect(bottom.after.y).toBe(2400);

    const top = evalInPage<{ after: { y: number } }>(buildAiScrollExpression('top'));
    expect(top.after.y).toBe(0);
  });
});
