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
