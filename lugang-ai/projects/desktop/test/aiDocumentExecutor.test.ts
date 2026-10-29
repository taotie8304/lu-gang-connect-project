import { describe, expect, it, vi } from 'vitest';
import {
  AiExecutor,
  type AiActiveDocument,
  type AiDocumentPreviewer,
  type AiDocumentPreviewOutcome,
  type AiFileInputState,
  type AiPageDriver
} from '../src/main/ai/executor';
import {
  DocumentParseError,
  type ParsedDocument
} from '../src/main/ai/document/types';
import type { EditedDocumentCopy } from '../src/main/ai/document/editTypes';
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

const doneCopy = (overrides: Partial<EditedDocumentCopy> = {}): EditedDocumentCopy => ({
  name: '2024年工作计划-已修改.docx',
  format: 'docx',
  folder: '鲁港通生成文件',
  path: 'C:\\Users\\tester\\Downloads\\鲁港通生成文件\\2024年工作计划-已修改.docx',
  applied: 1,
  skipped: [],
  warnings: [],
  ...overrides
});

const createDonePreviewer = (
  copy: EditedDocumentCopy = doneCopy()
): { previewer: AiDocumentPreviewer; calls: unknown[] } =>
  createPreviewer({ status: 'done', copy });

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
      previewDocument: createDonePreviewer().previewer,
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
      previewDocument: createDonePreviewer().previewer
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
      readActiveDocument: () => ({
        format: 'pdf',
        fileName: '申请须知.pdf',
        path: 'C:\\Users\\tester\\Desktop\\申请须知.pdf'
      })
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

describe('文档动作：修改只能走右栏源文件预览', () => {
  it('token 失效时要求重新打开文档', async () => {
    const executor = new AiExecutor({ driver: createDriver() });
    const result = await executor.execute({
      action: 'edit_document',
      token: 'missing-token',
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'document_expired' });
  });

  it('没有接入右栏预览时明确报错，提示升级客户端', async () => {
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument()
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'document_preview_unavailable' });
    expect(result.message).toContain('右栏');
  });

  it('右栏没有认领时明确报错，不生成副本，也不改走文字清单', async () => {
    const { previewer, calls } = createPreviewer({ status: 'unavailable' });
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      previewDocument: previewer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ ok: false, code: 'document_preview_unavailable' });
    expect(result.message).toContain('右栏');
  });

  it('预览通道抛错时同样明确报错，不写盘', async () => {
    const previewer = (async () => {
      throw new Error('preview crashed');
    }) as AiDocumentPreviewer;
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      previewDocument: previewer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'document_preview_unavailable' });
  });

  it('文档自身的风险提示随预览请求一起交给右栏展示', async () => {
    const { previewer, calls } = createDonePreviewer(
      doneCopy({ name: '预算表-已修改.xlsx', format: 'xlsx' })
    );
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => ({
        format: 'xlsx',
        name: '预算表.xlsx',
        sheets: [{ name: '总表', rowCount: 10, columnCount: 5, header: ['项目', '金额'], sampleRows: [] }],
        warnings: ['文件含图表，生成的副本可能丢失图表，请保留原件并核对副本。'],
        path: 'C:\\Users\\tester\\Desktop\\预算表.xlsx'
      }),
      previewDocument: previewer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'set_cell', sheet: '总表', cell: 'B2', value: '5000' }]
    });

    expect((calls[0] as { document: ParsedDocument }).document.warnings).toEqual([
      '文件含图表，生成的副本可能丢失图表，请保留原件并核对副本。'
    ]);
    expect(result).toMatchObject({ ok: true, edit: { applied: 1 } });
  });

  it('生成成功后 token 失效，避免重复生成副本', async () => {
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      previewDocument: createDonePreviewer().previewer
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

  it('停止时取消等待中的修改确认', async () => {
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

describe('文档动作：右栏预览优先', () => {
  it('右栏全部应用后直接返回副本', async () => {
    const { previewer, calls } = createDonePreviewer(
      doneCopy({ applied: 2 })
    );
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
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
    expect(result).toMatchObject({
      ok: true,
      file: { name: '2024年工作计划-已修改.docx', folder: '鲁港通生成文件' },
      edit: { applied: 2 }
    });
    expect(JSON.stringify(result)).not.toContain('Downloads');
  });

  it('全部跳过时不生成副本，按取消处理', async () => {
    const { previewer } = createPreviewer({ status: 'no_change' });
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
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
  });

  it('关闭预览标签按取消处理', async () => {
    const { previewer } = createPreviewer({ status: 'declined' });
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      previewDocument: previewer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'confirmation_declined' });
  });

  it('预览超时按确认超时处理', async () => {
    const { previewer } = createPreviewer({ status: 'timeout' });
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
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

  it('Excel 也走右栏预览：全部应用后直接生成副本', async () => {
    const { previewer, calls } = createPreviewer({
      status: 'done',
      copy: {
        name: '预算表-已修改.xlsx',
        format: 'xlsx',
        folder: '鲁港通生成文件',
        path: 'C:\\Users\\tester\\Downloads\\鲁港通生成文件\\预算表-已修改.xlsx',
        applied: 1,
        skipped: [],
        warnings: []
      }
    });
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => ({
        format: 'xlsx',
        name: '预算表.xlsx',
        sheets: [{ name: '总表', rowCount: 10, columnCount: 5, header: ['项目', '金额'], sampleRows: [] }],
        path: 'C:\\Users\\tester\\Desktop\\预算表.xlsx'
      }),
      previewDocument: previewer
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'set_cell', sheet: '总表', cell: 'B2', value: '5000' }]
    });

    expect(calls).toHaveLength(1);
    expect((calls[0] as { document: ParsedDocument }).document.format).toBe('xlsx');
    expect(result).toMatchObject({
      ok: true,
      file: { name: '预算表-已修改.xlsx', format: 'xlsx' },
      edit: { applied: 1 }
    });
  });
});
describe('文档动作：改完可继续改，不再重复弹选择窗口', () => {
  it('修改成功后回传副本的新 token，接着改直接用新 token', async () => {
    const picker = vi.fn(async () => makeDocument());
    const reloadDocument = vi.fn(async (path: string): Promise<ParsedDocument> => ({
      ...makeDocument(),
      name: '2024年工作计划-已修改.docx',
      path
    }));
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: picker,
      previewDocument: createDonePreviewer().previewer,
      reloadDocument
    });
    const token = await openDocumentAndGetToken(executor);

    const first = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(first.ok).toBe(true);
    expect(first.document).toMatchObject({ name: '2024年工作计划-已修改.docx' });
    expect(first.documentToken).toBeTruthy();
    expect(reloadDocument).toHaveBeenCalledTimes(1);
    expect(reloadDocument.mock.calls[0][0]).toContain('2024年工作计划-已修改.docx');
    expect(JSON.stringify(first)).not.toContain('Downloads');

    const second = await executor.execute({
      action: 'edit_document',
      token: first.documentToken as string,
      operations: [{ op: 'append_paragraph', text: '再补充一行。' }]
    });

    expect(second.ok).toBe(true);
    // 整个过程只在最开始选择过一次文件，中途没有再弹选择窗口
    expect(picker).toHaveBeenCalledTimes(1);
  });

  it('副本重新解析失败时仍按成功回执，只是不发新 token', async () => {
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: async () => makeDocument(),
      previewDocument: createDonePreviewer().previewer,
      reloadDocument: async () => {
        throw new DocumentParseError('document_parse_failed', '无法读取这个文件。');
      }
    });
    const token = await openDocumentAndGetToken(executor);

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注：待补充。' }]
    });

    expect(result.ok).toBe(true);
    expect(result.documentToken).toBeUndefined();
  });

  it('右栏已打开 Word 时 open_document 直接使用右栏文件，不弹选择窗口', async () => {
    const picker = vi.fn(async () => makeDocument());
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: picker,
      readActiveDocument: () => ({
        format: 'docx',
        fileName: '2024年工作计划.docx',
        document: makeDocument()
      })
    });

    const result = await executor.execute({ action: 'open_document' });

    expect(result.ok).toBe(true);
    expect(result.documentToken).toBeTruthy();
    expect(result.document?.name).toBe('2024年工作计划.docx');
    expect(picker).not.toHaveBeenCalled();
  });
});

describe('PDF：原样副本叠加内容', () => {
  const activePdf = () => ({
    format: 'pdf' as const,
    fileName: '慈善组织申请表.pdf',
    path: 'C:\\Users\\tester\\Desktop\\慈善组织申请表.pdf'
  });

  const createPdfPreviewer = (
    outcome: AiDocumentPreviewOutcome
  ): {
    previewer: AiDocumentPreviewer;
    calls: Array<{ path: string; fileName: string; entries: unknown[] }>;
  } => {
    const calls: Array<{ path: string; fileName: string; entries: unknown[] }> = [];
    const base = (async () => ({ status: 'unavailable' as const })) as AiDocumentPreviewer;
    base.previewPdf = async (input) => {
      calls.push(input);
      return outcome;
    };
    return { previewer: base, calls };
  };

  const openPdfToken = async (
    executor: AiExecutor,
    read: () => Promise<{ ok: boolean; documentToken?: string }>
  ): Promise<string> => {
    const opened = await read();
    expect(opened.ok).toBe(true);
    expect(opened.documentToken).toBeTruthy();
    return opened.documentToken as string;
  };

  const createPdfExecutor = (
    extra: Partial<ConstructorParameters<typeof AiExecutor>[0]> = {}
  ): AiExecutor =>
    new AiExecutor({
      driver: createDriver(),
      readActiveDocument: () => activePdf(),
      readPdfOutline: async () => ({ pages: 2, labels: ['姓名：', '日期：', '申请类别：'] }),
      ...extra
    });

  it('右栏是 PDF 时 open_document 直接返回标签提纲，不弹 Word/Excel 选择窗口', async () => {
    const picker = vi.fn(async () => makeDocument());
    const executor = createPdfExecutor({ openDocument: picker });

    const result = await executor.execute({ action: 'open_document' });

    expect(result.ok).toBe(true);
    expect(result.documentToken).toBeTruthy();
    expect(result.document).toMatchObject({
      format: 'pdf',
      name: '慈善组织申请表.pdf',
      pdfPages: 2,
      pdfLabels: ['姓名：', '日期：', '申请类别：']
    });
    expect(JSON.stringify(result)).not.toContain('C:\\\\Users');
    expect(picker).not.toHaveBeenCalled();
  });

  it('PDF 提纲包含分区字段时原样返回，且不暴露本机路径', async () => {
    const fields = [
      { page: 1, label: '姓名' },
      { page: 1, label: '姓名', section: '监护人 1' },
      { page: 1, label: '姓名', section: '监护人 2' }
    ];
    const executor = createPdfExecutor({
      readPdfOutline: async () => ({ pages: 1, labels: ['姓名'], fields })
    });

    const result = await executor.execute({ action: 'open_document' });

    expect(result.ok).toBe(true);
    expect(result.document).toMatchObject({ pdfFields: fields });
    expect(JSON.stringify(result)).not.toContain('C:\\\\Users');
  });

  it('PDF 提纲读不出来时也只返回文件名，仍然不弹选择窗口', async () => {
    const picker = vi.fn(async () => makeDocument());
    const executor = new AiExecutor({
      driver: createDriver(),
      openDocument: picker,
      readActiveDocument: () => activePdf(),
      readPdfOutline: async () => {
        throw new Error('parse failed');
      }
    });

    const result = await executor.execute({ action: 'open_document' });

    expect(result.ok).toBe(true);
    expect(result.document).toEqual({ format: 'pdf', name: '慈善组织申请表.pdf' });
    expect(result.documentToken).toBeUndefined();
    expect(picker).not.toHaveBeenCalled();
  });

  it('对 PDF 引用发 edit_document 时明确拒绝并指向 fill_pdf', async () => {
    const executor = createPdfExecutor();
    const token = await openPdfToken(executor, () => executor.execute({ action: 'read' }));

    const result = await executor.execute({
      action: 'edit_document',
      token,
      operations: [{ op: 'append_paragraph', text: '备注' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'pdf_readonly' });
    expect(result.message).toContain('fill_pdf');
  });

  it('fill_pdf 把标签清单交给右栏黄底预览，并返回副本信息', async () => {
    const { previewer, calls } = createPdfPreviewer({
      status: 'done',
      copy: doneCopy({
        name: '慈善组织申请表-已填写.pdf',
        format: 'pdf',
        applied: 2,
        skipped: ['申请类别：']
      })
    });
    const executor = createPdfExecutor({ previewDocument: previewer });
    const token = await openPdfToken(executor, () => executor.execute({ action: 'read' }));

    const result = await executor.execute({
      action: 'fill_pdf',
      token,
      entries: [
        { label: '姓名：', value: '张三' },
        { page: 2, label: '日期：', value: '2026-10-28' }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.file).toMatchObject({ name: '慈善组织申请表-已填写.pdf', format: 'pdf' });
    expect(result.edit).toMatchObject({ applied: 2, skipped: ['申请类别：'] });
    expect(calls).toEqual([
      {
        path: 'C:\\Users\\tester\\Desktop\\慈善组织申请表.pdf',
        fileName: '慈善组织申请表.pdf',
        entries: [
          { label: '姓名：', value: '张三' },
          { page: 2, label: '日期：', value: '2026-10-28' }
        ]
      }
    ]);

    const again = await executor.execute({
      action: 'fill_pdf',
      token,
      entries: [{ label: '姓名：', value: '李四' }]
    });
    expect(again).toMatchObject({ ok: false, code: 'document_expired' });
  });

  it('扫描件没有文字层时透出明确原因，不生成任何副本', async () => {
    const { previewer } = createPdfPreviewer({
      status: 'failed',
      code: 'pdf_no_text_layer',
      message: '这份 PDF 没有可定位的文字层（可能是扫描件），无法在原样副本上标注内容。'
    });
    const executor = createPdfExecutor({ previewDocument: previewer });
    const token = await openPdfToken(executor, () => executor.execute({ action: 'read' }));

    const result = await executor.execute({
      action: 'fill_pdf',
      token,
      entries: [{ label: '姓名：', value: '张三' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'pdf_no_text_layer' });
    expect(result.message).toContain('扫描件');
  });

  it('本轮全部跳过时不生成副本', async () => {
    const { previewer } = createPdfPreviewer({ status: 'no_change' });
    const executor = createPdfExecutor({ previewDocument: previewer });
    const token = await openPdfToken(executor, () => executor.execute({ action: 'read' }));

    const result = await executor.execute({
      action: 'fill_pdf',
      token,
      entries: [{ label: '姓名：', value: '张三' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'confirmation_declined' });
  });

  it('客户端还没接入 PDF 叠加预览时提示升级', async () => {
    const executor = createPdfExecutor();
    const token = await openPdfToken(executor, () => executor.execute({ action: 'read' }));

    const result = await executor.execute({
      action: 'fill_pdf',
      token,
      entries: [{ label: '姓名：', value: '张三' }]
    });

    expect(result).toMatchObject({ ok: false, code: 'document_preview_unavailable' });
    expect(result.message).toContain('升级');
  });
});
