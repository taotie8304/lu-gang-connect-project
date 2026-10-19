import { describe, expect, it } from 'vitest';
import { AiExecutor, type AiPageDriver } from '../src/main/ai/executor';
import type { AiPageElement, AiPageSnapshot } from '../src/main/ai/snapshot';
import type {
  AiPrepareInputResult,
  AiScrollResult,
  AiSelectOptionResult
} from '../src/main/ai/executor';

const makeElement = (
  overrides: Partial<AiPageElement> & { ref: string; name: string }
): AiPageElement => ({
  role: 'button',
  tag: 'button',
  visible: true,
  ...overrides
});

const makeSnapshot = (
  elements: AiPageElement[],
  overrides: Partial<AiPageSnapshot> = {}
): AiPageSnapshot => ({
  url: 'https://www.gov.hk/sc/form',
  title: '政府表格',
  text: '请填写表格信息',
  elements,
  scroll: { x: 0, y: 0, viewportWidth: 1280, viewportHeight: 720, pageHeight: 2000 },
  ...overrides
});

type DriverOptions = {
  snapshots?: AiPageSnapshot[];
  resolveFailRefs?: string[];
  afterClick?: AiPageSnapshot;
  navigateSnapshot?: AiPageSnapshot;
  prepare?: (ref: string) => AiPrepareInputResult;
  select?: (ref: string, option: string) => AiSelectOptionResult;
  scrollResult?: AiScrollResult;
  insert?: (text: string) => void;
};

const createDriver = (initial: AiPageSnapshot, options: DriverOptions = {}) => {
  let current = structuredClone(initial);
  const queue = [...(options.snapshots ?? [])];
  let activeRef: string | null = null;
  const calls = {
    snapshots: [] as Array<{ fullText?: boolean } | undefined>,
    resolve: [] as Array<{ ref: string; options?: { scrollIntoView?: boolean } }>,
    prepare: [] as string[],
    select: [] as Array<[string, string]>,
    scroll: [] as Array<[string, number | undefined]>,
    clickAt: [] as Array<[number, number]>,
    insertText: [] as string[],
    navigate: [] as string[],
    settle: 0
  };

  const driver: AiPageDriver = {
    snapshot: async (snapshotOptions) => {
      calls.snapshots.push(snapshotOptions);
      if (queue.length > 0) current = structuredClone(queue.shift()!);
      return current;
    },
    resolve: async (ref, resolveOptions) => {
      calls.resolve.push({ ref, options: resolveOptions });
      if (options.resolveFailRefs?.includes(ref)) return null;
      const element = current.elements.find((item) => item.ref === ref);
      if (!element) return null;
      return {
        found: true,
        visible: element.visible !== false,
        rect: { x: 10, y: 20, width: 100, height: 40 },
        value: element.value,
        checked: element.checked
      };
    },
    prepareInput: async (ref) => {
      calls.prepare.push(ref);
      if (options.prepare) return options.prepare(ref);
      activeRef = ref;
      const element = current.elements.find((item) => item.ref === ref);
      return { ok: true, value: element?.value ?? '' };
    },
    selectOption: async (ref, option) => {
      calls.select.push([ref, option]);
      if (options.select) return options.select(ref, option);
      const element = current.elements.find((item) => item.ref === ref);
      if (element) element.value = option;
      return { ok: true, value: option, text: option };
    },
    scroll: async (direction, amount) => {
      calls.scroll.push([direction, amount]);
      return (
        options.scrollResult ?? {
          before: { ...current.scroll },
          after: { ...current.scroll, y: current.scroll.y + 300 },
          changed: true
        }
      );
    },
    clickAt: async (x, y) => {
      calls.clickAt.push([x, y]);
      if (options.afterClick) current = structuredClone(options.afterClick);
    },
    insertText: async (text) => {
      calls.insertText.push(text);
      if (options.insert) {
        options.insert(text);
        return;
      }
      if (!activeRef) return;
      const element = current.elements.find((item) => item.ref === activeRef);
      if (element) element.value = text;
    },
    navigate: async (url) => {
      calls.navigate.push(url);
      current = structuredClone(
        options.navigateSnapshot ?? makeSnapshot([], { url: url.split('?')[0] })
      );
    },
    settle: async () => {
      calls.settle += 1;
    }
  };

  return { driver, calls };
};

const allowedHosts = ['.gov.hk', '.gov.cn'];
const createExecutor = (driver: AiPageDriver) =>
  new AiExecutor({ driver, allowedHosts });

describe('AI 页面执行器', () => {
  it('点击目标并返回操作后的页面快照', async () => {
    const afterClick = makeSnapshot(
      [makeElement({ ref: 'e1', name: '下一步', text: '下一步' })],
      { text: '已进入第二步' }
    );
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '下一步', text: '下一步' })]),
      { afterClick }
    );
    const result = await createExecutor(driver).execute({ action: 'click', ref: 'e1' });

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.snapshot?.text).toBe('已进入第二步');
    expect(calls.clickAt).toEqual([[60, 40]]);
    expect(calls.settle).toBe(1);
  });

  it('目标不存在时补读一次页面，再失败才返回可操作提示', async () => {
    const { driver, calls } = createDriver(makeSnapshot([], { text: '登录页面' }));
    const result = await createExecutor(driver).execute({
      action: 'click',
      target: '登录按钮'
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_found');
    expect(result.message).toContain('登录按钮');
    expect(result.message).toContain('重新读取');
    expect(calls.snapshots).toHaveLength(2);
    expect(calls.clickAt).toHaveLength(0);
  });

  it('多个同名元素时拒绝猜测', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([
        makeElement({ ref: 'e1', name: '下一步', text: '下一步' }),
        makeElement({ ref: 'e2', name: '下一步', text: '下一步' })
      ])
    );
    const result = await createExecutor(driver).execute({
      action: 'click',
      target: '下一步'
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('ambiguous');
    expect(result.message).toContain('多个');
    expect(calls.clickAt).toHaveLength(0);
  });

  it('页面变化导致引用失效时按语义重新定位', async () => {
    const first = makeSnapshot([makeElement({ ref: 'e1', name: '下一步', text: '下一步' })]);
    const second = makeSnapshot([makeElement({ ref: 'e7', name: '下一步', text: '下一步' })]);
    const { driver, calls } = createDriver(first, {
      snapshots: [first, second],
      resolveFailRefs: ['e1'],
      afterClick: second
    });

    const result = await createExecutor(driver).execute({
      action: 'click',
      ref: 'e1',
      target: '下一步'
    });

    expect(result.ok).toBe(true);
    expect(calls.resolve.map((item) => item.ref)).toEqual(['e1', 'e7']);
    expect(calls.clickAt).toHaveLength(1);
  });

  it('只有失效引用、没有语义描述时不做危险猜测', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '下一步', text: '下一步' })]),
      { resolveFailRefs: ['e1'] }
    );
    const result = await createExecutor(driver).execute({ action: 'click', ref: 'e1' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_found');
    expect(calls.clickAt).toHaveLength(0);
  });

  it('密码字段硬拦截，绝不点击或输入', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([
        makeElement({
          ref: 'e1',
          name: '登录密码',
          role: 'textbox',
          tag: 'input',
          type: 'password'
        })
      ])
    );
    const result = await createExecutor(driver).execute({
      action: 'type',
      ref: 'e1',
      text: 'my-password'
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('sensitive_blocked');
    expect(result.message).toContain('亲自');
    expect(calls.insertText).toHaveLength(0);
    expect(calls.clickAt).toHaveLength(0);
  });

  it('提交、支付、发布、删除类按钮硬拦截', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '确认支付', text: '确认支付' })])
    );
    const result = await createExecutor(driver).execute({ action: 'click', ref: 'e1' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('high_risk_blocked');
    expect(result.message).toContain('本人确认');
    expect(calls.clickAt).toHaveLength(0);
  });

  it('点击后未看到预期结果时返回校验失败', async () => {
    const afterClick = makeSnapshot(
      [makeElement({ ref: 'e1', name: '下一步', text: '下一步' })],
      { text: '发生错误，请稍后再试' }
    );
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '下一步', text: '下一步' })]),
      { afterClick }
    );
    const result = await createExecutor(driver).execute({
      action: 'click',
      ref: 'e1',
      expect: '已进入第二步'
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('verification_failed');
    expect(result.message).toContain('已进入第二步');
    expect(calls.clickAt).toHaveLength(1);
  });

  it('点击后看到预期结果时通过校验', async () => {
    const afterClick = makeSnapshot([], { text: '已进入第二步' });
    const { driver } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '下一步', text: '下一步' })]),
      { afterClick }
    );
    const result = await createExecutor(driver).execute({
      action: 'click',
      ref: 'e1',
      expect: '第二步'
    });
    expect(result.ok).toBe(true);
  });

  it('输入文字并校验字段值', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([
        makeElement({ ref: 'e1', name: '申请人姓名', role: 'textbox', tag: 'input', value: '张三' })
      ])
    );
    const result = await createExecutor(driver).execute({
      action: 'type',
      ref: 'e1',
      text: '李四'
    });

    expect(result.ok).toBe(true);
    expect(calls.insertText).toEqual(['李四']);
    expect(result.snapshot?.elements[0].value).toBe('李四');
  });

  it('输入未生效时返回校验失败，便于自动重试', async () => {
    const { driver } = createDriver(
      makeSnapshot([
        makeElement({ ref: 'e1', name: '申请人姓名', role: 'textbox', tag: 'input', value: '张三' })
      ]),
      { insert: () => undefined }
    );
    const result = await createExecutor(driver).execute({
      action: 'type',
      ref: 'e1',
      text: '李四'
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('verification_failed');
    expect(result.message).toContain('没有生效');
  });

  it('不可输入的按钮不能作为输入目标', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '下一步', text: '下一步' })]),
      { prepare: () => ({ ok: false, reason: 'not_editable' }) }
    );
    const result = await createExecutor(driver).execute({
      action: 'type',
      ref: 'e1',
      text: '测试'
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_editable');
    expect(result.message).toContain('不是可输入');
    expect(calls.insertText).toHaveLength(0);
  });

  it('下拉选择成功并返回页面快照', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([
        makeElement({ ref: 'e1', name: '服务区域', role: 'combobox', tag: 'select', value: 'hk' })
      ])
    );
    const result = await createExecutor(driver).execute({
      action: 'select',
      ref: 'e1',
      option: '九龙'
    });

    expect(result.ok).toBe(true);
    expect(calls.select).toEqual([['e1', '九龙']]);
  });

  it('下拉选项不存在时列出可选值', async () => {
    const { driver } = createDriver(
      makeSnapshot([
        makeElement({ ref: 'e1', name: '服务区域', role: 'combobox', tag: 'select' })
      ]),
      {
        select: () => ({
          ok: false,
          reason: 'option_not_found',
          options: ['香港岛', '九龙']
        })
      }
    );
    const result = await createExecutor(driver).execute({
      action: 'select',
      ref: 'e1',
      option: '新界'
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('option_not_found');
    expect(result.message).toContain('香港岛');
  });

  it('滚动页面并返回是否发生变化', async () => {
    const { driver, calls } = createDriver(makeSnapshot([]));
    const result = await createExecutor(driver).execute({
      action: 'scroll',
      direction: 'down',
      amount: 300
    });

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(calls.scroll).toEqual([['down', 300]]);
  });

  it('导航到白名单内的政府网站', async () => {
    const { driver, calls } = createDriver(makeSnapshot([]));
    const result = await createExecutor(driver).execute({
      action: 'navigate',
      url: 'https://www.gov.hk/sc/forms/apply?lang=sc'
    });

    expect(result.ok).toBe(true);
    expect(calls.navigate).toEqual(['https://www.gov.hk/sc/forms/apply?lang=sc']);
    expect(result.snapshot?.url).toBe('https://www.gov.hk/sc/forms/apply');
  });

  it('导航到非白名单网站时拒绝', async () => {
    const { driver, calls } = createDriver(makeSnapshot([]));
    const result = await createExecutor(driver).execute({
      action: 'navigate',
      url: 'https://evil.example.com/steal'
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_allowed');
    expect(calls.navigate).toHaveLength(0);
  });

  it('导航到非法协议时拒绝', async () => {
    const { driver } = createDriver(makeSnapshot([]));
    const result = await createExecutor(driver).execute({
      action: 'navigate',
      url: 'javascript:alert(1)'
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('invalid_url');
  });

  it('当前页面不在白名单时不允许任何操作', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '下一步', text: '下一步' })], {
        url: 'https://evil.example.com/page'
      })
    );
    const result = await createExecutor(driver).execute({ action: 'click', ref: 'e1' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_allowed');
    expect(calls.clickAt).toHaveLength(0);
  });

  it('导航被重定向到非白名单网站时立即拦截', async () => {
    const { driver } = createDriver(makeSnapshot([]), {
      navigateSnapshot: makeSnapshot([], { url: 'https://evil.example.com/redirected' })
    });
    const result = await createExecutor(driver).execute({
      action: 'navigate',
      url: 'https://www.gov.hk'
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_allowed');
  });

  it('读取页面支持全文模式', async () => {
    const { driver, calls } = createDriver(makeSnapshot([]));
    const result = await createExecutor(driver).execute({ action: 'read', fullText: true });

    expect(result.ok).toBe(true);
    expect(calls.snapshots).toEqual([{ fullText: true }]);
    expect(result.snapshot?.title).toBe('政府表格');
  });

  it('停止指令不触发页面操作', async () => {
    const { driver, calls } = createDriver(makeSnapshot([]));
    const result = await createExecutor(driver).execute({ action: 'stop' });

    expect(result.ok).toBe(true);
    expect(result.stopped).toBe(true);
    expect(calls.snapshots).toHaveLength(0);
    expect(calls.clickAt).toHaveLength(0);
  });

  it('页面驱动异常时返回可操作的中文说明', async () => {
    const driver = createDriver(makeSnapshot([])).driver;
    driver.snapshot = async () => {
      throw new Error('debugger detached');
    };
    const result = await createExecutor(driver).execute({ action: 'read' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('page_error');
    expect(result.message).toContain('页面');
  });
});
