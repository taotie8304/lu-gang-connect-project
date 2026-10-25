import { describe, expect, it, vi } from 'vitest';
import {
  AiExecutor,
  type AiConfirmer,
  type AiFileGenerator,
  type AiFileInputState,
  type AiPageDriver
} from '../src/main/ai/executor';
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
  fileInputState?: AiFileInputState;
  fileStateAfterSet?: AiFileInputState;
  setFilesResult?: boolean;
  uploadSnapshot?: AiPageSnapshot;
};

const createDriver = (initial: AiPageSnapshot, options: DriverOptions = {}) => {
  let current = structuredClone(initial);
  let fileState: AiFileInputState = options.fileInputState ?? {
    found: true,
    isFile: true,
    multiple: false,
    count: 0,
    names: []
  };
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
    fileInput: [] as string[],
    setFiles: [] as Array<[string, string[]]>,
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
    fileInput: async (ref) => {
      calls.fileInput.push(ref);
      return { ...fileState };
    },
    setFileInputFiles: async (ref, files) => {
      calls.setFiles.push([ref, files]);
      if (options.setFilesResult === false) return false;
      fileState = options.fileStateAfterSet ?? {
        ...fileState,
        count: files.length,
        names: files.map((file) => file.split(/[\\/]/).pop() ?? file)
      };
      if (options.uploadSnapshot) current = structuredClone(options.uploadSnapshot);
      return true;
    },
    settle: async () => {
      calls.settle += 1;
    }
  };

  return { driver, calls };
};

const allowedHosts = ['.gov.hk', '.gov.cn'];
const createExecutor = (
  driver: AiPageDriver,
  extras: {
    generateFile?: AiFileGenerator;
    pickFile?: () => Promise<string | null>;
    confirm?: AiConfirmer;
  } = {}
) => new AiExecutor({ driver, allowedHosts, ...extras });

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

  it('支付、转账、购买类按钮永久硬拦截', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '确认支付', text: '确认支付' })])
    );
    const result = await createExecutor(driver).execute({ action: 'click', ref: 'e1' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('high_risk_blocked');
    expect(result.message).toContain('本人完成');
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

  it('生成文件不读取页面，只返回文件名和保存位置', async () => {
    const { driver, calls } = createDriver(makeSnapshot([]));
    const generateFile = vi.fn<AiFileGenerator>(async (input) => ({
      name: `${input.fileName}.${input.format}`,
      format: input.format,
      folder: '下载 / 鲁港通生成文件',
      path: 'C:\\Users\\tester\\Downloads\\鲁港通生成文件\\申请书.docx'
    }));

    const result = await createExecutor(driver, { generateFile }).execute({
      action: 'generate_file',
      format: 'docx',
      fileName: '申请书',
      title: '慈善组织申请书',
      content: '申请人：张三'
    });

    expect(result.ok).toBe(true);
    expect(result.file).toEqual({
      name: '申请书.docx',
      format: 'docx',
      folder: '下载 / 鲁港通生成文件'
    });
    expect(JSON.stringify(result)).not.toContain('C:\\');
    expect(generateFile).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'docx',
        fileName: '申请书',
        title: '慈善组织申请书',
        content: '申请人：张三'
      })
    );
    expect(calls.snapshots).toHaveLength(0);
  });

  it('生成文件失败时给出可操作提示', async () => {
    const { driver } = createDriver(makeSnapshot([]));
    const result = await createExecutor(driver, {
      generateFile: async () => {
        throw new Error('disk full');
      }
    }).execute({
      action: 'generate_file',
      format: 'pdf',
      fileName: '申请说明',
      content: '正文'
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('file_generation_failed');
    expect(result.message).toContain('重新');
  });

  it('客户端未接入文件生成时不假装成功', async () => {
    const { driver } = createDriver(makeSnapshot([]));
    const result = await createExecutor(driver).execute({
      action: 'generate_file',
      format: 'xlsx',
      fileName: '名单',
      rows: [['姓名'], ['张三']]
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('file_generation_failed');
    expect(result.message).toContain('升级');
  });

  it('用户亲手选文件后附加到上传入口，只回传文件名', async () => {
    const page = makeSnapshot([
      makeElement({ ref: 'e1', name: '上传附件', tag: 'input', type: 'file' })
    ]);
    const { driver, calls } = createDriver(page, {
      fileInputState: { found: true, isFile: true, multiple: false, count: 0, names: [] },
      uploadSnapshot: makeSnapshot(
        [makeElement({ ref: 'e1', name: '上传附件', tag: 'input', type: 'file' })],
        { text: '已选择：申请书.docx' }
      )
    });
    const pickFile = vi.fn(async () => 'C:\\Users\\tester\\Downloads\\鲁港通生成文件\\申请书.docx');

    const result = await createExecutor(driver, { pickFile }).execute({
      action: 'upload',
      target: '上传附件'
    });

    expect(result.ok).toBe(true);
    expect(pickFile).toHaveBeenCalledTimes(1);
    expect(calls.setFiles).toEqual([
      ['e1', ['C:\\Users\\tester\\Downloads\\鲁港通生成文件\\申请书.docx']]
    ]);
    expect(result.file).toEqual({ name: '申请书.docx' });
    expect(JSON.stringify(result)).not.toContain('C:\\');
  });

  it('用户取消选文件时停止上传并说明', async () => {
    const page = makeSnapshot([
      makeElement({ ref: 'e1', name: '上传附件', tag: 'input', type: 'file' })
    ]);
    const { driver, calls } = createDriver(page);
    const result = await createExecutor(driver, {
      pickFile: async () => null
    }).execute({ action: 'upload', ref: 'e1' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('cancelled_by_user');
    expect(result.message).toContain('取消');
    expect(calls.setFiles).toHaveLength(0);
  });

  it('目标不是文件入口时拒绝上传', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '下一步', text: '下一步' })]),
      { fileInputState: { found: true, isFile: false } }
    );
    const pickFile = vi.fn(async () => 'C:\\x.docx');

    const result = await createExecutor(driver, { pickFile }).execute({
      action: 'upload',
      ref: 'e1'
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_file_input');
    expect(pickFile).not.toHaveBeenCalled();
    expect(calls.setFiles).toHaveLength(0);
  });

  it('文件没有附加到页面时返回上传失败', async () => {
    const page = makeSnapshot([
      makeElement({ ref: 'e1', name: '上传附件', tag: 'input', type: 'file' })
    ]);
    const { driver } = createDriver(page, {
      fileStateAfterSet: { found: true, isFile: true, count: 0, names: [] }
    });
    const result = await createExecutor(driver, {
      pickFile: async () => 'C:\\x.docx'
    }).execute({ action: 'upload', ref: 'e1' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('upload_failed');
    expect(result.message).toContain('手动');
  });

  it('提交类按钮经用户确认后才点击一次', async () => {
    const afterClick = makeSnapshot([], { text: '提交成功' });
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '提交申请', text: '提交申请' })]),
      { afterClick }
    );
    const confirm = vi.fn<AiConfirmer>(async () => 'allow');

    const result = await createExecutor(driver, { confirm }).execute({
      action: 'click',
      ref: 'e1'
    });

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'www.gov.hk', label: '提交申请' })
    );
    expect(calls.clickAt).toHaveLength(1);
    expect(result.ok).toBe(true);
    expect(result.confirmation).toEqual({
      required: true,
      decision: 'allow',
      label: '提交申请'
    });
  });

  it('用户选择自己提交时交还页面，不点击', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '提交申请', text: '提交申请' })])
    );
    const result = await createExecutor(driver, {
      confirm: async () => 'handoff'
    }).execute({ action: 'click', ref: 'e1' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('handed_over');
    expect(result.message).toContain('提交');
    expect(result.confirmation?.decision).toBe('handoff');
    expect(calls.clickAt).toHaveLength(0);
  });

  it('用户在确认框取消时绝不点击', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '发布文章', text: '发布文章' })])
    );
    const result = await createExecutor(driver, {
      confirm: async () => 'cancel'
    }).execute({ action: 'click', ref: 'e1' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('confirmation_declined');
    expect(result.confirmation?.decision).toBe('cancel');
    expect(calls.clickAt).toHaveLength(0);
  });

  it('确认超时按取消处理', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '删除记录', text: '删除记录' })])
    );
    const result = await createExecutor(driver, {
      confirm: async () => 'timeout'
    }).execute({ action: 'click', ref: 'e1' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('confirmation_timeout');
    expect(result.message).toContain('超时');
    expect(calls.clickAt).toHaveLength(0);
  });

  it('页面被关闭时按页面关闭处理确认，不点击也不当作主动取消', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '提交申请', text: '提交申请' })])
    );
    const result = await createExecutor(driver, {
      confirm: async () => 'page_closed'
    }).execute({ action: 'click', ref: 'e1' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('page_error');
    expect(result.message).toContain('页面被关闭');
    expect(result.message).toContain('没有提交');
    expect(result.confirmation?.decision).toBe('page_closed');
    expect(calls.clickAt).toHaveLength(0);
  });

  it('客户端无法弹出确认框时不直接提交', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '提交申请', text: '提交申请' })])
    );
    const result = await createExecutor(driver).execute({ action: 'click', ref: 'e1' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('confirmation_unavailable');
    expect(result.message).toContain('手动');
    expect(result.confirmation?.decision).toBe('unavailable');
    expect(calls.clickAt).toHaveLength(0);
  });

  it('支付类动作不弹确认框，直接硬拦截', async () => {
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '立即购买', text: '立即购买' })])
    );
    const confirm = vi.fn<AiConfirmer>(async () => 'allow');
    const result = await createExecutor(driver, { confirm }).execute({
      action: 'click',
      ref: 'e1'
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('high_risk_blocked');
    expect(confirm).not.toHaveBeenCalled();
    expect(calls.clickAt).toHaveLength(0);
  });

  it('普通按钮不弹确认框', async () => {
    const { driver } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '下一步', text: '下一步' })])
    );
    const confirm = vi.fn<AiConfirmer>(async () => 'allow');
    const result = await createExecutor(driver, { confirm }).execute({
      action: 'click',
      ref: 'e1'
    });

    expect(result.ok).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(result.confirmation).toBeUndefined();
  });

  it('确认通过但页面未显示成功结果时保留确认记录', async () => {
    const afterClick = makeSnapshot([], { text: '系统繁忙，请重试' });
    const { driver, calls } = createDriver(
      makeSnapshot([makeElement({ ref: 'e1', name: '提交申请', text: '提交申请' })]),
      { afterClick }
    );
    const result = await createExecutor(driver, {
      confirm: async () => 'allow'
    }).execute({ action: 'click', ref: 'e1', expect: '提交成功' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('verification_failed');
    expect(result.confirmation?.decision).toBe('allow');
    expect(calls.clickAt).toHaveLength(1);
  });
});
