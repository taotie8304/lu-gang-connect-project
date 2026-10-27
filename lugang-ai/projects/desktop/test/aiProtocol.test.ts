import { describe, expect, it } from 'vitest';
import { parseAiCommand } from '../src/main/ai/protocol';

describe('AI 指令协议', () => {
  it('接受读取、导航、点击、输入、下拉、滚动与停止指令', () => {
    expect(parseAiCommand({ action: 'read' })?.action).toBe('read');
    expect(parseAiCommand({ action: 'navigate', url: 'https://www.gov.hk/' })?.action).toBe(
      'navigate'
    );
    expect(parseAiCommand({ action: 'click', ref: 'e12' })?.action).toBe('click');
    expect(parseAiCommand({ action: 'click', target: '下一步' })?.action).toBe('click');
    expect(parseAiCommand({ action: 'type', ref: 'e3', text: '张三' })?.action).toBe('type');
    expect(
      parseAiCommand({ action: 'select', target: '证件类型', option: '港澳通行证' })?.action
    ).toBe('select');
    expect(parseAiCommand({ action: 'scroll', direction: 'down', amount: 600 })?.action).toBe(
      'scroll'
    );
    expect(parseAiCommand({ action: 'stop' })?.action).toBe('stop');
  });

  it('点击/输入/下拉必须给出元素定位信息', () => {
    expect(parseAiCommand({ action: 'click' })).toBeNull();
    expect(parseAiCommand({ action: 'type', text: '张三' })).toBeNull();
    expect(parseAiCommand({ action: 'select', option: '是' })).toBeNull();
  });

  it('拒绝未知动作与超长内容', () => {
    expect(parseAiCommand({ action: 'submit' })).toBeNull();
    expect(parseAiCommand({ action: 'type', ref: 'e1', text: 'x'.repeat(2001) })).toBeNull();
    expect(parseAiCommand({ action: 'navigate', url: '' })).toBeNull();
    expect(parseAiCommand({ action: 'scroll', direction: 'diagonal' })).toBeNull();
  });

  it('拒绝非法字段类型', () => {
    expect(parseAiCommand({ action: 'scroll', direction: 'down', amount: -1 })).toBeNull();
    expect(parseAiCommand({ action: 'read', fullText: 'yes' })).toBeNull();
    expect(parseAiCommand(null)).toBeNull();
    expect(parseAiCommand('read')).toBeNull();
  });

  it('接受生成 Word、Excel、PDF 文件指令', () => {
    const word = parseAiCommand({
      action: 'generate_file',
      format: 'docx',
      fileName: '慈善组织申请书',
      title: '慈善组织申请书',
      content: '申请人：张三\n申请事项：成立慈善组织'
    });
    expect(word?.action).toBe('generate_file');

    const excel = parseAiCommand({
      action: 'generate_file',
      format: 'xlsx',
      fileName: '人员名单',
      rows: [
        ['姓名', '证件号码'],
        ['张三', 'A1234567']
      ]
    });
    expect(excel?.action).toBe('generate_file');

    const pdf = parseAiCommand({
      action: 'generate_file',
      format: 'pdf',
      fileName: '申请说明',
      content: '申请说明正文'
    });
    expect(pdf?.action).toBe('generate_file');
  });

  it('拒绝不支持的格式与超长内容', () => {
    expect(
      parseAiCommand({ action: 'generate_file', format: 'exe', fileName: 'x', content: 'y' })
    ).toBeNull();
    expect(
      parseAiCommand({
        action: 'generate_file',
        format: 'docx',
        fileName: 'x',
        content: 'x'.repeat(20001)
      })
    ).toBeNull();
    expect(parseAiCommand({ action: 'generate_file', format: 'docx', fileName: '' })).toBeNull();
    expect(
      parseAiCommand({
        action: 'generate_file',
        format: 'xlsx',
        fileName: 'x',
        rows: Array.from({ length: 2001 }, () => ['x'])
      })
    ).toBeNull();
  });

  it('接受结构化正文与多工作表指令', () => {
    const word = parseAiCommand({
      action: 'generate_file',
      format: 'docx',
      fileName: '慈善组织申请说明',
      title: '慈善组织申请说明',
      blocks: [
        { type: 'heading', level: 1, text: '一、申请条件' },
        { type: 'paragraph', text: '须年满十八岁。' },
        { type: 'list', ordered: true, items: ['身份证明', '住址证明'] },
        { type: 'table', header: ['项目', '要求'], rows: [['年龄', '18 岁以上']] },
        { type: 'divider' },
        { type: 'pageBreak' }
      ]
    }) as { blocks?: unknown[] } | null;
    expect(word?.blocks).toHaveLength(6);

    const excel = parseAiCommand({
      action: 'generate_file',
      format: 'xlsx',
      fileName: '成绩汇总',
      sheets: [
        {
          name: '人员名单',
          header: ['姓名', '分数'],
          rows: [['张三', '90']],
          merges: ['A4:B4'],
          widths: [16, 10],
          freeze: true
        },
        { name: '说明', rows: [['本表由助手生成']] }
      ]
    }) as { sheets?: unknown[] } | null;
    expect(excel?.sheets).toHaveLength(2);
  });

  it('拒绝结构不合法的正文块与超额工作表', () => {
    expect(
      parseAiCommand({
        action: 'generate_file',
        format: 'docx',
        fileName: 'x',
        blocks: [{ type: 'video', text: '不支持' }]
      })
    ).toBeNull();
    expect(
      parseAiCommand({
        action: 'generate_file',
        format: 'docx',
        fileName: 'x',
        blocks: [{ type: 'heading', level: 4, text: '层级越界' }]
      })
    ).toBeNull();
    expect(
      parseAiCommand({
        action: 'generate_file',
        format: 'xlsx',
        fileName: 'x',
        sheets: Array.from({ length: 6 }, () => ({ rows: [['a']] }))
      })
    ).toBeNull();
    expect(
      parseAiCommand({
        action: 'generate_file',
        format: 'xlsx',
        fileName: 'x',
        sheets: [{ name: '名单', merges: ['B2'] }]
      })
    ).toBeNull();
    expect(
      parseAiCommand({
        action: 'generate_file',
        format: 'xlsx',
        fileName: 'x',
        sheets: [{ name: '名单'.repeat(20), rows: [['a']] }]
      })
    ).toBeNull();
  });

  it('接受打开表单与回填表单指令', () => {
    expect(parseAiCommand({ action: 'open_form' })?.action).toBe('open_form');
    expect(parseAiCommand({ action: 'open_form', hint: '慈善组织申请表' })?.action).toBe(
      'open_form'
    );

    const fill = parseAiCommand({
      action: 'fill_form',
      token: 'lgform_abc123',
      fields: [
        { field: 'f1', value: '张三' },
        { field: 'f2', value: '' }
      ]
    });
    expect(fill?.action).toBe('fill_form');
  });

  it('回填指令必须携带令牌与至少一个字段，且不能携带本机路径', () => {
    expect(parseAiCommand({ action: 'fill_form', fields: [{ field: 'f1', value: 'x' }] })).toBeNull();
    expect(parseAiCommand({ action: 'fill_form', token: 'lgform_abc', fields: [] })).toBeNull();
    expect(
      parseAiCommand({ action: 'fill_form', token: 'lgform_abc', fields: [{ field: '', value: 'x' }] })
    ).toBeNull();
    expect(
      parseAiCommand({
        action: 'fill_form',
        token: 'lgform_abc',
        fields: [{ field: 'f1', value: 'x'.repeat(2001) }]
      })
    ).toBeNull();

    const withPath = parseAiCommand({
      action: 'fill_form',
      token: 'lgform_abc',
      path: 'C:\\Users\\tester\\Downloads\\表单.docx',
      fields: [{ field: 'f1', value: 'x' }]
    }) as { path?: string } | null;
    expect(withPath?.path).toBeUndefined();
  });

  it('打开表单指令不携带本机路径', () => {
    const withPath = parseAiCommand({
      action: 'open_form',
      path: 'C:\\Users\\tester\\Downloads\\表单.docx'
    }) as Record<string, unknown> | null;
    expect(withPath?.action).toBe('open_form');
    expect(withPath?.path).toBeUndefined();
  });

  it('上传指令必须给出元素定位信息，且不能携带本地路径', () => {
    const upload = parseAiCommand({ action: 'upload', target: '上传附件' });
    expect(upload?.action).toBe('upload');
    expect(parseAiCommand({ action: 'upload', ref: 'e9' })?.action).toBe('upload');
    expect(parseAiCommand({ action: 'upload' })).toBeNull();
    expect(
      parseAiCommand({ action: 'upload', ref: 'e9', path: 'C:\\Windows\\System32\\x.txt' })
    ).not.toBeNull();
    expect(
      (parseAiCommand({ action: 'upload', ref: 'e9', path: 'C:\\x.txt' }) as { path?: string })
        ?.path
    ).toBeUndefined();
  });

  it('接受打开文档与修改文档指令', () => {
    expect(parseAiCommand({ action: 'open_document' })?.action).toBe('open_document');
    expect(parseAiCommand({ action: 'open_document', hint: '慈善组织申请表' })?.action).toBe(
      'open_document'
    );

    const edit = parseAiCommand({
      action: 'edit_document',
      token: 'lgdoc_abc123',
      operations: [
        { op: 'replace_text', find: '2023', replace: '2024' },
        { op: 'set_paragraph', paragraph: 2, text: '新的第三段' },
        { op: 'insert_paragraph', after: 2, text: '补充说明' },
        { op: 'append_paragraph', text: '末尾补充' },
        { op: 'set_table_cell', table: 0, row: 1, cell: 2, text: '已更新' },
        { op: 'set_cell', sheet: '名单', cell: 'B2', value: '90' },
        { op: 'append_row', sheet: '名单', values: ['张三', '90'] }
      ]
    }) as { action?: string; operations?: unknown[] } | null;
    expect(edit?.action).toBe('edit_document');
    expect(edit?.operations).toHaveLength(7);
  });

  it('打开文档指令不携带本机路径', () => {
    const withPath = parseAiCommand({
      action: 'open_document',
      path: 'C:\\Users\\tester\\Downloads\\申请表.docx'
    }) as Record<string, unknown> | null;
    expect(withPath?.action).toBe('open_document');
    expect(withPath?.path).toBeUndefined();
  });

  it('修改文档指令必须携带令牌与至少一个操作', () => {
    expect(
      parseAiCommand({ action: 'edit_document', operations: [{ op: 'append_paragraph', text: 'x' }] })
    ).toBeNull();
    expect(parseAiCommand({ action: 'edit_document', token: 'lgdoc_abc', operations: [] })).toBeNull();
    expect(
      parseAiCommand({
        action: 'edit_document',
        token: 'lgdoc_abc',
        operations: [{ op: 'remove_page', index: 1 }]
      })
    ).toBeNull();
  });

  it('拒绝非法或超量的文档修改操作', () => {
    const edit = (operations: unknown[]) =>
      parseAiCommand({ action: 'edit_document', token: 'lgdoc_abc', operations });

    expect(edit([{ op: 'replace_text', find: '', replace: 'x' }])).toBeNull();
    expect(
      edit([{ op: 'replace_text', find: 'a', replace: '', paragraph: 1, sheet: '名单' }])
    ).toBeNull();
    expect(edit([{ op: 'set_cell', sheet: '名单', cell: 'B', value: 'x' }])).toBeNull();
    expect(edit([{ op: 'set_cell', sheet: '名单', cell: 'B0', value: 'x' }])).toBeNull();
    expect(edit([{ op: 'set_cell', sheet: '名单', cell: 'B3x', value: 'x' }])).toBeNull();
    expect(edit([{ op: 'append_row', sheet: '名单', values: [] }])).toBeNull();
    expect(
      edit(Array.from({ length: 61 }, () => ({ op: 'append_paragraph', text: 'x' })))
    ).toBeNull();
    expect(
      edit(Array.from({ length: 51 }, () => ({ op: 'set_paragraph', paragraph: 0, text: 'x' })))
    ).toBeNull();
    expect(
      edit(Array.from({ length: 21 }, () => ({ op: 'insert_paragraph', after: 0, text: 'x' })))
    ).toBeNull();
    expect(
      edit(
        Array.from({ length: 60 }, () => ({
          op: 'append_row',
          sheet: '名单',
          values: ['a', 'b', 'c', 'd']
        }))
      )
    ).toBeNull();
  });
});
