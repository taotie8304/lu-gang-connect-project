// 鲁港通 - 桌面端构建：esbuild 打包主进程与 preload，复制本地错误页
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  external: ['electron', '@jspawn/qpdf-wasm/qpdf.js'],
  absWorkingDir: root
};

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'main'), { recursive: true });
await mkdir(join(dist, 'preload'), { recursive: true });

await build({
  ...common,
  entryPoints: ['src/main/index.ts'],
  outfile: join(dist, 'main/index.cjs')
});
await build({
  ...common,
  entryPoints: ['src/preload/index.ts'],
  outfile: join(dist, 'preload/index.cjs')
});
await build({
  ...common,
  entryPoints: ['src/preload/tab.ts'],
  outfile: join(dist, 'preload/tab.cjs')
});
await build({
  ...common,
  entryPoints: ['src/preload/confirm.ts'],
  outfile: join(dist, 'preload/confirm.cjs')
});
await build({
  ...common,
  entryPoints: ['src/preload/formConfirm.ts'],
  outfile: join(dist, 'preload/formConfirm.cjs')
});
await cp(join(root, 'src/renderer'), join(dist, 'renderer'), { recursive: true });
// 鲁港通 - 托盘图标随 dist 分发（electron-builder files 只收录 dist 与 package.json）
await cp(join(root, 'build/icon.png'), join(dist, 'tray-icon.png'));
// 鲁港通 - qpdf-wasm 以 external 形式运行时加载，需把 js/wasm 副本放到 dist 内让 Node 解析
const qpdfSource = join(root, 'node_modules/@jspawn/qpdf-wasm');
const qpdfTarget = join(dist, 'main/node_modules/@jspawn/qpdf-wasm');
await mkdir(qpdfTarget, { recursive: true });
for (const file of ['package.json', 'qpdf.js', 'qpdf.wasm']) {
  await cp(join(qpdfSource, file), join(qpdfTarget, file));
}
// 鲁港通 - pdfjs 运行时资源（worker/cmaps/标准字体）必须随 dist 分发，否则 PDF 标签定位在安装包里不可用
const pdfjsSource = join(root, 'node_modules/pdfjs-dist');
const pdfjsTarget = join(dist, 'main/pdfjs');
await mkdir(join(pdfjsTarget, 'legacy/build'), { recursive: true });
await cp(join(pdfjsSource, 'legacy/build/pdf.worker.mjs'), join(pdfjsTarget, 'legacy/build/pdf.worker.mjs'));
await cp(join(pdfjsSource, 'cmaps'), join(pdfjsTarget, 'cmaps'), { recursive: true });
await cp(join(pdfjsSource, 'standard_fonts'), join(pdfjsTarget, 'standard_fonts'), { recursive: true });

console.log('[lugang-desktop] build complete');
