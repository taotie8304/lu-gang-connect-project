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
  external: ['electron'],
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
await cp(join(root, 'src/renderer'), join(dist, 'renderer'), { recursive: true });

console.log('[lugang-desktop] build complete');
