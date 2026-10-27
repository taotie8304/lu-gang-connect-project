// 鲁港通 - @jspawn/qpdf-wasm 未随包提供类型，这里只声明用到的 Emscripten 子集
declare module '@jspawn/qpdf-wasm/qpdf.js' {
  type QpdfModule = {
    FS: {
      writeFile: (path: string, data: Uint8Array) => void;
      readFile: (path: string) => Uint8Array;
      unlink?: (path: string) => void;
    };
    callMain: (args: string[]) => number;
  };

  const factory: (options: Record<string, unknown>) => Promise<QpdfModule>;
  export default factory;
}
