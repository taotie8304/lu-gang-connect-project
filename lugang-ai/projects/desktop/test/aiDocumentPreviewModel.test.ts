// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow
} from 'docx';
import { describe, expect, it } from 'vitest';
import {
  buildPreviewChanges,
  computePreviewBlocks,
  extractDocxPreview
} from '../src/main/ai/document/docxPreview';
import { DocumentParseError } from '../src/main/ai/document/types';
import type { DocumentEditOperation } from '../src/main/ai/protocol';

const withTempDir = async <T>(run: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'lugang-doc-preview-'));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const writeDocx = async (
  dir: string,
  children: Paragraph[] | (Paragraph | Table)[],
  name = '申请说明.docx'
): Promise<string> => {
  const doc = new Document({
    sections: [
      {
        children: children as (Paragraph | Table)[]
      }
    ]
  });
  const path = join(dir, name);
  await writeFile(path, await Packer.toBuffer(doc));
  return path;
};

const buildSampleDocx = (dir: string): Promise<string> =>
  writeDocx(dir, [
    new Paragraph({ text: '一、申请资格', heading: HeadingLevel.HEADING_1 }),
    new Paragraph('申请人须年满十八岁，并持有有效身份证明。'),
    new Paragraph('预算：100 万元。'),
    new Paragraph({ text: '二、材料清单', heading: HeadingLevel.HEADING_2 }),
    new Paragraph('身份证明复印件。'),
    new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('姓名')] }),
            new TableCell({ children: [new Paragraph('证件号码')] })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('张三')] }),
            new TableCell({ children: [new Paragraph('A1234567')] })
          ]
        })
      ]
    })
  ]);

const operation = (value: DocumentEditOperation): DocumentEditOperation => value;

const pending = (changes: ReturnType<typeof buildPreviewChanges>) =>
  changes.map((change) => change.status);

describe('Word 预览块提取', () => {
  it('按段落与表格顺序输出完整正文和标题级别', async () => {
    await withTempDir(async (dir) => {
      const path = await buildSampleDocx(dir);
      const model = await extractDocxPreview(path);

      expect(model.blocks.map((block) => block.id)).toEqual([
        'p:0',
        'p:1',
        'p:2',
        'p:3',
        'p:4',
        't:0'
      ]);
      expect(model.blocks[0]).toMatchObject({
        kind: 'paragraph',
        index: 0,
        text: '一、申请资格',
        heading: 1
      });
      expect(model.blocks[2]).toMatchObject({
        kind: 'paragraph',
        index: 2,
        text: '预算：100 万元。'
      });
      expect(model.blocks[3]).toMatchObject({ text: '二、材料清单', heading: 2 });
      expect(model.blocks[5]).toMatchObject({
        kind: 'table',
        index: 0,
        rows: [
          ['姓名', '证件号码'],
          ['张三', 'A1234567']
        ]
      });
      expect(model.xml).toContain('<w:document');
      expect(JSON.stringify(model.blocks)).not.toContain(dir);
    });
  });

  it('正文超过预览上限时给出可操作的中文说明', async () => {
    await withTempDir(async (dir) => {
      const paragraphs = Array.from({ length: 1300 }, (_, index) =>
        new Paragraph(`第 ${index + 1} 段正文`)
      );
      const path = await writeDocx(dir, paragraphs, '超长文档.docx');

      await expect(extractDocxPreview(path)).rejects.toBeInstanceOf(DocumentParseError);
      await expect(extractDocxPreview(path)).rejects.toMatchObject({
        code: 'document_parse_failed'
      });
    });
  });
});

describe('逐条模拟改动', () => {
  it('逐条输出位置、章节、原文与修改后，初始全部待处理', async () => {
    await withTempDir(async (dir) => {
      const path = await buildSampleDocx(dir);
      const model = await extractDocxPreview(path);
      const operations: DocumentEditOperation[] = [
        operation({ op: 'replace_text', paragraph: 2, find: '100 万元', replace: '120 万元' }),
        operation({ op: 'set_paragraph', paragraph: 1, text: '申请人须年满二十岁。' }),
        operation({ op: 'insert_paragraph', after: 2, text: '预算以最终核定为准。' }),
        operation({ op: 'append_paragraph', text: '本说明自发布之日起生效。' }),
        operation({
          op: 'set_table_cell',
          table: 0,
          row: 1,
          cell: 1,
          text: 'B7654321'
        })
      ];

      const changes = buildPreviewChanges(model, operations);

      expect(pending(changes)).toEqual([
        'pending',
        'pending',
        'pending',
        'pending',
        'pending'
      ]);
      expect(changes[0]).toMatchObject({
        index: 0,
        target: '第 3 段',
        section: '一、申请资格',
        before: '100 万元',
        after: '120 万元',
        scope: 'paragraph',
        paragraph: 2
      });
      expect(changes[1]).toMatchObject({
        target: '第 2 段',
        before: '申请人须年满十八岁，并持有有效身份证明。',
        after: '申请人须年满二十岁。'
      });
      expect(changes[2]).toMatchObject({
        target: '第 3 段之后',
        before: '',
        after: '预算以最终核定为准。'
      });
      expect(changes[3]).toMatchObject({ target: '文末', before: '', after: '本说明自发布之日起生效。' });
      expect(changes[4]).toMatchObject({
        target: '第 1 张表 第 2 行第 2 格',
        before: 'A1234567',
        after: 'B7654321',
        scope: 'table',
        table: { index: 0, row: 1, cell: 1 }
      });
    });
  });

  it('未指定段落时按全篇定位，命中多个段落', async () => {
    await withTempDir(async (dir) => {
      const path = await buildSampleDocx(dir);
      const model = await extractDocxPreview(path);
      const changes = buildPreviewChanges(model, [
        operation({ op: 'replace_text', find: '身份', replace: '个人身份' })
      ]);

      expect(changes[0]).toMatchObject({ target: '全篇', scope: 'document', before: '身份', after: '个人身份' });
    });
  });

  it('Excel 专用操作在 Word 上标记为不适用', async () => {
    await withTempDir(async (dir) => {
      const path = await buildSampleDocx(dir);
      const model = await extractDocxPreview(path);
      const changes = buildPreviewChanges(model, [
        operation({ op: 'set_cell', sheet: 'Sheet1', cell: 'B2', value: '新值' })
      ]);

      expect(changes[0]).toMatchObject({ status: 'unavailable', target: '不适用' });
      expect(changes[0].note).toContain('Excel');
    });
  });
});

describe('预览最终态', () => {
  it('待处理的改动显示新文本并保留原文，跳过还原，采用转绿', async () => {
    await withTempDir(async (dir) => {
      const path = await buildSampleDocx(dir);
      const model = await extractDocxPreview(path);
      const operations: DocumentEditOperation[] = [
        operation({ op: 'replace_text', paragraph: 2, find: '100 万元', replace: '120 万元' })
      ];
      const changes = buildPreviewChanges(model, operations);

      const initial = computePreviewBlocks(model, operations, changes);
      expect(initial[2]).toMatchObject({
        id: 'p:2',
        text: '预算：120 万元。',
        originalText: '预算：100 万元。',
        mark: 'pending'
      });

      const skipped = computePreviewBlocks(model, operations, [
        { ...changes[0], status: 'skipped' }
      ]);
      expect(skipped[2]).toMatchObject({ id: 'p:2', text: '预算：100 万元。' });
      expect(skipped[2].mark).toBeUndefined();

      const applied = computePreviewBlocks(model, operations, [
        { ...changes[0], status: 'applied' }
      ]);
      expect(applied[2]).toMatchObject({
        text: '预算：120 万元。',
        originalText: '预算：100 万元。',
        mark: 'applied'
      });
    });
  });

  it('插入与追加段落随状态出现或消失', async () => {
    await withTempDir(async (dir) => {
      const path = await buildSampleDocx(dir);
      const model = await extractDocxPreview(path);
      const operations: DocumentEditOperation[] = [
        operation({ op: 'insert_paragraph', after: 2, text: '预算以最终核定为准。' }),
        operation({ op: 'append_paragraph', text: '本说明自发布之日起生效。' })
      ];
      const changes = buildPreviewChanges(model, operations);

      const initial = computePreviewBlocks(model, operations, changes);
      const texts = initial
        .filter((block) => block.kind === 'paragraph')
        .map((block) => (block.kind === 'paragraph' ? block.text : ''));
      expect(texts.indexOf('预算以最终核定为准。')).toBe(3);
      expect(texts.at(-1)).toBe('本说明自发布之日起生效。');

      const skipped = computePreviewBlocks(model, operations, [
        { ...changes[0], status: 'skipped' },
        { ...changes[1], status: 'skipped' }
      ]);
      const skippedTexts = skipped
        .filter((block) => block.kind === 'paragraph')
        .map((block) => (block.kind === 'paragraph' ? block.text : ''));
      expect(skippedTexts).not.toContain('预算以最终核定为准。');
      expect(skippedTexts).not.toContain('本说明自发布之日起生效。');
    });
  });

  it('表格改动只更新目标单元格并带单元格标记', async () => {
    await withTempDir(async (dir) => {
      const path = await buildSampleDocx(dir);
      const model = await extractDocxPreview(path);
      const operations: DocumentEditOperation[] = [
        operation({ op: 'set_table_cell', table: 0, row: 1, cell: 1, text: 'B7654321' })
      ];
      const changes = buildPreviewChanges(model, operations);

      const blocks = computePreviewBlocks(model, operations, changes);
      const table = blocks.find((block) => block.kind === 'table');
      expect(table).toMatchObject({
        id: 't:0',
        rows: [
          ['姓名', '证件号码'],
          ['张三', 'B7654321']
        ],
        cellMarks: [{ row: 1, cell: 1, mark: 'pending', original: 'A1234567' }]
      });
    });
  });

  it('同一段落多条改动时块状态按待处理优先', async () => {
    await withTempDir(async (dir) => {
      const path = await buildSampleDocx(dir);
      const model = await extractDocxPreview(path);
      const operations: DocumentEditOperation[] = [
        operation({ op: 'replace_text', paragraph: 2, find: '100 万元', replace: '120 万元' }),
        operation({ op: 'set_paragraph', paragraph: 2, text: '预算：150 万元。' })
      ];
      const changes = buildPreviewChanges(model, operations);

      const blocks = computePreviewBlocks(model, operations, [
        { ...changes[0], status: 'applied' },
        { ...changes[1], status: 'pending' }
      ]);
      expect(blocks[2]).toMatchObject({
        id: 'p:2',
        text: '预算：150 万元。',
        originalText: '预算：100 万元。',
        mark: 'pending'
      });
    });
  });

  it('全篇替换更新所有命中段落', async () => {
    await withTempDir(async (dir) => {
      const path = await buildSampleDocx(dir);
      const model = await extractDocxPreview(path);
      const operations: DocumentEditOperation[] = [
        operation({ op: 'replace_text', find: '身份', replace: '个人身份' })
      ];
      const changes = buildPreviewChanges(model, operations);
      const blocks = computePreviewBlocks(model, operations, changes);

      expect(blocks[1]).toMatchObject({
        id: 'p:1',
        text: '申请人须年满十八岁，并持有有效个人身份证明。',
        mark: 'pending'
      });
      expect(blocks[4]).toMatchObject({
        id: 'p:4',
        text: '个人身份证明复印件。',
        mark: 'pending'
      });
    });
  });
});
