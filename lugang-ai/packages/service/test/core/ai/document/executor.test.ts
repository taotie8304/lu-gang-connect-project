// @vitest-environment node
import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUploadChatFile = vi.hoisted(() => vi.fn());
const mockGetS3ChatSource = vi.hoisted(() => vi.fn(() => ({ uploadChatFile: mockUploadChatFile })));

vi.mock('@fastgpt/service/common/s3/sources/chat', () => ({
  getS3ChatSource: mockGetS3ChatSource
}));

import { ChatFileTypeEnum } from '@fastgpt/global/core/chat/constants';
import { createDocumentOperationExecutor } from '@fastgpt/service/core/ai/document/executor';
import { generateDocx } from '@fastgpt/service/core/ai/document/generate/docx';
import { createDocumentOperationTool } from '@fastgpt/service/core/ai/llm/agentLoop/interface';
import { getToolsForFastAgentLoop } from '@fastgpt/service/core/ai/llm/agentLoop/provider/fastAgent/tools';
import { createAgentLoopCoreSystemTools } from '@fastgpt/service/core/workflow/dispatch/ai/agentLoopCore/application/runtime/systemTools';
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

const DOCX_URL = 'https://files.example/upload.docx';
const PNG_URL = 'https://files.example/diagram.png';
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const buildFileContext = (params: {
  url: string;
  filename: string;
  buffer: Buffer;
}): WorkflowFileContext => {
  const ref: WorkflowFileRef = {
    name: params.filename,
    type: ChatFileTypeEnum.file,
    modelUrl: params.url,
    source: { type: 'externalHttp', url: params.url }
  };
  return {
    limits: { maxFileAmount: 5, maxBytesPerFile: 20 * 1024 * 1024 },
    resolve: (url: string) => (url === params.url ? ref : undefined),
    getSource: async () => ({
      source: {
        kind: 'externalHttp' as const,
        maxSizeBytes: 20 * 1024 * 1024,
        metadata: { filename: params.filename },
        materialize: async () => ({ buffer: params.buffer, metadata: { filename: params.filename } })
      },
      sourceKind: 'internal' as const
    })
  } as unknown as WorkflowFileContext;
};

const runWithDocxFile = async <T>(fn: () => Promise<T>): Promise<T> => {
  const buffer = await generateDocx({
    format: 'docx',
    fileName: '家长会通知',
    title: '家长会通知',
    blocks: [
      { type: 'paragraph', text: '尊敬的家长：' },
      { type: 'paragraph', text: '本周五下午召开家长会。' }
    ]
  });
  const ref: WorkflowFileRef = {
    name: '家长会通知.docx',
    type: ChatFileTypeEnum.file,
    modelUrl: DOCX_URL,
    source: { type: 'externalHttp', url: DOCX_URL }
  };
  const fileContext = {
    limits: { maxFileAmount: 5, maxBytesPerFile: 20 * 1024 * 1024 },
    resolve: (url: string) => (url === DOCX_URL ? ref : undefined),
    getSource: async () => ({
      source: {
        kind: 'externalHttp' as const,
        maxSizeBytes: 20 * 1024 * 1024,
        metadata: { filename: '家长会通知.docx' },
        materialize: async () => ({ buffer, metadata: { filename: '家长会通知.docx' } })
      },
      sourceKind: 'internal' as const
    })
  } as unknown as WorkflowFileContext;

  return runWithContext({ mcpClientMemory: {}, fileContext }, fn);
};

const runWithImageFile = async <T>(fn: () => Promise<T>): Promise<T> => {
  const fileContext = buildFileContext({
    url: PNG_URL,
    filename: '示意图.png',
    buffer: PNG_1PX
  });
  return runWithContext({ mcpClientMemory: {}, fileContext }, fn);
};

describe('createDocumentOperationExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadChatFile.mockResolvedValue({
      key: 'chat/app/source/uid/chat/opaque-key',
      accessUrl: 'https://files.example/opaque-key'
    });
  });

  it('生成 Markdown 后只上传一次，返回文件卡片元数据与 3 天保留时间', async () => {
    const result = await executor({
      call: makeCall({
        action: 'generate',
        format: 'md',
        fileName: '香港 办事/指南',
        content: '# 香港办事指南\n\n携带有效旅行证件前往人事登记办事处。'
      }),
      messages: []
    });

    expect(mockUploadChatFile).toHaveBeenCalledTimes(1);
    expect(getUploadArgs()).toMatchObject({
      sourceType: 'app',
      sourceId: SOURCE_ID,
      chatId: 'chat-1',
      uId: 'uid-1',
      filename: '香港 办事指南.md',
      contentType: 'text/markdown; charset=utf-8'
    });

    const retentionDays = (getUploadArgs().expiredTime.getTime() - Date.now()) / 86400000;
    expect(retentionDays).toBeGreaterThan(2.9);
    expect(retentionDays).toBeLessThan(3.1);

    expect(result.response).toContain('香港 办事指南.md');
    expect(result.usages).toEqual([]);
    expect(result.metadata).toEqual({
      files: [
        {
          key: 'chat/app/source/uid/chat/opaque-key',
          name: '香港 办事指南.md',
          format: 'md',
          size: expect.any(Number)
        }
      ]
    });
  });

  it('生成 Excel 时使用 sheets 内容并按格式补扩展名', async () => {
    const result = await executor({
      call: makeCall({
        action: 'generate',
        format: 'xlsx',
        fileName: '人员名单',
        sheets: [{ name: '名单', header: ['姓名'], rows: [['张三']] }]
      }),
      messages: []
    });

    expect(mockUploadChatFile).toHaveBeenCalledTimes(1);
    expect(getUploadArgs()).toMatchObject({
      filename: '人员名单.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    expect(result.metadata).toMatchObject({
      files: [{ name: '人员名单.xlsx', format: 'xlsx', size: expect.any(Number) }]
    });
  });

  it('生成图文 PPT 时从本次对话文件读取图片并打进演示文稿', async () => {
    const result = await runWithImageFile(() =>
      executor({
        call: makeCall({
          action: 'generate',
          format: 'pptx',
          fileName: '图文演示',
          slides: [{ layout: 'image', title: '图示页', image: { sourceUrl: PNG_URL } }]
        }),
        messages: []
      })
    );

    expect(result.metadata).toMatchObject({
      files: [{ name: '图文演示.pptx', format: 'pptx', size: expect.any(Number) }]
    });
    const body = getUploadArgs().body as Buffer;
    const zip = await JSZip.loadAsync(body);
    expect(Object.keys(zip.files).some((name) => /^ppt\/media\/image.*\.png$/.test(name))).toBe(
      true
    );
  });

  it('同一对话重复生成同名文件时自动追加序号', async () => {
    const generate = () =>
      executor({
        call: makeCall({ action: 'generate', format: 'md', fileName: '重复文件', content: '正文' }),
        messages: []
      });

    await generate();
    await generate();

    expect(getUploadArgs(0).filename).toBe('重复文件.md');
    expect(getUploadArgs(1).filename).toBe('重复文件(2).md');
  });

  it.each(['read', 'edit'] as const)(
    '没有对话文件上下文时 %s 返回可操作的中文说明且不上传',
    async (action) => {
      const result = await executor({
        call: makeCall(
          action === 'read'
            ? { action, sourceUrl: 'https://files.example/upload.docx' }
            : {
                action,
                sourceUrl: 'https://files.example/upload.docx',
                operations: [{ op: 'append_paragraph', text: '补充说明' }]
              }
        ),
        messages: []
      });

      expect(result.response).toContain('只能修改本次对话里上传的文件');
      expect(mockUploadChatFile).not.toHaveBeenCalled();
    }
  );

  it('读取本次对话文件时返回可定位的提纲', async () => {
    const result = await runWithDocxFile(() =>
      executor({
        call: makeCall({ action: 'read', sourceUrl: DOCX_URL }),
        messages: []
      })
    );

    expect(result.response).toContain('家长会通知.docx');
    expect(result.response).toContain('[0]');
    expect(result.response).toContain('尊敬的家长：');
    expect(mockUploadChatFile).not.toHaveBeenCalled();
  });

  it('格式与内容字段不匹配时返回 schema 的具体提示', async () => {
    const result = await executor({
      call: makeCall({
        action: 'generate',
        format: 'xlsx',
        fileName: '错误示例',
        content: '纯文本'
      }),
      messages: []
    });

    expect(result.response).toContain('生成 Excel 需要用 sheets');
    expect(mockUploadChatFile).not.toHaveBeenCalled();
  });
});

describe('document tool provider wiring', () => {
  it('未注入 document 时不注册工具，注入后 fastAgent 目录包含该工具', () => {
    const withoutDocument = getToolsForFastAgentLoop({ catalog: { runtimeTools: [] } });
    expect(
      withoutDocument.some((tool) => tool.function.name === 'document_operation')
    ).toBe(false);

    const systemTools = createAgentLoopCoreSystemTools({
      planEnabled: false,
      askEnabled: false
    });
    expect(systemTools.document).toBeUndefined();

    const withDocument = getToolsForFastAgentLoop({
      catalog: {
        runtimeTools: [],
        documentTool: createDocumentOperationTool()
      }
    });
    expect(
      withDocument.filter((tool) => tool.function.name === 'document_operation')
    ).toHaveLength(1);

    const injected = createAgentLoopCoreSystemTools({
      planEnabled: false,
      askEnabled: false,
      document: { enabled: true, execute: executor }
    });
    expect(injected.document?.enabled).toBe(true);
  });
});
