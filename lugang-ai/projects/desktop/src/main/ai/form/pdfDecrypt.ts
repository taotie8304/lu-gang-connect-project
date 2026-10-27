// 鲁港通 - 权限加密 PDF 本地解密：qpdf-wasm 在内存中去除加密，文件不出本机
const MAX_DECRYPT_BYTES = 80 * 1024 * 1024;

type QpdfModule = {
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
    unlink?: (path: string) => void;
  };
  callMain: (args: string[]) => number;
};

export class PdfDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfDecryptError';
  }
}

let qpdfPromise: Promise<QpdfModule> | undefined;
let fileSequence = 0;

const createQpdf = async (): Promise<QpdfModule> => {
  // 鲁港通 - 字面量子路径便于 esbuild 精确标记 external，运行期由 dist 内的 qpdf-wasm 副本解析
  const loaded = (await import('@jspawn/qpdf-wasm/qpdf.js')) as { default?: unknown };
  const factory = (loaded.default ?? loaded) as (
    options: Record<string, unknown>
  ) => Promise<QpdfModule>;

  // 鲁港通 - Emscripten 初始化时会用 fetch 取 wasm，Windows 路径没有 URL scheme 会直接失败；
  // 只需在同步初始化调用期间临时关掉，之后立即恢复
  const globalScope = globalThis as { fetch?: typeof fetch };
  const savedFetch = globalScope.fetch;
  globalScope.fetch = undefined;
  let init: Promise<QpdfModule>;
  try {
    init = factory({});
  } finally {
    globalScope.fetch = savedFetch;
  }
  return init;
};

const loadQpdf = (): Promise<QpdfModule> => {
  if (!qpdfPromise) {
    qpdfPromise = createQpdf().catch((error) => {
      qpdfPromise = undefined;
      throw error;
    });
  }
  return qpdfPromise;
};

export const decryptPdf = async (bytes: Uint8Array): Promise<Uint8Array> => {
  if (bytes.length > MAX_DECRYPT_BYTES) {
    throw new PdfDecryptError('PDF 文件过大，暂时无法在本地解密');
  }

  let qpdf: QpdfModule;
  try {
    qpdf = await loadQpdf();
  } catch {
    throw new PdfDecryptError('本地 PDF 解密组件加载失败');
  }

  fileSequence += 1;
  const stamp = `${Date.now()}-${fileSequence}`;
  const input = `/in-${stamp}.pdf`;
  const output = `/out-${stamp}.pdf`;

  try {
    qpdf.FS.writeFile(input, bytes);
    const code = qpdf.callMain(['--no-warn', '--decrypt', input, output]);
    // qpdf 退出码 3 表示成功但有警告（原文件 xref 不规范时的常见情况）
    if (code !== 0 && code !== 3) {
      throw new PdfDecryptError(`PDF 解密失败（${code}）`);
    }
    return qpdf.FS.readFile(output);
  } catch (error) {
    if (error instanceof PdfDecryptError) throw error;
    throw new PdfDecryptError('PDF 解密失败');
  } finally {
    for (const path of [input, output]) {
      try {
        qpdf.FS.unlink?.(path);
      } catch {
        // 清理失败不影响结果
      }
    }
  }
};
