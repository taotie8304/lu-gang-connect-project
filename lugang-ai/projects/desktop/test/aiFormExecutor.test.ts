import { describe, expect, it, vi } from 'vitest';
import {
  AiExecutor,
  type AiFileInputState,
  type AiFormConfirmer,
  type AiFormFiller,
  type AiFormOpener,
  type AiPageDriver
} from '../src/main/ai/executor';
import { FormFillError, FormParseError, type ParsedForm } from '../src/main/ai/form/types';
import type { AiPageSnapshot } from '../src/main/ai/snapshot';

const makeForm = (): ParsedForm => ({
  format: 'docx',
  name: '慈善组织申请表.docx',
  fields: [
    {
      id: 'f1',
      label: '申请人姓名',
      kind: 'text',
      locator: { type: 'docx-paragraph', paragraph: 1, labelEnd: 6 }
    },
    {
      id: 'f2',
      label: '联系电话',
      kind: 'text',
      locator: { type: 'docx-paragraph', paragraph: 2, labelEnd: 4 }
    },
    {
      id: 'f3',
      label: '登录密码',
      kind: 'text',
      locator: { type: 'docx-paragraph', paragraph: 3, labelEnd: 4 }
    }
  ],
  path: 'C:\\Users\\tester\\Desktop\\慈善组织申请表.docx'
});

const emptySnapshot: AiPageSnapshot = {
  url: 'about:blank',
  title: '',
  text: '',
  elements: [],
  scroll: { x: 0, y: 0, viewportWidth: 1280, viewportHeight: 720, pageHeight: 720 }
};

const emptyFileState: AiFileInputState = { found: false, isFile: false };

// 表单动作不接触页面，驱动只提供默认实现
const createDriver = (): AiPageDriver => ({
  snapshot: vi.fn(async () => emptySnapshot),
  resolve: vi.fn(async () => null),
  prepareInput: vi.fn(async () => ({ ok: false as const })),
  selectOption: vi.fn(async () => ({ ok: false as const, reason: 'not_found' as const })),
  scroll: vi.fn(async () => ({ before: emptySnapshot.scroll, after: emptySnapshot.scroll, changed: false })),
  clickAt: vi.fn(async () => undefined),
  insertText: vi.fn(async () => undefined),
  navigate: vi.fn(async () => undefined),
  fileInput: vi.fn(async () => emptyFileState),
  setFileInputFiles: vi.fn(async () => false),
  settle: vi.fn(async () => undefined)
});

const createFiller = (): AiFormFiller =>
  vi.fn(async ({ form, values }) => ({
    name: `${form.name.replace(/\.[^.]+$/, '')}-已填写.docx`,
    format: form.format,
    folder: '鲁港通生成文件',
    path: 'C:\\Users\\tester\\Downloads\\鲁港通生成文件\\慈善组织申请表-已填写.docx',
    filled: values.length,
    skipped: [],
    warnings: []
  }));

const createConfirmer = (decision: 'allow' | 'cancel' | 'timeout' | 'unavailable') => {
  const calls: unknown[] = [];
  const confirmer = (async (request: unknown) => {
    calls.push(request);
    return decision;
  }) as AiFormConfirmer;
  return { confirmer, calls };
};

const openFormAndGetToken = async (
  executor: AiExecutor,
  opener: AiFormOpener = async () => makeForm()
): Promise<string> => {
  const opened = await executor.execute({ action: 'open_form' });
  expect(opened.ok).toBe(true);
  expect(opened.formToken).toBeTruthy();
  return opened.formToken as string;
};

describe('表单动作：打开本机表单', () => {
  it('未接入本机选择器时提示升级，不尝试读取任何文件', async () => {
    const executor = new AiExecutor({ driver: createDriver() });
    const result = await executor.execute({ action: 'open_form' });

    expect(result).toMatchObject({ ok: false, code: 'unsupported_action' });
  });

  it('只返回表单结构与一次性 token，结果里不出现本机路径', async () => {
    const opener = vi.fn(async () => makeForm());
    const executor = new AiExecutor({ driver: createDriver(), openForm: opener });
    const result = await executor.execute({ action: 'open_form' });

    expect(result.ok).toBe(true);
    expect(result.form).toMatchObject({
      name: '慈善组织申请表.docx',
      format: 'docx',
      fields: [
        { id: 'f1', label: '申请人姓名', kind: 'text' },
        { id: 'f2', label: '联系电话', kind: 'text' },
        { id: 'f3', label: '登录密码', kind: 'text' }
      ]
    });
    expect(result.form).not.toHaveProperty('path');
    expect(result.form?.fields[0]).not.toHaveProperty('locator');
    expect(JSON.stringify(result)).not.toContain('C:\\\\Users');
  });

  it('选中的文件不可填写时透出可操作的中文说明', async () => {
    const executor = new AiExecutor({
      driver: createDriver(),
      openForm: async () => {
        throw new FormParseError(
          'form_not_fillable',
          '没有在 Word 里找到可填写的空白位置；请确认表格中的空白格或“标签：____”占位没有被内容替换。'
        );
      }
    });
    const result = await executor.execute({ action: 'open_form' });

    expect(result).toMatchObject({ ok: false, code: 'form_not_fillable' });
    expect(result.message).toContain('可填写的空白位置');
  });

  it('用户取消选择时按取消处理', async () => {
    const executor = new AiExecutor({ driver: createDriver(), openForm: async () => null });
    const result = await executor.execute({ action: 'open_form' });

    expect(result).toMatchObject({ ok: false, code: 'form_cancelled' });
  });

  it('只保留最近打开的三份表单，更早的 token 自动失效', async () => {
    let counter = 0;
    const executor = new AiExecutor({
      driver: createDriver(),
      fillForm: createFiller(),
      confirmForm: createConfirmer('allow').confirmer,
      openForm: async () => {
        counter += 1;
        return { ...makeForm(), name: `申请表-${counter}.docx` };
      }
    });

    const tokens: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const opened = await executor.execute({ action: 'open_form' });
      tokens.push(opened.formToken as string);
    }
    expect(new Set(tokens).size).toBe(4);

    const oldest = await executor.execute({
      action: 'fill_form',
      token: tokens[0],
      fields: [{ field: 'f1', value: '张三' }]
    });
    expect(oldest).toMatchObject({ ok: false, code: 'form_expired' });

    const newest = await executor.execute({
      action: 'fill_form',
      token: tokens[3],
      fields: [{ field: 'f1', value: '张三' }]
    });
    expect(newest.ok).toBe(true);
  });
});

describe('表单动作：填写前确认与生成副本', () => {
  it('token 失效时要求重新读取表单', async () => {
    const executor = new AiExecutor({ driver: createDriver() });
    const result = await executor.execute({
      action: 'fill_form',
      token: 'missing-token',
      fields: [{ field: 'f1', value: '张三' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'form_expired' });
  });

  it('写盘前展示字段清单，敏感字段不进入确认清单', async () => {
    const { confirmer, calls } = createConfirmer('allow');
    const filler = createFiller();
    const executor = new AiExecutor({
      driver: createDriver(),
      openForm: async () => makeForm(),
      fillForm: filler,
      confirmForm: confirmer
    });
    const token = await openFormAndGetToken(executor);

    const result = await executor.execute({
      action: 'fill_form',
      token,
      fields: [
        { field: 'f1', value: '张三' },
        { field: 'f2', value: '13800000000' },
        { field: 'f3', value: 'secret123' }
      ]
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      fileName: '慈善组织申请表.docx',
      format: 'docx',
      total: 2,
      items: [
        { label: '申请人姓名', value: '张三' },
        { label: '联系电话', value: '13800000000' }
      ]
    });
    expect(JSON.stringify(calls[0])).not.toContain('secret123');
    expect(filler).toHaveBeenCalledWith({
      form: expect.objectContaining({ name: '慈善组织申请表.docx' }),
      values: [
        { id: 'f1', value: '张三' },
        { id: 'f2', value: '13800000000' }
      ]
    });
    expect(result).toMatchObject({
      ok: true,
      file: { name: '慈善组织申请表-已填写.docx', format: 'docx', folder: '鲁港通生成文件' },
      fill: { filled: 2 }
    });
    expect(result.fill?.skipped?.[0]).toContain('登录密码');
    expect(JSON.stringify(result)).not.toContain('鲁港通生成文件\\\\慈善组织申请表');
  });

  it('全部字段都是敏感信息时直接拒绝，不弹确认也不写盘', async () => {
    const { confirmer } = createConfirmer('allow');
    const filler = createFiller();
    const executor = new AiExecutor({
      driver: createDriver(),
      openForm: async () => makeForm(),
      fillForm: filler,
      confirmForm: confirmer
    });
    const token = await openFormAndGetToken(executor);

    const result = await executor.execute({
      action: 'fill_form',
      token,
      fields: [{ field: 'f3', value: 'secret123' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'form_field_blocked' });
    expect(filler).not.toHaveBeenCalled();
  });

  it('字段都对不上时提示重新读取表单', async () => {
    const executor = new AiExecutor({
      driver: createDriver(),
      openForm: async () => makeForm(),
      fillForm: createFiller(),
      confirmForm: createConfirmer('allow').confirmer
    });
    const token = await openFormAndGetToken(executor);

    const result = await executor.execute({
      action: 'fill_form',
      token,
      fields: [{ field: 'f99', value: '张三' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'form_field_not_found' });
  });

  it('没有确认窗时不写盘', async () => {
    const filler = createFiller();
    const executor = new AiExecutor({
      driver: createDriver(),
      openForm: async () => makeForm(),
      fillForm: filler
    });
    const token = await openFormAndGetToken(executor);

    const result = await executor.execute({
      action: 'fill_form',
      token,
      fields: [{ field: 'f1', value: '张三' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'confirmation_unavailable' });
    expect(filler).not.toHaveBeenCalled();
  });

  it('用户取消确认时生成零文件', async () => {
    const filler = createFiller();
    const executor = new AiExecutor({
      driver: createDriver(),
      openForm: async () => makeForm(),
      fillForm: filler,
      confirmForm: createConfirmer('cancel').confirmer
    });
    const token = await openFormAndGetToken(executor);

    const result = await executor.execute({
      action: 'fill_form',
      token,
      fields: [{ field: 'f1', value: '张三' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'confirmation_declined' });
    expect(result.message).toContain('没有生成任何文件');
    expect(filler).not.toHaveBeenCalled();
  });

  it('确认超时按取消处理', async () => {
    const filler = createFiller();
    const executor = new AiExecutor({
      driver: createDriver(),
      openForm: async () => makeForm(),
      fillForm: filler,
      confirmForm: createConfirmer('timeout').confirmer
    });
    const token = await openFormAndGetToken(executor);

    const result = await executor.execute({
      action: 'fill_form',
      token,
      fields: [{ field: 'f1', value: '张三' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'confirmation_timeout' });
    expect(filler).not.toHaveBeenCalled();
  });

  it('生成成功后 token 失效，避免重复写盘', async () => {
    const executor = new AiExecutor({
      driver: createDriver(),
      openForm: async () => makeForm(),
      fillForm: createFiller(),
      confirmForm: createConfirmer('allow').confirmer
    });
    const token = await openFormAndGetToken(executor);

    const first = await executor.execute({
      action: 'fill_form',
      token,
      fields: [{ field: 'f1', value: '张三' }]
    });
    expect(first.ok).toBe(true);

    const second = await executor.execute({
      action: 'fill_form',
      token,
      fields: [{ field: 'f1', value: '李四' }]
    });
    expect(second).toMatchObject({ ok: false, code: 'form_expired' });
  });

  it('缺少中文字体时给出可操作提示', async () => {
    const executor = new AiExecutor({
      driver: createDriver(),
      openForm: async () => ({ ...makeForm(), format: 'pdf', name: '申请表.pdf' }),
      fillForm: async () => {
        throw new FormFillError(
          'pdf_font_missing',
          '这台电脑上找不到可用的中文字体，无法在 PDF 里写入中文；请改用 Word 或 Excel 表单。'
        );
      },
      confirmForm: createConfirmer('allow').confirmer
    });
    const token = await openFormAndGetToken(executor);

    const result = await executor.execute({
      action: 'fill_form',
      token,
      fields: [{ field: 'f1', value: '张三' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'pdf_font_missing' });
    expect(result.message).toContain('中文字体');
  });
});

describe('表单动作：优先读取右栏已打开的文件', () => {
  it('右栏是可填写 PDF 时直接按该文件读取，不再弹选择窗口', async () => {
    const opener = vi.fn(async () => makeForm());
    const openFormAtPath = vi.fn(async () => makeForm());
    const executor = new AiExecutor({
      driver: createDriver(),
      openForm: opener,
      openFormAtPath,
      readActiveDocument: () => ({
        format: 'pdf',
        fileName: '慈善组织申请表.pdf',
        path: 'C:\\Users\\tester\\Desktop\\慈善组织申请表.pdf'
      })
    });

    const result = await executor.execute({ action: 'open_form' });

    expect(openFormAtPath).toHaveBeenCalledWith('C:\\Users\\tester\\Desktop\\慈善组织申请表.pdf');
    expect(opener).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.formToken).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain('C:\\\\Users');
  });

  it('右栏是 Excel 时同样直接读取', async () => {
    const opener = vi.fn(async () => makeForm());
    const openFormAtPath = vi.fn(async () => ({ ...makeForm(), format: 'xlsx' as const }));
    const executor = new AiExecutor({
      driver: createDriver(),
      openForm: opener,
      openFormAtPath,
      readActiveDocument: () => ({
        format: 'xlsx',
        fileName: '预算表.xlsx',
        document: {
          format: 'xlsx',
          name: '预算表.xlsx',
          path: 'C:\\Users\\tester\\Desktop\\预算表.xlsx'
        }
      })
    });

    const result = await executor.execute({ action: 'open_form' });

    expect(openFormAtPath).toHaveBeenCalledWith('C:\\Users\\tester\\Desktop\\预算表.xlsx');
    expect(opener).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('右栏文件不是可填写表单时直接说明原因，不再弹选择窗口', async () => {
    const opener = vi.fn(async () => makeForm());
    const openFormAtPath = vi.fn(async () => {
      throw new FormParseError(
        'form_not_fillable',
        '这个 PDF 没有可填写的表单域，可能是扫描件或普通 PDF；请选择可填写（带输入框）的 PDF。'
      );
    });
    const executor = new AiExecutor({
      driver: createDriver(),
      openForm: opener,
      openFormAtPath,
      readActiveDocument: () => ({
        format: 'pdf',
        fileName: '出行人员信息收集.pdf',
        path: 'C:\\Users\\tester\\Desktop\\出行人员信息收集.pdf'
      })
    });

    const result = await executor.execute({ action: 'open_form' });

    expect(openFormAtPath).toHaveBeenCalledTimes(1);
    expect(opener).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, code: 'form_not_fillable' });
    expect(result.message).toContain('出行人员信息收集.pdf');
  });

  it('右栏没有打开文件时仍走选择窗口', async () => {
    const opener = vi.fn(async () => makeForm());
    const openFormAtPath = vi.fn(async () => makeForm());
    const executor = new AiExecutor({
      driver: createDriver(),
      openForm: opener,
      openFormAtPath,
      readActiveDocument: () => undefined
    });

    const result = await executor.execute({ action: 'open_form' });

    expect(openFormAtPath).not.toHaveBeenCalled();
    expect(opener).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });
});
