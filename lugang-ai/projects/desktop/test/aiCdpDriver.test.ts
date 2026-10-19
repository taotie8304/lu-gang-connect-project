import { describe, expect, it, vi } from 'vitest';
import { CdpPageDriver, type AiCdpSession } from '../src/main/ai/cdpDriver';

type CdpCall = { method: string; params?: Record<string, unknown> };

const createSession = (handler?: (method: string, params?: Record<string, unknown>) => unknown) => {
  const calls: CdpCall[] = [];
  const session: AiCdpSession = {
    sendCommand: async (method, params) => {
      calls.push({ method, params });
      if (handler) return handler(method, params);
      return { result: { value: undefined } };
    }
  };
  return { session, calls };
};

const rawSnapshot = {
  url: 'https://www.gov.hk/sc/apply?token=secret#part2',
  title: '申请页面',
  text: '申请人姓名 下一步',
  scroll: { x: 0, y: 100, viewportWidth: 1280, viewportHeight: 720, pageHeight: 2000 },
  elements: [
    {
      ref: 'e1',
      role: 'textbox',
      name: '申请人姓名',
      tag: 'input',
      type: 'text',
      placeholder: '请输入姓名',
      value: '张三',
      visible: true
    }
  ]
};

const createDriver = (
  handler?: (method: string, params?: Record<string, unknown>) => unknown,
  overrides: { settleMs?: number; navigate?: (url: string) => Promise<void> } = {}
) => {
  const { session, calls } = createSession(handler);
  const sleep = vi.fn(async () => undefined);
  const navigate = overrides.navigate ?? vi.fn(async () => undefined);
  const driver = new CdpPageDriver({
    getSession: () => session,
    navigate,
    settleMs: overrides.settleMs ?? 250,
    sleep
  });
  return { driver, calls, sleep, navigate };
};

describe('CDP 页面驱动', () => {
  it('通过 Runtime.evaluate 读取页面快照并规范化', async () => {
    const { driver, calls } = createDriver(() => ({ result: { value: rawSnapshot } }));
    const snapshot = await driver.snapshot({ fullText: true });

    expect(calls[0].method).toBe('Runtime.evaluate');
    expect(calls[0].params).toMatchObject({ returnByValue: true, awaitPromise: true });
    expect(String(calls[0].params?.expression)).toContain('__lugangAi.snapshot');
    expect(snapshot.url).toBe('https://www.gov.hk/sc/apply');
    expect(snapshot.elements[0]).toMatchObject({ name: '申请人姓名', value: '张三' });
  });

  it('解析引用返回可点击矩形，失效引用返回 null', async () => {
    const { driver, calls } = createDriver((_method, params) => {
      const expression = String(params?.expression ?? '');
      if (expression.includes('"e1"')) {
        return {
          result: {
            value: { found: true, visible: true, rect: { x: 10, y: 20, width: 100, height: 40 } }
          }
        };
      }
      return { result: { value: { found: false } } };
    });

    const found = await driver.resolve('e1', { scrollIntoView: true });
    expect(found).toMatchObject({
      found: true,
      visible: true,
      rect: { x: 10, y: 20, width: 100, height: 40 }
    });

    const missing = await driver.resolve('e9');
    expect(missing).toBeNull();
    expect(calls).toHaveLength(2);
    expect(String(calls[0].params?.expression)).toContain('scrollIntoView');
  });

  it('点击使用真实鼠标事件序列', async () => {
    const { driver, calls } = createDriver();
    await driver.clickAt(60.4, 40.6);

    expect(calls.map((call) => call.method)).toEqual([
      'Input.dispatchMouseEvent',
      'Input.dispatchMouseEvent',
      'Input.dispatchMouseEvent'
    ]);
    expect(calls.map((call) => call.params?.type)).toEqual([
      'mouseMoved',
      'mousePressed',
      'mouseReleased'
    ]);
    expect(calls[1].params).toMatchObject({ x: 60, y: 41, button: 'left', clickCount: 1 });
  });

  it('输入前全选，再使用 insertText 替换旧内容', async () => {
    const { driver, calls } = createDriver();
    await driver.insertText('李四');

    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({
      method: 'Input.dispatchKeyEvent',
      params: { type: 'rawKeyDown', key: 'a', modifiers: 2 }
    });
    expect(calls[1]).toMatchObject({
      method: 'Input.dispatchKeyEvent',
      params: { type: 'keyUp', key: 'a', modifiers: 2 }
    });
    expect(calls[2]).toEqual({ method: 'Input.insertText', params: { text: '李四' } });
  });

  it('下拉选项文本按 JSON 转义嵌入页面脚本', async () => {
    const option = '九龙"); alert(1);//';
    const { driver, calls } = createDriver(() => ({
      result: { value: { ok: true, value: 'kl', text: '九龙' } }
    }));
    const result = await driver.selectOption('e1', option);

    expect(result).toMatchObject({ ok: true, value: 'kl' });
    expect(String(calls[0].params?.expression)).toContain(JSON.stringify(option));
  });

  it('页面未加载完成时轮询等待', async () => {
    let readyChecks = 0;
    const { driver, sleep } = createDriver((_method, params) => {
      const expression = String(params?.expression ?? '');
      if (expression.includes('document.readyState')) {
        readyChecks += 1;
        return { result: { value: readyChecks >= 2 ? 'complete' : 'loading' } };
      }
      return { result: { value: undefined } };
    });

    await driver.settle();
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(readyChecks).toBe(2);
  });

  it('页面脚本异常时抛出中文错误', async () => {
    const { driver } = createDriver(() => ({
      exceptionDetails: { text: 'Uncaught ReferenceError' }
    }));

    await expect(driver.snapshot()).rejects.toThrow('页面');
  });

  it('没有可用页面时抛出错误', async () => {
    const driver = new CdpPageDriver({
      getSession: () => null,
      navigate: async () => undefined,
      sleep: async () => undefined
    });

    await expect(driver.snapshot()).rejects.toThrow('页面');
  });

  it('导航交给宿主执行并等待页面就绪', async () => {
    const navigate = vi.fn(async () => undefined);
    const { driver, calls } = createDriver(
      () => ({ result: { value: rawSnapshot } }),
      { navigate }
    );

    await driver.navigate('https://www.gov.hk/sc/apply');
    expect(navigate).toHaveBeenCalledWith('https://www.gov.hk/sc/apply');
    expect(
      calls.some((call) => String(call.params?.expression).includes('document.readyState'))
    ).toBe(true);
  });

  it('选项不存在时保留可选值清单', async () => {
    const { driver } = createDriver(() => ({
      result: { value: { ok: false, reason: 'option_not_found', options: ['香港岛', '九龙'] } }
    }));
    const result = await driver.selectOption('e1', '新界');
    expect(result).toMatchObject({
      ok: false,
      reason: 'option_not_found',
      options: ['香港岛', '九龙']
    });
  });

  it('读取文件入口状态', async () => {
    const { driver, calls } = createDriver(() => ({
      result: {
        value: {
          found: true,
          isFile: true,
          multiple: true,
          accept: '.docx,.pdf',
          count: 1,
          names: ['申请书.docx']
        }
      }
    }));

    const state = await driver.fileInput('e3');
    expect(state).toMatchObject({
      found: true,
      isFile: true,
      multiple: true,
      accept: '.docx,.pdf',
      count: 1,
      names: ['申请书.docx']
    });
    expect(String(calls[0].params?.expression)).toContain('__lugangAi.fileInput');
    expect(String(calls[0].params?.expression)).toContain('"e3"');
  });

  it('通过 DOM.setFileInputFiles 给文件入口设置本机文件', async () => {
    const { driver, calls } = createDriver((method) => {
      if (method === 'DOM.getDocument') return { root: { nodeId: 7 } };
      if (method === 'DOM.querySelector') return { nodeId: 42 };
      return {};
    });

    const ok = await driver.setFileInputFiles('e5', ['C:\\Users\\tester\\申请书.docx']);
    expect(ok).toBe(true);
    expect(calls.map((call) => call.method)).toEqual([
      'DOM.getDocument',
      'DOM.querySelector',
      'DOM.setFileInputFiles'
    ]);
    expect(calls[1].params).toMatchObject({
      nodeId: 7,
      selector: '[data-lugang-ai-ref="e5"]'
    });
    expect(calls[2].params).toMatchObject({
      nodeId: 42,
      files: ['C:\\Users\\tester\\申请书.docx']
    });
  });

  it('文件入口引用失效时不设置文件', async () => {
    const { driver, calls } = createDriver((method) => {
      if (method === 'DOM.getDocument') return { root: { nodeId: 7 } };
      if (method === 'DOM.querySelector') return { nodeId: 0 };
      return {};
    });

    expect(await driver.setFileInputFiles('e9', ['C:\\x.docx'])).toBe(false);
    expect(calls.some((call) => call.method === 'DOM.setFileInputFiles')).toBe(false);
  });

  it('非法文件入口引用不查询页面', async () => {
    const { driver, calls } = createDriver();
    expect(await driver.setFileInputFiles('bad"ref', ['C:\\x.docx'])).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
