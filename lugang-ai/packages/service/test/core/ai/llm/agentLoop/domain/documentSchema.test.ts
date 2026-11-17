import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_OPERATION_TOOL_NAME,
  DocumentOperationArgsSchema,
  createDocumentOperationTool,
  parseDocumentOperationArgs
} from '@fastgpt/service/core/ai/llm/agentLoop/domain/systemTool/document';

const sourceUrl = 'https://files.example.com/chat/user/doc.docx';
const generateBase = { action: 'generate', format: 'docx', fileName: '年度工作计划' } as const;

const parseGenerate = (overrides: Record<string, unknown>) =>
  DocumentOperationArgsSchema.safeParse({ ...generateBase, ...overrides });

const editOps = (operations: unknown[], url: string = sourceUrl) =>
  DocumentOperationArgsSchema.safeParse({ action: 'edit', sourceUrl: url, operations });

const paragraphBlock = { type: 'paragraph', text: '正文内容' } as const;
const oneSheet = { name: '名单', header: ['姓名'], rows: [['张三']] } as const;
const oneSlide = { title: '项目介绍', bullets: ['背景', '目标'] } as const;
const replaceOp = {
  op: 'replace_text',
  find: '旧内容',
  replace: '新内容'
} as const;
const appendRowOp = (values: string[]) => ({ op: 'append_row', sheet: '名单', values });
const fillFieldOp = (index: number) => ({
  op: 'fill_field',
  label: `字段${index}`,
  value: `值${index}`
});

describe('document_operation generate 内容字段与格式匹配', () => {
  it('docx 接受 blocks 或 content', () => {
    expect(parseGenerate({ blocks: [paragraphBlock] }).success).toBe(true);
    expect(parseGenerate({ content: '一段纯文本' }).success).toBe(true);
    expect(parseGenerate({ blocks: [paragraphBlock], content: '补充说明' }).success).toBe(true);
  });

  it('md 接受 content 或 blocks', () => {
    expect(
      parseGenerate({ format: 'md', content: '# 标题\n\n正文' }).success
    ).toBe(true);
    expect(parseGenerate({ format: 'md', blocks: [paragraphBlock] }).success).toBe(true);
  });

  it('xlsx 接受 sheets', () => {
    expect(parseGenerate({ format: 'xlsx', sheets: [oneSheet] }).success).toBe(true);
  });

  it('pptx 接受 slides', () => {
    expect(parseGenerate({ format: 'pptx', slides: [oneSlide] }).success).toBe(true);
  });

  it('格式不匹配的内容字段被拒绝', () => {
    expect(parseGenerate({ sheets: [oneSheet] }).success).toBe(false);
    expect(parseGenerate({ slides: [oneSlide] }).success).toBe(false);
    expect(parseGenerate({ format: 'xlsx', blocks: [paragraphBlock] }).success).toBe(false);
    expect(parseGenerate({ format: 'xlsx', content: '姓名\n张三' }).success).toBe(false);
    expect(parseGenerate({ format: 'pptx', content: '纯文本' }).success).toBe(false);
    expect(parseGenerate({ format: 'pptx', sheets: [oneSheet] }).success).toBe(false);
  });

  it('没有任何内容字段时拒绝', () => {
    const result = parseGenerate({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message).join('；')).toContain('内容');
    }
  });

  it('文件名与标题长度受控', () => {
    expect(parseGenerate({ content: '正文', fileName: '' }).success).toBe(false);
    expect(parseGenerate({ content: '正文', fileName: 'a'.repeat(81) }).success).toBe(false);
    expect(parseGenerate({ content: '正文', title: 'a'.repeat(121) }).success).toBe(false);
  });
});

describe('PPT 幻灯片六种版式', () => {
  const pptxBase = { action: 'generate', format: 'pptx', fileName: '演示' } as const;
  const parseSlides = (slides: unknown[]) =>
    DocumentOperationArgsSchema.safeParse({ ...pptxBase, slides });

  const oneTable = (rows: number, cols = 2) => ({
    header: Array.from({ length: cols }, (_, index) => `列${index}`),
    rows: Array.from({ length: rows }, (_, row) =>
      Array.from({ length: cols }, (_, col) => `r${row}c${col}`)
    )
  });
  const oneChart = {
    type: 'bar' as const,
    categories: ['一月', '二月'],
    series: [{ name: '销量', values: [10, 20] }]
  };

  it('六种版式都能解析', () => {
    const result = parseSlides([
      { layout: 'cover', title: '年度汇报', subtitle: '2026 年第二季度' },
      { layout: 'section', title: '第一部分', subtitle: '工作回顾' },
      { layout: 'bullets', title: '要点页', bullets: ['甲', '乙'] },
      {
        layout: 'image',
        title: '图示页',
        image: { sourceUrl: 'https://files.example.com/a.png', caption: '示意图' }
      },
      { layout: 'table', title: '对照页', table: oneTable(2) },
      { layout: 'chart', title: '趋势页', chart: oneChart }
    ]);
    expect(result.success).toBe(true);
  });

  it('版式缺少对应内容或一页堆多种内容时拒绝', () => {
    expect(parseSlides([{ layout: 'image', title: '图示页' }]).success).toBe(false);
    expect(parseSlides([{ layout: 'table', title: '对照页' }]).success).toBe(false);
    expect(parseSlides([{ layout: 'chart', title: '趋势页' }]).success).toBe(false);
    expect(
      parseSlides([{ layout: 'bullets', title: '要点页', table: oneTable(1) }]).success
    ).toBe(false);
    expect(
      parseSlides([{ title: '混合页', table: oneTable(1), chart: oneChart }]).success
    ).toBe(false);
  });

  it('表格行列、图表数值与图片地址受控', () => {
    expect(parseSlides([{ title: '表格', table: oneTable(8) }]).success).toBe(true);
    expect(parseSlides([{ title: '表格', table: oneTable(9) }]).success).toBe(false);
    expect(
      parseSlides([
        { title: '表格', table: { header: ['列A', '列B'], rows: [['只有一列']] } }
      ]).success
    ).toBe(false);

    const chartWith = (patch: Record<string, unknown>) => ({
      title: '图表',
      chart: { ...oneChart, ...patch }
    });
    expect(
      parseSlides([
        chartWith({ categories: Array.from({ length: 13 }, (_, index) => `分类${index}`) })
      ]).success
    ).toBe(false);
    expect(
      parseSlides([chartWith({ series: [{ name: '销量', values: [10] }] })]).success
    ).toBe(false);
    expect(
      parseSlides([
        chartWith({
          type: 'pie',
          series: [
            { name: '甲', values: [1, 2] },
            { name: '乙', values: [3, 4] }
          ]
        })
      ]).success
    ).toBe(false);

    expect(
      parseSlides([{ title: '图片', image: { sourceUrl: 'file:///C:/a.png' } }]).success
    ).toBe(false);
  });
});

describe('document_operation edit 组合上限', () => {
  it('替换类改动最多 50 条', () => {
    expect(editOps(Array.from({ length: 50 }, () => replaceOp)).success).toBe(true);
    expect(editOps(Array.from({ length: 51 }, () => replaceOp)).success).toBe(false);
  });

  it('插入与追加合计最多 20 段', () => {
    const appendOp = { op: 'append_paragraph', text: '追加段落' };
    const insertOp = { op: 'insert_paragraph', after: 0, text: '插入段落' };
    expect(
      editOps([
        ...Array.from({ length: 10 }, () => appendOp),
        ...Array.from({ length: 10 }, () => insertOp)
      ]).success
    ).toBe(true);
    expect(
      editOps([
        ...Array.from({ length: 10 }, () => appendOp),
        ...Array.from({ length: 11 }, () => insertOp)
      ]).success
    ).toBe(false);
  });

  it('单元格合计最多 200 个', () => {
    expect(
      editOps([appendRowOp(Array(50).fill('单元格')), appendRowOp(Array(50).fill('单元格')),
        appendRowOp(Array(50).fill('单元格')), appendRowOp(Array(50).fill('单元格'))]).success
    ).toBe(true);
    expect(
      editOps([
        appendRowOp(Array(50).fill('单元格')),
        appendRowOp(Array(50).fill('单元格')),
        appendRowOp(Array(50).fill('单元格')),
        appendRowOp(Array(50).fill('单元格')),
        appendRowOp(['多出的单元格'])
      ]).success
    ).toBe(false);
  });

  it('PDF 填写项最多 40 条', () => {
    expect(editOps(Array.from({ length: 40 }, (_, i) => fillFieldOp(i))).success).toBe(true);
    expect(editOps(Array.from({ length: 41 }, (_, i) => fillFieldOp(i))).success).toBe(false);
  });

  it('replace_text 不能同时限定段落与工作表/幻灯片', () => {
    expect(
      editOps([{ ...replaceOp, paragraph: 0, sheet: '名单' }]).success
    ).toBe(false);
    expect(
      editOps([{ ...replaceOp, paragraph: 0, slide: 1 }]).success
    ).toBe(false);
    expect(editOps([{ ...replaceOp, paragraph: 0 }]).success).toBe(true);
  });

  it('单条改动字段长度受控', () => {
    expect(editOps([{ ...replaceOp, find: 'a'.repeat(201) }]).success).toBe(false);
    expect(editOps([{ ...replaceOp, replace: 'a'.repeat(601) }]).success).toBe(false);
    expect(
      editOps([{ op: 'append_paragraph', text: 'a'.repeat(4001) }]).success
    ).toBe(false);
    expect(
      editOps([{ op: 'set_cell', sheet: '名单', cell: '列A1', value: 'x' }]).success
    ).toBe(false);
    expect(
      editOps([{ op: 'fill_field', label: 'a'.repeat(121), value: 'x' }]).success
    ).toBe(false);
  });

  it('空改动清单被拒绝', () => {
    expect(editOps([]).success).toBe(false);
  });
});

describe('document_operation PPT 图片与页结构调整', () => {
  it('replace_image、delete_slide、move_slide 可以解析', () => {
    const result = editOps([
      { op: 'replace_image', image: 'image1.png', sourceUrl },
      { op: 'delete_slide', slide: 2 },
      { op: 'move_slide', from: 3, to: 1 }
    ]);

    expect(result.success).toBe(true);
  });

  it('幻灯片页码从 1 开始，0 被拒绝', () => {
    expect(editOps([{ ...replaceOp, slide: 1 }]).success).toBe(true);
    expect(editOps([{ ...replaceOp, slide: 0 }]).success).toBe(false);
    expect(editOps([{ op: 'delete_slide', slide: 0 }]).success).toBe(false);
    expect(editOps([{ op: 'move_slide', from: 0, to: 1 }]).success).toBe(false);
    expect(editOps([{ op: 'move_slide', from: 1, to: 0 }]).success).toBe(false);
  });

  it('替换图片的新图地址必须是 http(s)，图片名不能带路径', () => {
    expect(
      editOps([{ op: 'replace_image', image: 'image1.png', sourceUrl: 'file:///C:/a.png' }]).success
    ).toBe(false);
    expect(
      editOps([{ op: 'replace_image', image: '../image1.png', sourceUrl }]).success
    ).toBe(false);
  });

  it('删除页与调整页序合计最多 30 条', () => {
    const deletes = Array.from({ length: 30 }, () => ({ op: 'delete_slide', slide: 1 }));
    expect(editOps(deletes).success).toBe(true);
    expect(
      editOps([...deletes, { op: 'move_slide', from: 1, to: 2 }]).success
    ).toBe(false);
  });
});

describe('document_operation sourceUrl 校验', () => {
  it('read 只接受 http(s) 对话文件地址', () => {
    expect(
      DocumentOperationArgsSchema.safeParse({ action: 'read', sourceUrl }).success
    ).toBe(true);
    expect(
      DocumentOperationArgsSchema.safeParse({
        action: 'read',
        sourceUrl: 'file:///C:/Users/a/secret.docx'
      }).success
    ).toBe(false);
    expect(
      DocumentOperationArgsSchema.safeParse({ action: 'read', sourceUrl: '/chat/doc.docx' })
        .success
    ).toBe(false);
  });

  it('edit 的 sourceUrl 也必须是 http(s)', () => {
    expect(editOps([replaceOp], 'file:///C:/Users/a/secret.docx').success).toBe(false);
    expect(editOps([replaceOp], 'ftp://files.example.com/doc.docx').success).toBe(false);
  });

  it('edit 输出文件名受控', () => {
    expect(
      DocumentOperationArgsSchema.safeParse({
        action: 'edit',
        sourceUrl,
        outputName: 'a'.repeat(81),
        operations: [replaceOp]
      }).success
    ).toBe(false);
    expect(
      DocumentOperationArgsSchema.safeParse({
        action: 'edit',
        sourceUrl,
        outputName: '年度工作计划（修改版）',
        operations: [replaceOp]
      }).success
    ).toBe(true);
  });
});

describe('createDocumentOperationTool 工具面', () => {
  it('暴露 document_operation 的 name/description/parameters', () => {
    const tool = createDocumentOperationTool();
    expect(tool.type).toBe('function');
    expect(tool.function.name).toBe(DOCUMENT_OPERATION_TOOL_NAME);
    expect(DOCUMENT_OPERATION_TOOL_NAME).toBe('document_operation');

    const description = tool.function.description;
    expect(description).toContain('generate');
    expect(description).toContain('read');
    expect(description).toContain('edit');
    expect(description).toContain('sourceUrl');
    expect(description).toContain('下载');

    const parameters = tool.function.parameters as {
      type: string;
      required: string[];
      properties: Record<string, { enum?: string[] }>;
    };
    expect(parameters.type).toBe('object');
    expect(parameters.required).toContain('action');
    expect(parameters.properties.action.enum).toEqual(['read', 'generate', 'edit']);
    expect(Object.keys(parameters.properties)).toEqual(
      expect.arrayContaining(['sourceUrl', 'format', 'fileName', 'title', 'blocks', 'sheets', 'slides', 'content', 'operations', 'outputName'])
    );
  });

  it('解析不支持的 action 时给出中文提示', () => {
    const result = parseDocumentOperationArgs({ action: 'send_email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('仅支持');
    }
  });

  it('合法 generate 参数可解析', () => {
    const result = parseDocumentOperationArgs({
      ...generateBase,
      blocks: [paragraphBlock]
    });
    expect(result.success).toBe(true);
  });
});
