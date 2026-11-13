import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAiFileStateExpression,
  buildAiMaskSensitiveExpression,
  buildAiPrepareInputExpression,
  buildAiResolveExpression,
  buildAiScrollExpression,
  buildAiSelectExpression,
  buildAiSnapshotExpression,
  buildAiUnmaskExpression
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
    <label for="resume">上传附件</label>
    <input id="resume" name="resume" type="file" accept=".doc,.docx,.pdf" multiple style="display:none" />
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

  afterEach(() => {
    vi.restoreAllMocks();
    document
      .querySelectorAll('[data-lugang-ai-mask="1"]')
      .forEach((node) => node.remove());
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

  it('快照包含隐藏的文件上传入口，但不返回本机路径', () => {
    const snapshot = evalInPage<{
      elements: Array<{
        ref: string;
        name: string;
        type?: string;
        value?: string;
      }>;
    }>(buildAiSnapshotExpression());

    const file = snapshot.elements.find((item) => item.type === 'file');
    expect(file).toBeTruthy();
    expect(file?.name).toBe('上传附件');
    expect(file?.value).toBeUndefined();
  });

  it('读取文件入口是否支持多选、允许格式与已选文件', () => {
    const snapshot = evalInPage<{ elements: Array<{ ref: string; type?: string }> }>(
      buildAiSnapshotExpression()
    );
    const file = snapshot.elements.find((item) => item.type === 'file')!;

    const initial = evalInPage<{
      found: boolean;
      isFile: boolean;
      multiple: boolean;
      accept: string;
      count: number;
      names: string[];
    }>(buildAiFileStateExpression(file.ref));
    expect(initial).toMatchObject({
      found: true,
      isFile: true,
      multiple: true,
      accept: '.doc,.docx,.pdf',
      count: 0,
      names: []
    });

    const input = document.getElementById('resume') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ name: '申请书.docx' }]
    });
    const after = evalInPage<{ count: number; names: string[] }>(
      buildAiFileStateExpression(file.ref)
    );
    expect(after.count).toBe(1);
    expect(after.names).toEqual(['申请书.docx']);
  });

  it('文件入口不能作为文字输入目标', () => {
    const snapshot = evalInPage<{ elements: Array<{ ref: string; type?: string }> }>(
      buildAiSnapshotExpression()
    );
    const file = snapshot.elements.find((item) => item.type === 'file')!;
    const rejected = evalInPage<{ ok: boolean; reason: string }>(
      buildAiPrepareInputExpression(file.ref)
    );
    expect(rejected).toMatchObject({ ok: false, reason: 'not_editable' });
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

  it('滚动到目标使用即时定位，避免平滑滚动导致点击坐标过期', () => {
    const snapshot = evalInPage<{ elements: Array<{ ref: string; name: string }> }>(
      buildAiSnapshotExpression()
    );
    const next = snapshot.elements.find((item) => item.name === '下一步')!;
    const scrollIntoView = vi.fn();
    Object.defineProperty(document.getElementById('next')!, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView
    });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 50 });

    evalInPage(buildAiResolveExpression(next.ref, { scrollIntoView: true }));

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      inline: 'nearest',
      behavior: 'instant'
    });
  });

  it('解析元素时报告遮挡层，命中自身或子元素不算遮挡', () => {
    const snapshot = evalInPage<{ elements: Array<{ ref: string; name: string }> }>(
      buildAiSnapshotExpression()
    );
    const next = snapshot.elements.find((item) => item.name === '下一步')!;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });

    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', '隐私提示');
    Object.defineProperty(overlay, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 0, y: 0, left: 0, top: 0, width: 1024, height: 800, right: 1024, bottom: 800 })
    });
    document.body.appendChild(overlay);

    const elementFromPoint = vi.fn(() => overlay as Element);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint
    });

    const covered = evalInPage<{
      found: boolean;
      covered?: {
        tag: string;
        role: string;
        name: string;
        rect?: { x: number; y: number; width: number; height: number };
      };
    }>(buildAiResolveExpression(next.ref, { scrollIntoView: true }));
    expect(covered.found).toBe(true);
    expect(covered.covered).toMatchObject({
      tag: 'div',
      role: 'dialog',
      name: '隐私提示',
      rect: { x: 0, y: 0, width: 1024, height: 800 }
    });
    expect(elementFromPoint).toHaveBeenCalledWith(70, 116);

    elementFromPoint.mockReturnValue(document.getElementById('next')!);
    const self = evalInPage<{ covered?: unknown }>(buildAiResolveExpression(next.ref));
    expect(self.covered).toBeUndefined();
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

  it('为密码、验证码与银行卡输入框生成视口坐标遮罩', () => {
    document.body.innerHTML += `
      <input id="otp" autocomplete="one-time-code" value="123456" />
      <input id="card" autocomplete="cc-number" value="4111111111111111" />
      <input id="newPwd" type="password" autocomplete="new-password" value="abc" />
    `;
    // 鲁港通 - innerHTML 重写会重建全部节点，基础用例里的密码框需要重新打桩
    stubRect(document.getElementById('pwd')!, { x: 10, y: 60 });
    stubRect(document.getElementById('otp')!, { x: 10, y: 340 });
    stubRect(document.getElementById('card')!, { x: 10, y: 380 });
    stubRect(document.getElementById('newPwd')!, { x: 10, y: 420 });

    const result = evalInPage<{ ok: boolean; masked: number }>(
      buildAiMaskSensitiveExpression()
    );

    expect(result).toEqual({ ok: true, masked: 4 });
    const masks = document.querySelectorAll('[data-lugang-ai-mask="1"]');
    expect(masks).toHaveLength(4);
    const first = masks[0] as HTMLElement;
    expect(first.parentElement).toBe(document.documentElement);
    expect(first.style.position).toBe('fixed');
    expect(first.style.left).toBe('10px');
    expect(first.style.top).toBe('60px');
    expect(first.style.background).toBe('rgb(31, 35, 41)');
    expect(first.style.zIndex).toBe('2147483647');
    expect(first.style.pointerEvents).toBe('none');
  });

  it('不遮罩普通文本框、隐藏字段和视口外字段', () => {
    document.body.innerHTML += `
      <input id="hiddenPwd" type="password" value="x" style="display:none" />
    `;
    stubRect(document.getElementById('hiddenPwd')!, { x: 10, y: 460 });
    stubRect(document.getElementById('pwd')!, { x: 10, y: 5000 });

    const result = evalInPage<{ ok: boolean; masked: number }>(
      buildAiMaskSensitiveExpression()
    );

    expect(result).toEqual({ ok: true, masked: 0 });
    expect(document.querySelectorAll('[data-lugang-ai-mask="1"]')).toHaveLength(0);
  });

  it('跨域 iframe 整块遮罩', () => {
    const frame = document.createElement('iframe');
    frame.id = 'crossOrigin';
    document.body.appendChild(frame);
    Object.defineProperty(frame, 'contentDocument', {
      configurable: true,
      get: () => null
    });
    stubRect(frame, { x: 100, y: 200, width: 400, height: 300 });

    const result = evalInPage<{ ok: boolean; masked: number }>(
      buildAiMaskSensitiveExpression()
    );

    expect(result).toEqual({ ok: true, masked: 2 });
    const masks = document.querySelectorAll('[data-lugang-ai-mask="1"]');
    expect(masks).toHaveLength(2);
    const iframeMask = masks[1] as HTMLElement;
    expect(iframeMask.style.left).toBe('100px');
    expect(iframeMask.style.top).toBe('200px');
    expect(iframeMask.style.width).toBe('400px');
    expect(iframeMask.style.height).toBe('300px');
  });

  it('移除遮罩只删自己的标记节点', () => {
    document.body.innerHTML += `<div id="pageOwn">页面内容</div>`;
    // 鲁港通 - 同上，innerHTML 重写后重新打桩密码框，保证页面上确实存在遮罩
    stubRect(document.getElementById('pwd')!, { x: 10, y: 60 });
    const masked = evalInPage<{ ok: boolean }>(buildAiMaskSensitiveExpression());
    expect(masked.ok).toBe(true);
    expect(document.querySelectorAll('[data-lugang-ai-mask="1"]').length).toBeGreaterThan(0);

    evalInPage(buildAiUnmaskExpression());

    expect(document.querySelectorAll('[data-lugang-ai-mask="1"]')).toHaveLength(0);
    expect(document.getElementById('pageOwn')).not.toBeNull();
  });

  it('遮罩注入失败时回滚已插入的遮罩并返回 ok=false', () => {
    document.body.innerHTML += `
      <input id="otp" autocomplete="one-time-code" value="123456" />
    `;
    // 鲁港通 - innerHTML 重写会重建全部节点；重新打桩后页面上有 2 个可遮罩目标，第 2 次 appendChild 才会发生
    stubRect(document.getElementById('pwd')!, { x: 10, y: 60 });
    stubRect(document.getElementById('otp')!, { x: 10, y: 340 });

    // 鲁港通 - 第 2 次 appendChild 抛错时首个遮罩已插入，失败必须回滚干净，不留残影
    let calls = 0;
    const original = document.documentElement.appendChild.bind(document.documentElement);
    vi.spyOn(document.documentElement, 'appendChild').mockImplementation(((
      ...args: Parameters<typeof original>
    ) => {
      calls += 1;
      if (calls === 2) throw new Error('blocked');
      return original(...args);
    }) as typeof document.documentElement.appendChild);

    const result = evalInPage<{ ok: boolean; masked: number }>(
      buildAiMaskSensitiveExpression()
    );

    expect(calls).toBe(2);
    expect(result).toEqual({ ok: false, masked: 0 });
    expect(document.querySelectorAll('[data-lugang-ai-mask="1"]')).toHaveLength(0);
  });
});
