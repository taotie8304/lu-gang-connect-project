import { describe, expect, it, vi } from 'vitest';
import iconv from 'iconv-lite';

const MIB = 1024 * 1024;

// jsdom 环境下 t3-env 会把 worker 当客户端并拒绝读取服务端变量，这里直接给出常量。
vi.mock('@fastgpt/service/worker/env', () => ({
  workerEnv: {
    MAX_HTML_TRANSFORM_CHARS: 1000000,
    XLSX_PARSE_MAX_ROWS: 100000,
    XLSX_PARSE_MAX_COLUMNS: 1000,
    XLSX_PARSE_MAX_CELLS: 1000000,
    XLSX_PARSE_MAX_MERGED_CELLS: 1000000
  }
}));

// 用真实 html2md 替换 worker 边界，保证与重解析 worker 的输出逐字节一致。
vi.mock('@fastgpt/service/common/string/utils', async () => {
  const { html2md } = await import('@fastgpt/service/worker/htmlStr2Md/utils');
  return {
    htmlToMarkdown: async (html: string) => (await html2md(html)).rawText,
    htmlToMarkdownWithUploadFile: async (html: string, uploadFile?: any) =>
      (await html2md(html, { uploadFile })).rawText
  };
});

import {
  LIGHTWEIGHT_TEXT_PARSE_MAX_BYTES,
  isLightweightTextParse,
  readLightweightTextContent
} from '@fastgpt/service/common/file/read/lightweight';
import { html2md } from '@fastgpt/service/worker/htmlStr2Md/utils';

describe('common/file/read/lightweight 分流判定', () => {
  it('阈值固定为 4 MiB', () => {
    expect(LIGHTWEIGHT_TEXT_PARSE_MAX_BYTES).toBe(4 * MIB);
  });

  it.each(['html', 'HTML', '.html', 'txt', 'md'])('%s 进入轻量通道', (extension) => {
    expect(isLightweightTextParse({ extension, sizeBytes: 1024 })).toBe(true);
  });

  it.each(['htm', 'shtml', 'markdown', 'pdf', 'docx', 'xlsx', 'csv', 'pptx'])(
    '%s 保持重解析通道（worker 不支持或不是纯文本）',
    (extension) => {
      expect(isLightweightTextParse({ extension, sizeBytes: 1024 })).toBe(false);
    }
  );

  it('超过阈值时退回重解析通道', () => {
    expect(isLightweightTextParse({ extension: 'html', sizeBytes: 4 * MIB })).toBe(true);
    expect(isLightweightTextParse({ extension: 'html', sizeBytes: 4 * MIB + 1 })).toBe(false);
    expect(isLightweightTextParse({ extension: 'txt', sizeBytes: 8 * MIB })).toBe(false);
  });

  it('空扩展名不进入轻量通道', () => {
    expect(isLightweightTextParse({ extension: '', sizeBytes: 10 })).toBe(false);
  });
});

describe('common/file/read/lightweight readLightweightTextContent', () => {
  it('txt 复用重解析的编码解码逻辑', async () => {
    const buffer = iconv.encode('香港政府新聞公報', 'gb18030');

    const result = await readLightweightTextContent({
      extension: 'txt',
      buffer,
      encoding: 'gb18030'
    });

    expect(result.rawText).toBe('香港政府新聞公報');
  });

  it('md 原样返回解码后的文本', async () => {
    const result = await readLightweightTextContent({
      extension: 'md',
      buffer: Buffer.from('# 标题\n\n正文', 'utf-8'),
      encoding: 'utf-8'
    });

    expect(result.rawText).toBe('# 标题\n\n正文');
  });

  it('html 输出与重解析 worker 的 html2md 结果一致', async () => {
    const html = [
      '<html><head><style>.a{}</style><script>var a=1;</script></head>',
      '<body><h1>政策標題</h1><p>第一段</p><ul><li>要點一</li><li>要點二</li></ul></body></html>'
    ].join('');

    const result = await readLightweightTextContent({
      extension: 'html',
      buffer: Buffer.from(html, 'utf-8'),
      encoding: 'utf-8'
    });

    const expected = await html2md(html);
    expect(result.rawText).toBe(expected.rawText);
  });

  it('html 上传处理器透传到 html2md，base64 图片被替换为对象存储 key', async () => {
    const uploadFile = vi.fn(async () => ({ key: 'dataset/parsed/image.png' }));
    const html =
      '<p>文字</p><img src="data:image/png;base64,iVBORw0KGgo=" /><p>结尾</p>';

    const result = await readLightweightTextContent({
      extension: 'HTML',
      buffer: Buffer.from(html, 'utf-8'),
      encoding: 'utf-8',
      uploadFile
    });

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(result.rawText).toContain('dataset/parsed/image.png');
    expect(result.rawText).not.toContain('data:image/png;base64');
  });
});
