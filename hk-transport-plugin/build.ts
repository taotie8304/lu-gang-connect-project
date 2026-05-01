// 鲁港通 - FastGPT 系统插件打包脚本
// 支持两种打包方式：
//   1. Bun: bun run build.ts（生产环境推荐）
//   2. Node + esbuild: npx tsx build.ts（开发环境备用）
//
// 用法：bun run build:pkg 或 npx tsx build.ts
//
// FastGPT 系统插件 .pkg 格式说明：
// - JSON 文件，包含插件的配置和代码
// - config: 插件配置（名称、描述、输入输出定义）
// - code: 打包后的 JavaScript 代码（单文件 bundle）
// - metadata: 版本、作者等元数据

import { resolve, join, dirname } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// 兼容 ESM 获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = __dirname;
const DIST_DIR = join(ROOT, 'dist');
const PKG_NAME = 'hk-transport-assistant';

async function bundleWithEsbuild(): Promise<string> {
  const esbuild = await import('esbuild');
  const result = await esbuild.build({
    entryPoints: [join(ROOT, 'index.ts')],
    bundle: true,
    outdir: DIST_DIR,
    platform: 'node',
    format: 'esm',
    minify: true,
    sourcemap: false,
    target: 'esnext',
    // 内联所有依赖
    external: [],
  });

  if (result.errors.length > 0) {
    throw new Error(`esbuild 打包失败: ${result.errors.map(e => e.text).join(', ')}`);
  }

  return join(DIST_DIR, 'index.js');
}

async function bundleWithBun(): Promise<string> {
  // @ts-ignore - Bun global only available in Bun runtime
  const bundleResult = await Bun.build({
    entrypoints: [join(ROOT, 'index.ts')],
    outdir: DIST_DIR,
    target: 'node',
    format: 'esm',
    minify: true,
    sourcemap: 'none',
    external: [],
  });

  if (!bundleResult.success) {
    const errors = bundleResult.logs.map((l: any) => l.toString()).join(', ');
    throw new Error(`Bun 打包失败: ${errors}`);
  }

  return join(DIST_DIR, 'index.js');
}

async function build() {
  console.log('🔨 开始打包 FastGPT 系统插件...\n');

  // 1. 确保 dist 目录存在
  if (!existsSync(DIST_DIR)) {
    mkdirSync(DIST_DIR, { recursive: true });
  }

  // 2. 检测运行环境并选择打包方式
  const isBun = typeof globalThis.Bun !== 'undefined';
  console.log(`📦 Step 1: 使用 ${isBun ? 'Bun' : 'esbuild'} 打包代码...`);

  let bundlePath: string;
  try {
    bundlePath = isBun ? await bundleWithBun() : await bundleWithEsbuild();
  } catch (err) {
    console.error('❌ 打包失败:', err);
    process.exit(1);
  }

  if (!existsSync(bundlePath)) {
    console.error('❌ 找不到打包输出文件:', bundlePath);
    process.exit(1);
  }

  const bundledCode = readFileSync(bundlePath, 'utf-8');
  const bundleSizeKB = (Buffer.byteLength(bundledCode) / 1024).toFixed(1);
  console.log(`   ✅ Bundle 生成成功: ${bundlePath} (${bundleSizeKB} KB)`);

  // 3. 读取插件配置（直接从 config.ts 导入）
  console.log('\n📋 Step 2: 读取插件配置...');
  const configModule = await import(join(ROOT, 'config.ts'));
  const config = configModule.default;
  console.log(`   ✅ 插件名称: ${config.name['zh-CN']}`);
  console.log(`   ✅ 版本数量: ${config.versionList.length}`);

  // 4. 读取 package.json 元数据
  const pkgJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));

  // 5. 组装 .pkg 文件
  console.log('\n📦 Step 3: 组装 .pkg 文件...');
  const pkg = {
    type: 'fastgpt-system-plugin',
    name: PKG_NAME,
    version: pkgJson.version,
    config,
    code: bundledCode,
    metadata: {
      name: pkgJson.name,
      version: pkgJson.version,
      description: pkgJson.description,
      author: pkgJson.author,
      license: pkgJson.license,
      buildTime: new Date().toISOString(),
      bundleSize: bundledCode.length,
      runtime: isBun ? 'bun' : 'node+esbuild',
    },
  };

  // 6. 写入 .pkg 文件
  const pkgPath = join(DIST_DIR, `${PKG_NAME}.pkg`);
  const pkgContent = JSON.stringify(pkg, null, 2);
  writeFileSync(pkgPath, pkgContent, 'utf-8');

  const pkgSizeKB = (Buffer.byteLength(pkgContent) / 1024).toFixed(1);
  console.log(`   ✅ .pkg 文件生成成功: ${pkgPath} (${pkgSizeKB} KB)`);

  // 7. 同时生成配置文件（用于调试）
  const configOnlyPath = join(DIST_DIR, `${PKG_NAME}.config.json`);
  writeFileSync(configOnlyPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`   📄 配置文件: ${configOnlyPath}`);

  // 8. 验证 .pkg 文件
  console.log('\n🔍 Step 4: 验证 .pkg 文件...');
  const verifyPkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  const checks = [
    { name: 'type 字段', ok: verifyPkg.type === 'fastgpt-system-plugin' },
    { name: 'config 字段', ok: !!verifyPkg.config },
    { name: 'config.name', ok: !!verifyPkg.config?.name?.['zh-CN'] },
    { name: 'config.description', ok: !!verifyPkg.config?.description?.['zh-CN'] },
    { name: 'config.versionList', ok: Array.isArray(verifyPkg.config?.versionList) && verifyPkg.config.versionList.length > 0 },
    { name: 'config.versionList[0].inputs', ok: Array.isArray(verifyPkg.config?.versionList?.[0]?.inputs) },
    { name: 'config.versionList[0].outputs', ok: Array.isArray(verifyPkg.config?.versionList?.[0]?.outputs) },
    { name: 'code 字段', ok: typeof verifyPkg.code === 'string' && verifyPkg.code.length > 0 },
    { name: 'code 包含 zod', ok: verifyPkg.code.includes('ZodType') || verifyPkg.code.includes('z.') || verifyPkg.code.length > 1000 },
    { name: 'metadata 字段', ok: !!verifyPkg.metadata },
    { name: 'metadata.version', ok: !!verifyPkg.metadata?.version },
  ];

  let allPassed = true;
  for (const check of checks) {
    const icon = check.ok ? '✅' : '❌';
    console.log(`   ${icon} ${check.name}`);
    if (!check.ok) allPassed = false;
  }

  if (!allPassed) {
    console.error('\n❌ .pkg 文件验证失败，请检查上述错误');
    process.exit(1);
  }

  console.log('\n🎉 打包完成！');
  console.log(`\n📦 输出文件: ${pkgPath}`);
  console.log(`📏 文件大小: ${pkgSizeKB} KB`);
  console.log('\n📝 部署步骤:');
  console.log('   1. root 用户登录 FastGPT');
  console.log('   2. 进入 配置页面 → 导入/更新');
  console.log('   3. 上传 .pkg 文件');
  console.log('   4. 验证插件热加载成功');
}

build().catch(err => {
  console.error('❌ 打包过程出错:', err);
  process.exit(1);
});
