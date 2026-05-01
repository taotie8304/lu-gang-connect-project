// 鲁港通 - FastGPT 系统插件打包脚本 (Node.js 版本)
// 使用 esbuild 将插件编译为单一 .pkg 文件
//
// 用法：node build.mjs
//
// FastGPT 系统插件 .pkg 格式：
// - JSON 文件，包含插件的配置和代码
// - config: 插件配置（名称、描述、输入输出定义）
// - code: 打包后的 JavaScript 代码（单文件 bundle）
// - metadata: 版本、作者等元数据

import { join, dirname } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { build as esbuildBuild } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = __dirname;
const DIST_DIR = join(ROOT, 'dist');
const PKG_NAME = 'hk-transport-assistant';

async function build() {
  console.log('🔨 开始打包 FastGPT 系统插件...\n');

  // 1. 确保 dist 目录存在
  if (!existsSync(DIST_DIR)) {
    mkdirSync(DIST_DIR, { recursive: true });
  }

  // 2. 使用 esbuild 打包
  console.log('📦 Step 1: 使用 esbuild 打包代码...');
  const result = await esbuildBuild({
    entryPoints: [join(ROOT, 'index.ts')],
    bundle: true,
    outdir: DIST_DIR,
    platform: 'node',
    format: 'esm',
    minify: true,
    sourcemap: false,
    target: 'esnext',
    external: [],
  });

  if (result.errors.length > 0) {
    console.error('❌ 打包失败:', result.errors);
    process.exit(1);
  }

  const bundlePath = join(DIST_DIR, 'index.js');
  if (!existsSync(bundlePath)) {
    console.error('❌ 找不到打包输出文件:', bundlePath);
    process.exit(1);
  }

  const bundledCode = readFileSync(bundlePath, 'utf-8');
  const bundleSizeKB = (Buffer.byteLength(bundledCode) / 1024).toFixed(1);
  console.log(`   ✅ Bundle 生成成功 (${bundleSizeKB} KB)`);

  // 3. 构建插件配置（与 config.ts 保持一致）
  console.log('\n📋 Step 2: 构建插件配置...');

  const WorkflowIOValueTypeEnum = {
    string: 'string', number: 'number', boolean: 'boolean',
    object: 'object', arrayString: 'arrayString', arrayObject: 'arrayObject',
    any: 'any',
  };
  const FlowNodeInputTypeEnum = {
    reference: 'reference', input: 'input', select: 'select',
  };
  const ToolTagEnum = { tools: 'tools' };

  const config = {
    tags: [ToolTagEnum.tools],
    name: {
      'zh-CN': '香港智能交通助手',
      'zh-Hant': '香港智能交通助手',
      en: 'HK Smart Transport Assistant',
    },
    description: {
      'zh-CN': '根据用户问题智能查询香港公共交通路线、实时到站时间、费用和付款方式。支持巴士（KMB/CTB/NLB）、小巴（GMB）、港铁（MTR）等。',
      'zh-Hant': '根據用戶問題智能查詢香港公共交通路線、實時到站時間、費用和付款方式。支持巴士（KMB/CTB/NLB）、小巴（GMB）、港鐵（MTR）等。',
      en: 'Intelligently query HK public transport routes, real-time ETA, fares and payment. Supports KMB, CTB, NLB, GMB, MTR.',
    },
    toolDescription: {
      'zh-CN': '查询香港公共交通路线和实时到站时间的工具，输入交通问题即可获得路线方案、到站时间、费用和出行建议',
      en: 'Tool for querying HK public transport routes and real-time ETA.',
    },
    versionList: [{
      value: '0.1.0',
      description: 'Initial version',
      inputs: [
        {
          renderTypeList: [FlowNodeInputTypeEnum.reference, FlowNodeInputTypeEnum.input],
          selectedTypeIndex: 0,
          valueType: WorkflowIOValueTypeEnum.string,
          key: 'question',
          label: '用户问题',
          description: '用户的交通问题，如"从落马洲口岸到香港立法会怎么走"',
          required: true,
          toolDescription: '用户询问的香港交通路线问题',
        },
        {
          renderTypeList: [FlowNodeInputTypeEnum.select],
          selectedTypeIndex: 0,
          valueType: WorkflowIOValueTypeEnum.string,
          key: 'language',
          label: '语言',
          description: '返回数据的语言',
          required: false,
          defaultValue: 'zh-CN',
        },
      ],
      outputs: [
        { valueType: WorkflowIOValueTypeEnum.arrayObject, key: 'routes', label: '路线方案', description: '推荐的路线方案列表' },
        { valueType: WorkflowIOValueTypeEnum.arrayObject, key: 'stopETAs', label: '站点到站时间', description: '站点实时到站时间列表' },
        { valueType: WorkflowIOValueTypeEnum.object, key: 'paymentInfo', label: '付款信息', description: '付款方式和费用信息' },
        { valueType: WorkflowIOValueTypeEnum.arrayString, key: 'tips', label: '注意事项', description: '出行建议和注意事项' },
        { valueType: WorkflowIOValueTypeEnum.object, key: 'metadata', label: '元数据', description: '数据时间戳和 API 调用状态' },
      ],
    }],
  };

  console.log(`   ✅ 插件名称: ${config.name['zh-CN']}`);

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
      runtime: 'node+esbuild',
    },
  };

  const pkgPath = join(DIST_DIR, `${PKG_NAME}.pkg`);
  const pkgContent = JSON.stringify(pkg, null, 2);
  writeFileSync(pkgPath, pkgContent, 'utf-8');

  const pkgSizeKB = (Buffer.byteLength(pkgContent) / 1024).toFixed(1);
  console.log(`   ✅ .pkg 文件生成成功 (${pkgSizeKB} KB)`);

  // 6. 生成配置文件（调试用）
  writeFileSync(join(DIST_DIR, `${PKG_NAME}.config.json`), JSON.stringify(config, null, 2), 'utf-8');

  // 7. 验证 .pkg 文件
  console.log('\n🔍 Step 4: 验证 .pkg 文件...');
  const verifyPkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  const checks = [
    { name: 'type 字段', ok: verifyPkg.type === 'fastgpt-system-plugin' },
    { name: 'config.name', ok: !!verifyPkg.config?.name?.['zh-CN'] },
    { name: 'config.description', ok: !!verifyPkg.config?.description?.['zh-CN'] },
    { name: 'config.versionList', ok: Array.isArray(verifyPkg.config?.versionList) && verifyPkg.config.versionList.length > 0 },
    { name: 'inputs 定义', ok: Array.isArray(verifyPkg.config?.versionList?.[0]?.inputs) && verifyPkg.config.versionList[0].inputs.length === 2 },
    { name: 'outputs 定义', ok: Array.isArray(verifyPkg.config?.versionList?.[0]?.outputs) && verifyPkg.config.versionList[0].outputs.length === 5 },
    { name: 'code 字段', ok: typeof verifyPkg.code === 'string' && verifyPkg.code.length > 100 },
    { name: 'metadata', ok: !!verifyPkg.metadata?.version },
  ];

  let allPassed = true;
  for (const check of checks) {
    const icon = check.ok ? '✅' : '❌';
    console.log(`   ${icon} ${check.name}`);
    if (!check.ok) allPassed = false;
  }

  if (!allPassed) {
    console.error('\n❌ .pkg 文件验证失败');
    process.exit(1);
  }

  console.log('\n🎉 打包完成！');
  console.log(`📦 输出: ${pkgPath} (${pkgSizeKB} KB)`);
  console.log('\n📝 部署: root 登录 FastGPT → 配置页面 → 导入/更新 → 上传 .pkg 文件');
}

build().catch(err => {
  console.error('❌ 打包出错:', err);
  process.exit(1);
});
