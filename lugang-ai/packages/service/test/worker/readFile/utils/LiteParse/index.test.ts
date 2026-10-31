import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLiteParseInit, mockLiteParseParse, mockLiteParseFree, mockLiteParseConstructor } =
  vi.hoisted(() => ({
    mockLiteParseInit: vi.fn(),
    mockLiteParseParse: vi.fn(),
    mockLiteParseFree: vi.fn(),
    mockLiteParseConstructor: vi.fn()
  }));

vi.mock('@llamaindex/liteparse-wasm', () => ({
  default: mockLiteParseInit,
  LiteParse: vi.fn(function MockLiteParse(config) {
    mockLiteParseConstructor(config);
    return {
      parse: mockLiteParseParse,
      free: mockLiteParseFree
    };
  })
}));

import { readPdfByLiteParse } from '@fastgpt/service/worker/readFile/utils/LiteParse';

describe('readPdfByLiteParse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('分批使用 LiteParse，并对全部 textItems 做统一后处理', async () => {
    mockLiteParseParse
      .mockResolvedValueOnce({
        text: 'fallback text 1',
        pages: [
          {
            pageNum: 1,
            width: 1000,
            height: 1000,
            text: '',
            textItems: [
              {
                text: '人工智能正在快速发展并进入规模化落地阶段',
                x: 80,
                y: 100,
                width: 240,
                height: 12
              }
            ]
          }
        ]
      })
      .mockResolvedValueOnce({
        text: 'fallback text 2',
        pages: [
          {
            pageNum: 101,
            width: 1000,
            height: 1000,
            text: '',
            textItems: [{ text: '并推动产业升级。', x: 80, y: 120, width: 96, height: 12 }]
          }
        ]
      })
      .mockResolvedValueOnce({
        text: '',
        pages: []
      });

    const result = await readPdfByLiteParse({
      extension: 'pdf',
      encoding: 'utf-8',
      buffer: Buffer.from('pdf')
    });

    expect(result.rawText).toBe('人工智能正在快速发展并进入规模化落地阶段并推动产业升级。\n');
    expect(mockLiteParseParse).toHaveBeenCalledTimes(3);
    expect(mockLiteParseInit).toHaveBeenCalledTimes(1);
    expect(mockLiteParseFree).toHaveBeenCalledTimes(3);
    expect(mockLiteParseConstructor.mock.calls.map(([config]) => config.targetPages)).toEqual([
      '1-100',
      '101-200',
      '201-300'
    ]);
  });

  it('WASM 解析失败时仍释放 parser', async () => {
    const error = new Error('invalid PDF');
    mockLiteParseParse.mockRejectedValueOnce(error);

    await expect(
      readPdfByLiteParse({
        extension: 'pdf',
        encoding: 'utf-8',
        buffer: Buffer.from('invalid pdf')
      })
    ).rejects.toThrow(error);

    expect(mockLiteParseFree).toHaveBeenCalledTimes(1);
  });

  it('未传 OCR 回调时保持 LiteParse OCR 关闭', async () => {
    mockLiteParseParse.mockResolvedValueOnce({ pages: [] });

    await readPdfByLiteParse({
      extension: 'pdf',
      encoding: 'utf-8',
      buffer: Buffer.from('pdf')
    });

    const [config] = mockLiteParseConstructor.mock.calls[0];
    expect(config.ocrEnabled).toBe(false);
    expect(config.ocrEngine).toBeUndefined();
  });

  it('传入 OCR 回调时开启 OCR 并按行注入 ocrEngine', async () => {
    mockLiteParseParse.mockResolvedValueOnce({ pages: [] });
    const ocr = vi.fn().mockResolvedValue('第一行文字\n第二行文字');

    await readPdfByLiteParse(
      {
        extension: 'pdf',
        encoding: 'utf-8',
        buffer: Buffer.from('pdf')
      },
      { ocr }
    );

    const [config] = mockLiteParseConstructor.mock.calls[0];
    expect(config.ocrEnabled).toBe(true);
    expect(config.ocrEngine).toBeDefined();

    const imageData = new Uint8Array([1, 2, 3]);
    const blocks = await config.ocrEngine.recognize(imageData, 300, 200, 'chi_sim');

    expect(ocr).toHaveBeenCalledWith({ imageData, width: 300, height: 200 });
    expect(blocks).toEqual([
      { text: '第一行文字', bbox: [0, 0, 300, 100], confidence: 1 },
      { text: '第二行文字', bbox: [0, 100, 300, 200], confidence: 1 }
    ]);
  });

  it('OCR 回调返回空文本时不产出文本块', async () => {
    mockLiteParseParse.mockResolvedValueOnce({ pages: [] });
    const ocr = vi.fn().mockResolvedValue('   ');

    await readPdfByLiteParse(
      {
        extension: 'pdf',
        encoding: 'utf-8',
        buffer: Buffer.from('pdf')
      },
      { ocr }
    );

    const [config] = mockLiteParseConstructor.mock.calls[0];
    await expect(config.ocrEngine.recognize(new Uint8Array([1]), 100, 100)).resolves.toEqual([]);
  });
});
