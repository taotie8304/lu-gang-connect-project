// @vitest-environment node
// 鲁港通 - 文档编辑端到端：五种格式产出副本并上传，未命中不产出，部分成功汇总原因
import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUploadChatFile = vi.hoisted(() => vi.fn());
const mockGetS3ChatSource = vi.hoisted(() => vi.fn(() => ({ uploadChatFile: mockUploadChatFile })));

vi.mock('@fastgpt/service/common/s3/sources/chat', () => ({
  getS3ChatSource: mockGetS3ChatSource
}));

import { ChatFileTypeEnum } from '@fastgpt/global/core/chat/constants';
import { createDocumentOperationExecutor } from '@fastgpt/service/core/ai/document/executor';
import { editMarkdown } from '@fastgpt/service/core/ai/document/edit/markdown';
import { generateDocx } from '@fastgpt/service/core/ai/document/generate/docx';
import { generateMarkdown } from '@fastgpt/service/core/ai/document/generate/markdown';
import { generatePdf } from '@fastgpt/service/core/ai/document/generate/pdf';
import { generatePptx } from '@fastgpt/service/core/ai/document/generate/pptx';
import { generateXlsx } from '@fastgpt/service/core/ai/document/generate/xlsx';
import { DocumentEditError } from '@fastgpt/service/core/ai/document/types';
import { runWithContext } from '@fastgpt/service/core/workflow/utils/context';
import type {
  WorkflowFileContext,
  WorkflowFileRef
} from '@fastgpt/service/core/workflow/utils/fileContext';

const SOURCE_ID = '507f1f77bcf86cd799439011';

const executor = createDocumentOperationExecutor({
  sourceType: 'app',
  sourceId: SOURCE_ID,
  uid: 'uid-1',
  chatId: 'chat-1'
});

const makeCall = (args: unknown) => ({
  id: 'call-1',
  type: 'function' as const,
  function: {
    name: 'document_operation',
    arguments: JSON.stringify(args)
  }
});

const getUploadArgs = (index = 0) => mockUploadChatFile.mock.calls[index][0];

// 鲁港通 - 把指定文件登记进对话文件上下文，源内容与真实上传同路读取
const runWithFile = async <T>(
  name: string,
  buffer: Buffer,
  fn: (sourceUrl: string) => Promise<T>
): Promise<T> => {
  const url = `https://files.example/${encodeURIComponent(name)}`;
  const ref: WorkflowFileRef = {
    name,
    type: ChatFileTypeEnum.file,
    modelUrl: url,
    source: { type: 'externalHttp', url }
  };
  const fileContext = {
    limits: { maxFileAmount: 5, maxBytesPerFile: 20 * 1024 * 1024 },
    resolve: (target: string) => (target === url ? ref : undefined),
    getSource: async () => ({
      source: {
        kind: 'externalHttp' as const,
        maxSizeBytes: 20 * 1024 * 1024,
        metadata: { filename: name },
        materialize: async () => ({ buffer, metadata: { filename: name } })
      },
      sourceKind: 'internal' as const
    })
  } as unknown as WorkflowFileContext;

  return runWithContext({ mcpClientMemory: {}, fileContext }, () => fn(url));
};

// 鲁港通 - 多文件上下文：编辑 PPT 时需要同时提供原件与对话里的新图片
const runWithFiles = async <T>(
  files: Array<{ name: string; buffer: Buffer }>,
  fn: (urls: Record<string, string>) => Promise<T>
): Promise<T> => {
  const entries = files.map((file) => ({
    ...file,
    url: `https://files.example/${encodeURIComponent(file.name)}`
  }));
  const findEntry = (target: string) => entries.find((entry) => entry.url === target);
  const fileContext = {
    limits: { maxFileAmount: 5, maxBytesPerFile: 20 * 1024 * 1024 },
    resolve: (target: string) => {
      const entry = findEntry(target);
      return entry
        ? {
            name: entry.name,
            type: ChatFileTypeEnum.file,
            modelUrl: entry.url,
            source: { type: 'externalHttp', url: entry.url }
          }
        : undefined;
    },
    getSource: async (target: string | WorkflowFileRef) => {
      const url = typeof target === 'string' ? target : target.modelUrl ?? '';
      const entry = findEntry(url);
      if (!entry) throw new Error('file not found');
      return {
        source: {
          kind: 'externalHttp' as const,
          maxSizeBytes: 20 * 1024 * 1024,
          metadata: { filename: entry.name },
          materialize: async () => ({ buffer: entry.buffer, metadata: { filename: entry.name } })
        },
        sourceKind: 'internal' as const
      };
    }
  } as unknown as WorkflowFileContext;

  return runWithContext({ mcpClientMemory: {}, fileContext }, () =>
    fn(Object.fromEntries(entries.map((entry) => [entry.name, entry.url])))
  );
};

const fixtures = {
  docx: () =>
    generateDocx({
      format: 'docx',
      fileName: '家长会通知',
      blocks: [
        { type: 'paragraph', text: '尊敬的家长：' },
        { type: 'paragraph', text: '本周五下午召开家长会。' }
      ]
    }),
  xlsx: () =>
    generateXlsx({
      format: 'xlsx',
      fileName: '人员名单',
      sheets: [{ name: '名单', header: ['姓名', '分数'], rows: [['张三', '90']] }]
    }),
  pptx: () =>
    generatePptx({
      format: 'pptx',
      fileName: '申请须知',
      slides: [{ title: '2023年申请须知', bullets: ['准备材料'] }]
    }),
  pdf: () =>
    generatePdf({
      format: 'pdf',
      fileName: '申请表',
      blocks: [{ type: 'paragraph', text: '申请人：' }]
    }),
  md: () =>
    generateMarkdown({
      format: 'md',
      fileName: '办事说明',
      content: '# 办事说明\n\n家长需携带证件。'
    })
};

const editCases: Array<{
  format: keyof typeof fixtures;
  fileName: string;
  extension: string;
  operations: unknown[];
}> = [
  {
    format: 'docx',
    fileName: '家长会通知.docx',
    extension: 'docx',
    operations: [{ op: 'replace_text', find: '家长会', replace: '家长座谈会' }]
  },
  {
    format: 'xlsx',
    fileName: '人员名单.xlsx',
    extension: 'xlsx',
    operations: [{ op: 'set_cell', sheet: '名单', cell: 'B2', value: '95' }]
  },
  {
    format: 'pptx',
    fileName: '申请须知.pptx',
    extension: 'pptx',
    operations: [{ op: 'replace_text', find: '2023', replace: '2024' }]
  },
  {
    format: 'pdf',
    fileName: '申请表.pdf',
    extension: 'pdf',
    operations: [{ op: 'add_text', label: '申请人', value: '李四' }]
  },
  {
    format: 'md',
    fileName: '办事说明.md',
    extension: 'md',
    operations: [{ op: 'replace_text', find: '家长', replace: '参会家长' }]
  }
];

describe('Markdown 编辑', () => {
  it('全文替换统计命中次数', async () => {
    const result = await editMarkdown({
      buffer: Buffer.from('# 家长会通知\n\n通知各位家长：家长会时间另行通知。', 'utf8'),
      operations: [{ op: 'replace_text', find: '家长', replace: '参会家长' }]
    });

    expect(result.applied).toBe(3);
    const text = result.buffer.toString('utf8');
    expect(text).toContain('参会家长会通知');
    expect(text).toContain('各位参会家长');
  });

  it('结构化的段落与表格操作说明不支持，全部未命中不产出', async () => {
    const error = await editMarkdown({
      buffer: Buffer.from('# 标题\n\n正文', 'utf8'),
      operations: [{ op: 'set_paragraph', paragraph: 0, text: '改标题' }]
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DocumentEditError);
    expect((error as Error).message).toContain('未生成新文件');
    expect((error as Error).message).toContain('Word');
  });
});

describe('文档编辑端到端', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadChatFile.mockResolvedValue({
      key: 'chat/app/source/uid/chat/opaque-key',
      accessUrl: 'https://files.example/opaque-key'
    });
  });

  it.each(editCases)(
    '编辑 $extension 文件后上传副本并使用「修改版」命名',
    async ({ format, fileName, extension, operations }) => {
      const original = await fixtures[format]();
      const snapshot = Buffer.from(original);

      const result = await runWithFile(fileName, original, (sourceUrl) =>
        executor({
          call: makeCall({ action: 'edit', sourceUrl, operations }),
          messages: []
        })
      );

      expect(mockUploadChatFile).toHaveBeenCalledTimes(1);
      const upload = getUploadArgs();
      expect(upload.filename).toBe(`${fileName.replace(/\.[^.]+$/, '')}（修改版）.${extension}`);
      expect(upload.body).toBeInstanceOf(Buffer);
      expect(upload.body.length).toBeGreaterThan(0);
      expect(result.response).toContain('（修改版）');
      expect(result.metadata).toMatchObject({
        files: [{ format, name: upload.filename, size: upload.body.length }]
      });
      expect(original.equals(snapshot)).toBe(true);
    }
  );

  it('编辑 PPT 时把对话里的新图片替换进副本', async () => {
    const oldPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const newPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 21, 22, 23]);
    const deck = await generatePptx(
      {
        format: 'pptx',
        fileName: '图文汇报',
        slides: [
          {
            layout: 'image',
            title: '现场照片',
            image: { sourceUrl: 'https://files.example/old.png', caption: '旧图说明' }
          }
        ]
      },
      { loadImage: async () => ({ buffer: oldPng, extension: 'png' }) }
    );
    const zip = await JSZip.loadAsync(deck);
    const mediaPath = Object.keys(zip.files).find((name) =>
      /^ppt\/media\/image.*\.png$/.test(name)
    )!;
    const mediaName = mediaPath.slice(mediaPath.lastIndexOf('/') + 1);

    await runWithFiles(
      [
        { name: '图文汇报.pptx', buffer: deck },
        { name: '新图.png', buffer: newPng }
      ],
      async (urls) => {
        const result = await executor({
          call: makeCall({
            action: 'edit',
            sourceUrl: urls['图文汇报.pptx'],
            operations: [
              { op: 'replace_image', image: mediaName, sourceUrl: urls['新图.png'] }
            ]
          }),
          messages: []
        });
        expect(result.response).toContain('（修改版）');
      }
    );

    expect(mockUploadChatFile).toHaveBeenCalledTimes(1);
    const outputZip = await JSZip.loadAsync(getUploadArgs().body);
    expect(
      Buffer.compare(await outputZip.file(`ppt/media/${mediaName}`)!.async('nodebuffer'), newPng)
    ).toBe(0);
  });

  it('指定 outputName 时按新名称生成副本', async () => {
    await runWithFile('家长会通知.docx', await fixtures.docx(), (sourceUrl) =>
      executor({
        call: makeCall({
          action: 'edit',
          sourceUrl,
          outputName: '家长会通知定稿',
          operations: [{ op: 'append_paragraph', text: '请准时参加。' }]
        }),
        messages: []
      })
    );

    expect(getUploadArgs().filename).toBe('家长会通知定稿.docx');
  });

  it('部分成功时返回成功与跳过条数及原因', async () => {
    const result = await runWithFile('家长会通知.docx', await fixtures.docx(), (sourceUrl) =>
      executor({
        call: makeCall({
          action: 'edit',
          sourceUrl,
          operations: [
            { op: 'append_paragraph', text: '请准时参加。' },
            { op: 'set_table_cell', table: 0, row: 0, cell: 0, text: '不存在' }
          ]
        }),
        messages: []
      })
    );

    expect(mockUploadChatFile).toHaveBeenCalledTimes(1);
    expect(result.response).toContain('成功 1 处');
    expect(result.response).toContain('跳过 1 条');
    expect(result.response).toContain('第 0 个表格');
  });

  it('所有改动都未命中时不产出文件并给出可操作说明', async () => {
    const result = await runWithFile('办事说明.md', await fixtures.md(), (sourceUrl) =>
      executor({
        call: makeCall({
          action: 'edit',
          sourceUrl,
          operations: [{ op: 'replace_text', find: '不存在的文字', replace: '新文字' }]
        }),
        messages: []
      })
    );

    expect(result.response).toContain('没有找到与要求匹配的内容');
    expect(result.response).toContain('未生成新文件');
    expect(mockUploadChatFile).not.toHaveBeenCalled();
    expect(result.metadata).toBeUndefined();
  });

  it('不支持编辑的格式返回支持列表且不上传', async () => {
    const result = await runWithFile(
      '备注.txt',
      Buffer.from('纯文本', 'utf8'),
      (sourceUrl) =>
        executor({
          call: makeCall({
            action: 'edit',
            sourceUrl,
            operations: [{ op: 'replace_text', find: '纯文本', replace: '文本' }]
          }),
          messages: []
        })
    );

    expect(result.response).toContain('docx');
    expect(result.response).toContain('xlsx');
    expect(mockUploadChatFile).not.toHaveBeenCalled();
  });
});
