import { describe, expect, it, vi } from 'vitest';
import {
  AiExecutor,
  type AiActiveDocument,
  type AiDocumentConfirmer,
  type AiDocumentEditor,
  type AiDocumentPreviewer,
  type AiFileInputState,
  type AiPageDriver
} from '../src/main/ai/executor';
import {
  DocumentParseError,
  type ParsedDocument
} from '../src/main/ai/document/types';
import { DocumentEditError } from '../src/main/ai/document/editTypes';
import type { AiPageSnapshot } from '../src/main/ai/snapshot';

const makeDocument = (): ParsedDocument => ({
  format: 'docx',
  name: '2024年工作计划.docx',
  paragraphs: [
    { index: 0, text: '2024年工作计划', style: 'Heading1' },
    { index: 1, text: '目标：2023年完成一期建设。' },
    { index: 2, text: '预算：100 万元。' }
  ],
  path: 'C:\\Users\\tester\\Desktop\\2024年工作计划.docx'
});

const emptySnapshot: AiPageSnapshot = {
  url: 'about:blank',
  title: '',
  text: '',
  elements: [],
  scroll: { x: 0, y: 0, viewportWidth: 1280, viewportHeight: 720, pageHeight: 720 }
};

const emptyFileState: AiFileInputState = { found: false, isFile: false };

const createDriver = (): AiPageDriver => ({
  snapshot: vi.fn(async () => emptySnapshot),
  resolve: vi.fn(async () => null),
  prepareInput: vi.fn(async () => ({ ok: false as const })),
  selectOption: vi.fn(async () => ({ ok: false as const, reason: 'not_found' as const })),
  scroll: vi.fn(async () => ({
    before: emptySnapshot.scroll,
    after: emptySnapshot.scroll,
    changed: false
  })),
  clickAt: vi.fn(async () => undefined),
  insertText: vi.fn(async () => undefined),
  navigate: vi.fn(async () => undefined),
  fileInput: vi.fn(async () => emptyFileState),
  setFileInputFiles: vi.fn(async () => false),
  settle: vi.fn(async () => undefined)
});

const createEditor = (): AiDocumentEditor =>
  vi.fn(async ({ document, operations }) => ({
    name: `${document.name.replace(/\.[^.]+$/, '')}-已修改.docx`,
    format: document.format,
    folder: '鲁港通生成文件',
    path: 'C:\\Users\\tester\\Downloads\\鲁港通生成文件\\2024年工作计划-已修改.docx',
    applied: operations.length,
    skipped: [],
    warnings: []
  }));

const createConfirmer = (decision: 'allow' | 'cancel' | 'timeout' | 'unavailable') => {
  const calls: unknown[] = [];
  const confirmer = (async (request: unknown) => {
    calls.push(request);
    return decision;
  }) as AiDocumentConfirmer;
  return { confirmer, calls };
};

const openDocumentAndGetToken = async (
  executor: AiExecutor
): Promise<string> => {
  const opened = await executor.execute({ action: 'open_document' });
  expect(opened.ok).toBe(true);
  expect(opened.documentToken).toBeTruthy();
  return opened.documentToken as string;
};

describe('文档动作：打开本机文档提纲', () => {
  it('未接入本机选择器时提示升级，不尝试读取任何文件', async () => {
    const executor = new AiExecutor({ driver: createDriver() });
    const result = await executor.execute({ action: 'open_document' });

    expect(result).toMatchObject({ ok: false, code: 'unsupported_action' });
  });

  it('只返回提纲与一次性 token，结果里不出现本机路径', async () => {
    const opener = vi.fn(async () => makeDocument());
    const executor = new AiExecutor({ driver: createDriver(), openDocument: opener });
    const result = await executor.execute({ action: 'open_document' });

    expect(result.ok).toBe(true);
    expect(result.document).toMatchObject({
      name: '2024年工作计划.docx',
      format: 'docx',
      paragraphs: [
        { index: 0, text: '2024年工作计划', style: 'Heading1' },
        { index: 1, text: '目标：2023年完成一期建设。' },
        { index: 2, text: '预算：100 万元。' }
      ]
    });
    expect(result.document).not.toHaveProperty('path');
    expect(JSON.stringify(result)).not.toContain('C:\\\\Users');
  });

  it('文件读不出来时透出可操作的中文说明', async () => {
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => {
        throw new DocumentParseError(
          'unsupported_format',
          '目前只能修改 .docx 或 .xlsx 文件；如果是老版 .doc 或 .xls，请先用 Office 另存为新格式再选一次。'
        );
      }
    });
    const result = await executor.execute({ action: 'open_document' });

    expect(result).toMatchObject({ ok: false, code: 'document_open_failed' });
    expect(result.message).toContain('.docx');
  });

  it('用户取消选择时按取消处理', async () => {
    const executor = new AiExecutor({ driver: createDriver(), openDocument: async () => null });
    const result = await executor.execute({ action: 'open_document' });

    expect(result).toMatchObject({ ok: false, code: 'document_cancelled' });
  });

  it('只保留最近打开的三份文档，更早的 token 自动失效', async () => {
    let counter = 0;
    const executor = new AiExecutor({
      driver: createDriver(),
      editDocument: createEditor(),
      confirmDocument: createConfirmer('allow').confirmer,
      openDocument: async () => {
        counter += 1;
        return { ...makeDocument(), name: `计划-${counter}.docx` };
      }
    });

    const tokens: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const opened = await executor.execute({ action: 'open_document' });
      tokens.push(opened.documentToken as string);
    }
    expect(new Set(tokens).size).toBe(4);

    const oldest = await executor.execute({
      action: 'edit_document',
      token: tokens[0],
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });
    expect(oldest).toMatchObject({ ok: false, code: 'document_expired' });

    const newest = await executor.execute({
      action: 'edit_document',
      token: tokens[3],
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });
    expect(newest.ok).toBe(true);
  });
});

describe('文档动作：读取右栏已打开的文件', () => {
  const activeDocx = (): AiActiveDocument => ({
    format: 'docx',
    fileName: '2024年工作计划.docx',
    document: makeDocument()
  });

  it('右栏打开 Word 时读取返回文档提纲与可继续修改的引用', async () => {
    const driver = createDriver();
    const executor = new AiExecutor({
      driver,
      readActiveDocument: () => activeDocx(),
      editDocument: createEditor(),
      confirmDocument: createConfirmer('allow').confirmer
    });

    const read = await executor.execute({ action: 'read' });

    expect(read.ok).toBe(true);
    expect(read.document).toMatchObject({
      format: 'docx',
      name: '2024年工作计划.docx'
    });
    expect(read.document?.paragraphs?.[1]).toMatchObject({
      index: 1,
      text: '目标：2023年完成一期建设。'
    });
    expect(read.documentToken).toBeTruthy();
    expect(read.snapshot).toBeUndefined();
    expect(driver.snapshot).not.toHaveBeenCalled();
    expect(JSON.stringify(read)).not.toContain('C:\\\\Users');

    const edit = await executor.execute({
      action: 'edit_document',
      token: read.documentToken as string,
      operations: [{ op: 'append_paragraph', text: '补充说明。' }]
    });
    expect(edit.ok).toBe(true);
  });

  it('右栏打开 Excel 时读取返回工作表结构', async () => {
    const xlsxDocument: ParsedDocument = {
      format: 'xlsx',
      name: '预算表.xlsx',
      path: 'C:\\Users\\tester\\Desktop\\预算表.xlsx',
      sheets: [
        {
          name: '预算表',
          rowCount: 2,
          columnCount: 2,
          header: ['项目', '金额'],
          sampleRows: [['预算', '100']]
        }
      ]
    };
    const executor = new AiExecutor({
      driver: createDriver(),
      readActiveDocument: () => ({
        format: 'xlsx',
        fileName: '预算表.xlsx',
        document: xlsxDocument
      })
    });

    const read = await executor.execute({ action: 'read' });

    expect(read.ok).toBe(true);
    expect(read.document).toMatchObject({ format: 'xlsx', name: '预算表.xlsx' });
    expect(read.document?.sheets?.[0]).toMatchObject({ name: '预算表' });
    expect(read.documentToken).toBeTruthy();
  });

  it('右栏打开 PDF 时只返回文件名，不提供修改引用', async () => {
    const driver = createDriver();
    const executor = new AiExecutor({
      driver,
      readActiveDocument: () => ({ format: 'pdf', fileName: '申请须知.pdf' })
    });

    const read = await executor.execute({ action: 'read' });

    expect(read.ok).toBe(true);
    expect(read.document).toEqual({ format: 'pdf', name: '申请须知.pdf' });
    expect(read.documentToken).toBeUndefined();
    expect(driver.snapshot).not.toHaveBeenCalled();
  });

  it('右栏没有打开文件时回退读取网页', async () => {
    const driver = createDriver();
    (driver.snapshot as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...emptySnapshot,
      url: 'https://www.gov.hk/sc/home/index.html',
      title: '香港政府一站通'
    });
    const executor = new AiExecutor({ driver, readActiveDocument: () => undefined });

    const read = await executor.execute({ action: 'read' });

    expect(read.ok).toBe(true);
    expect(read.document).toBeUndefined();
    expect(read.snapshot?.title).toBe('香港政府一站通');
    expect(driver.snapshot).toHaveBeenCalledTimes(1);
  });
});

describe('文档动作：修改前确认与生成副本', () => {
  it('token 失效时要求重新打开文档', async () => {
    const executor = new AiExecutor({ driver: createDriver() });
    const result = await executor.execute({
      action: 'edit_document',
      token: 'missing-token',
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'document_expired' });
  });

  it('写盘前展示改动清单，确认请求不出现本机路径', async () => {
    const { confirmer, calls } = createConfirmer('allow');
    const editor = createEditor();
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: editor,
      confirmDocument: confirmer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [
        { op: 'replace_text', find: '2023年', replace: '2024年', paragraph: 1 },
        { op: 'append_paragraph', text: '备注：待补充。' }
      ]
    });

    expect(calls).toHaveLength(1);
    const request = calls[0] as Record<string, unknown>;
    expect(request).toMatchObject({
      fileName: '2024年工作计划.docx',
      format: 'docx',
      total: 2
    });
    expect(request.items).toEqual([
      { target: '第 2 段', before: '2023年', after: '2024年' },
      { target: '文末', after: '备注：待补充。' }
    ]);
    expect(JSON.stringify(calls[0])).not.toContain('C:\\\\Users');
    expect(editor).toHaveBeenCalledWith({
      document: expect.objectContaining({ name: '2024年工作计划.docx' }),
      operations: [
        { op: 'replace_text', find: '2023年', replace: '2024年', paragraph: 1 },
        { op: 'append_paragraph', text: '备注：待补充。' }
      ]
    });
    expect(result).toMatchObject({
      ok: true,
      file: { name: '2024年工作计划-已修改.docx', format: 'docx', folder: '鲁港通生成文件' },
      edit: { applied: 2 }
    });
    expect(JSON.stringify(result)).not.toContain('Downloads');
  });

  it('文档自身的风险提示随确认请求一起展示', async () => {
    const { confirmer, calls } = createConfirmer('allow');
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => ({
        format: 'xlsx',
        name: '预算表.xlsx',
        sheets: [{ name: '总表', rowCount: 10, columnCount: 5, header: ['项目', '金额'], sampleRows: [] }],
        warnings: ['文件含图表，生成的副本可能丢失图表，请保留原件并核对副本。'],
        path: 'C:\\Users\\tester\\Desktop\\预算表.xlsx'
      }),
      editDocument: createEditor(),
      confirmDocument: confirmer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'set_cell', sheet: '总表', cell: 'B2', value: '5000' }]
    });

    expect(result.ok).toBe(true);
    const request = calls[0] as Record<string, unknown>;
    expect(request.warnings).toEqual([
      '文件含图表，生成的副本可能丢失图表，请保留原件并核对副本。'
    ]);
    expect(request.items).toEqual([
      { target: '工作表「总表」B2', before: undefined, after: '5000' }
    ]);
  });

  it('没有确认窗时不写盘', async () => {
    const editor = createEditor();
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: editor
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'confirmation_unavailable' });
    expect(editor).not.toHaveBeenCalled();
  });

  it('用户取消确认时生成零副本', async () => {
    const editor = createEditor();
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: editor,
      confirmDocument: createConfirmer('cancel').confirmer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'confirmation_declined' });
    expect(result.message).toContain('没有生成任何副本');
    expect(editor).not.toHaveBeenCalled();
  });

  it('确认超时按取消处理', async () => {
    const editor = createEditor();
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: editor,
      confirmDocument: createConfirmer('timeout').confirmer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'confirmation_timeout' });
    expect(editor).not.toHaveBeenCalled();
  });

  it('生成成功后 token 失效，避免重复生成副本', async () => {
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: createEditor(),
      confirmDocument: createConfirmer('allow').confirmer
    });
    const token = await openDocumentAndGetToken(executor);

    const first = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });
    expect(first.ok).toBe(true);

    const second = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：又补充。' }]
    });
    expect(second).toMatchObject({ ok: false, code: 'document_expired' });
  });

  it('没有匹配内容时透出可操作提示，不生成副本', async () => {
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: async () => {
        throw new DocumentEditError(
          'document_no_change',
          '没有找到与要求匹配的内容，未生成副本。请核对段落或文字后重试。'
        );
      },
      confirmDocument: createConfirmer('allow').confirmer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'replace_text', find: '不存在的内容', replace: '新内容' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'document_no_change' });
    expect(result.message).toContain('未生成副本');
  });

  it('副本生成失败时给出兜底说明', async () => {
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: async () => {
        throw new Error('disk full');
      },
      confirmDocument: createConfirmer('allow').confirmer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'document_edit_failed' });
    expect(result.message).toContain('请手动修改原文档');
  });

  it('停止时取消等待中的修改确认', async () => {
    const { confirmer } = createConfirmer('cancel');
    const cancel = vi.fn();
    confirmer.cancel = cancel;
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: createEditor(),
      confirmDocument: confirmer
    });

    executor.cancelDocumentConfirmation();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe('文档动作：右栏预览优先', () => {
  const createPreviewer = (
    outcome: Awaited<ReturnType<AiDocumentPreviewer>>
  ): { previewer: AiDocumentPreviewer; calls: unknown[] } => {
    const calls: unknown[] = [];
    const previewer = (async (input: unknown) => {
      calls.push(input);
      return outcome;
    }) as AiDocumentPreviewer;
    return { previewer, calls };
  };

  it('右栏全部应用后直接返回副本，不再弹旧确认窗', async () => {
    const { confirmer, calls: confirmCalls } = createConfirmer('allow');
    const editor = createEditor();
    const { previewer, calls } = createPreviewer({
      status: 'done',
      copy: {
        name: '2024年工作计划-已修改.docx',
        format: 'docx',
        folder: '鲁港通生成文件',
        path: 'C:\\Users\\tester\\Downloads\\鲁港通生成文件\\2024年工作计划-已修改.docx',
        applied: 2,
        skipped: [],
        warnings: []
      }
    });
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: editor,
      confirmDocument: confirmer,
      previewDocument: previewer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [
        { op: 'replace_text', find: '2023年', replace: '2024年', paragraph: 1 },
        { op: 'append_paragraph', text: '备注：待补充。' }
      ]
    });

    expect(calls).toHaveLength(1);
    expect(editor).not.toHaveBeenCalled();
    expect(confirmCalls).toHaveLength(0);
    expect(result).toMatchObject({
      ok: true,
      file: { name: '2024年工作计划-已修改.docx', folder: '鲁港通生成文件' },
      edit: { applied: 2 }
    });
    expect(JSON.stringify(result)).not.toContain('Downloads');
  });

  it('全部跳过时不生成副本，按取消处理', async () => {
    const editor = createEditor();
    const { previewer } = createPreviewer({ status: 'no_change' });
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: editor,
      confirmDocument: createConfirmer('allow').confirmer,
      previewDocument: previewer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'confirmation_declined' });
    expect(result.message).toContain('都跳过了');
    expect(editor).not.toHaveBeenCalled();
  });

  it('关闭预览标签按取消处理', async () => {
    const editor = createEditor();
    const { previewer } = createPreviewer({ status: 'declined' });
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: editor,
      confirmDocument: createConfirmer('allow').confirmer,
      previewDocument: previewer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'confirmation_declined' });
    expect(editor).not.toHaveBeenCalled();
  });

  it('预览超时按确认超时处理', async () => {
    const { previewer } = createPreviewer({ status: 'timeout' });
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: createEditor(),
      confirmDocument: createConfirmer('allow').confirmer,
      previewDocument: previewer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'confirmation_timeout' });
  });

  it('副本生成失败时透出预览层给出的说明', async () => {
    const { previewer } = createPreviewer({
      status: 'failed',
      message: '副本没有生成成功，没有写入任何内容，原文件不受影响。请重试一次。'
    });
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: createEditor(),
      confirmDocument: createConfirmer('allow').confirmer,
      previewDocument: previewer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'document_edit_failed' });
    expect(result.message).toContain('原文件不受影响');
  });

  it('右栏未挂载时回退原确认窗，照常生成副本', async () => {
    const { confirmer, calls: confirmCalls } = createConfirmer('allow');
    const editor = createEditor();
    const { previewer } = createPreviewer({ status: 'unavailable' });
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: editor,
      confirmDocument: confirmer,
      previewDocument: previewer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(confirmCalls).toHaveLength(1);
    expect(editor).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: true, edit: { applied: 1 } });
  });

  it('预览通道自身抛错时同样回退原确认窗', async () => {
    const { confirmer, calls: confirmCalls } = createConfirmer('allow');
    const editor = createEditor();
    const previewer = (async () => {
      throw new Error('preview crashed');
    }) as AiDocumentPreviewer;
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      editDocument: editor,
      confirmDocument: confirmer,
      previewDocument: previewer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(confirmCalls).toHaveLength(1);
    expect(result.ok).toBe(true);
  });

  it('Excel 仍走原确认窗，不进入 Word 预览', async () => {
    const { previewer, calls } = createPreviewer({ status: 'declined' });
    const { confirmer, calls: confirmCalls } = createConfirmer('allow');
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => ({
        format: 'xlsx',
        name: '预算表.xlsx',
        sheets: [{ name: '总表', rowCount: 10, columnCount: 5, header: ['项目', '金额'], sampleRows: [] }],
        path: 'C:\\Users\\tester\\Desktop\\预算表.xlsx'
      }),
      editDocument: createEditor(),
      confirmDocument: confirmer,
      previewDocument: previewer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'set_cell', sheet: '总表', cell: 'B2', value: '5000' }]
    });

    expect(calls).toHaveLength(0);
    expect(confirmCalls).toHaveLength(1);
    expect(result.ok).toBe(true);
  });

  it('停止时同时取消等待中的预览会话', () => {
    const cancel = vi.fn();
    const previewer = Object.assign(
      (async () => ({ status: 'declined' as const })) as AiDocumentPreviewer,
      { cancel }
    );
    const executor = new AiExecutor({ driver: createDriver(), previewDocument: previewer });

    executor.cancelDocumentConfirmation();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});