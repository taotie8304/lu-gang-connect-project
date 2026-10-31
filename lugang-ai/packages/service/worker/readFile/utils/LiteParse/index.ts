import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  type OcrPageHandler,
  type ReadFileOptions,
  type ReadFileResponse,
  type ReadRawTextByBuffer,
  type ParsedPage
} from '../../type';
import { postprocessPdfPages } from '../pdf/pdfTextPostprocess';

const LITE_PARSE_MAX_PAGES = 100000;
const LITE_PARSE_BATCH_PAGES = 100;
const workerRequire = createRequire(path.join(process.cwd(), 'worker', 'readFile.js'));

type LiteParseWasmModule = typeof import('@llamaindex/liteparse-wasm');
let liteParseWasmModulePromise: Promise<LiteParseWasmModule> | undefined;

type OcrTextBlock = {
  text: string;
  bbox: [number, number, number, number];
  confidence: number;
};

/**
 * 在当前 worker 内初始化并复用一份 LiteParse WASM 实例。
 *
 * 官方包默认通过 fetch 加载相邻的 wasm 文件，Node 不支持直接 fetch file URL，因此显式
 * 从 worker 运行时依赖目录读取字节。每个 worker_thread 有独立的模块实例和线性内存，
 * 避免多个线程共享 native PDFium 全局状态。
 */
const loadLiteParseWasm = () => {
  if (liteParseWasmModulePromise) return liteParseWasmModulePromise;

  liteParseWasmModulePromise = (async () => {
    try {
      const wasmModule = await import('@llamaindex/liteparse-wasm');
      const wasmPath = workerRequire.resolve('@llamaindex/liteparse-wasm/liteparse_wasm_bg.wasm');
      const wasmBytes = await readFile(wasmPath);
      await wasmModule.default({ module_or_path: wasmBytes });
      return wasmModule;
    } catch (error) {
      liteParseWasmModulePromise = undefined;
      throw new Error('LiteParse WASM initialization failed', { cause: error });
    }
  })();

  return liteParseWasmModulePromise;
};

/**
 * 鲁港通 - 把 OCR 文本按行包装成带坐标的文本块。
 *
 * postprocessPdfPages 依赖 textItems 的行内坐标做排序与换行合并，整页一个文本块会被
 * 当成单行吞掉；这里按行均匀分布纵向坐标，保持后处理链路行为一致。
 */
const buildOcrBlocks = (
  text: string | undefined,
  width: number,
  height: number
): OcrTextBlock[] => {
  const lines = (text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const lineHeight = height > 0 ? height / lines.length : 0;

  return lines.map((line, index) => ({
    text: line,
    bbox: [0, index * lineHeight, width, (index + 1) * lineHeight] as [
      number,
      number,
      number,
      number
    ],
    confidence: 1
  }));
};

/**
 * 鲁港通 - 组装 LiteParse 的 OCR 引擎适配器，识别动作由主线程视觉模型完成。
 */
const createOcrEngine = (ocr: OcrPageHandler) => ({
  recognize: async (imageData: Uint8Array, width: number, height: number) => {
    const text = await ocr({ imageData, width, height });
    return buildOcrBlocks(text, width, height);
  }
});

/**
 * 使用 LiteParse WASM 解析 PDF 文本。
 *
 * 未传入 OCR 回调时关闭 OCR，避免普通系统解析路径产生额外耗时和 OCR 资源依赖；
 * 传入后由主线程视觉模型识别扫描页文字。PDF 按页分批解析，降低 PDFium/WASM 一次性
 * 持有大量页面结构的内存峰值；最后仍统一后处理全部 pages，保持现有文本清理行为。
 */
export const readPdfByLiteParse = async (
  { buffer }: ReadRawTextByBuffer,
  options: ReadFileOptions = {}
): Promise<ReadFileResponse> => {
  const { LiteParse } = await loadLiteParseWasm();
  const pages: ParsedPage[] = [];
  const ocrEngine = options.ocr ? createOcrEngine(options.ocr) : undefined;

  for (let pageStart = 1; pageStart <= LITE_PARSE_MAX_PAGES; pageStart += LITE_PARSE_BATCH_PAGES) {
    const pageEnd = pageStart + LITE_PARSE_BATCH_PAGES - 1;
    const parser = new LiteParse({
      ocrEnabled: Boolean(ocrEngine),
      ...(ocrEngine ? { ocrEngine } : {}),
      maxPages: LITE_PARSE_MAX_PAGES,
      targetPages: `${pageStart}-${pageEnd}`,
      quiet: true
    });
    const result = await (async () => {
      try {
        return await parser.parse(buffer);
      } finally {
        parser.free();
      }
    })();

    if (!result.pages.length) break;

    pages.push(...result.pages);
  }

  const rawText = postprocessPdfPages(pages);

  return {
    rawText
  };
};
