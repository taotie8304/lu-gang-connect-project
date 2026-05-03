// 鲁港通 - FastGPT 系统插件打包脚本
//
// 依据 fastgpt-plugin 官方源码 modules/tool/build/build.ts 的逻辑：
// 1. 用 esbuild 将 TypeScript 编译为 CJS 的 index.js（module.exports = { toolId, cb, ... }）
// 2. 用 JSZip 把 index.js + logo.svg 打包成 zip 文件，扩展名为 .pkg
// 3. 服务端 unpkg() 解压后 import(index.js).default 得到工具定义
//
// 参考：https://github.com/labring/fastgpt-plugin/blob/main/modules/tool/build/build.ts

import { join, dirname } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { build as esbuildBuild } from 'esbuild';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = __dirname;
const DIST_DIR = join(ROOT, 'dist');
const CACHE_DIR = join(DIST_DIR, '.cache');
// 注意：toolId 不能含连字符！
// FastGPT 主应用 runTool.ts 用 `tool.id.split('-')[1]` 提取 toolId，
// `systemTool-hk-transport-assistant` 会被切成 "hk"（错误），
// 改用下划线 `hk_transport_assistant` 可正确得到完整 toolId。
const PKG_NAME = 'hk_transport_assistant';

async function build() {
  console.log('开始打包 FastGPT 系统插件...\n');

  if (!existsSync(DIST_DIR)) mkdirSync(DIST_DIR, { recursive: true });
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  // Step 1: esbuild 编译 index.ts 为 IIFE 格式的 bundle.js
  // 使用 IIFE 而不是 CJS，原因：
  //   esbuild CJS 模式对 `export { tool }` 的输出是 `0&&(module.exports={...,tool})` 死代码，
  //   exports.tool 根本没被赋值（见 https://esbuild.github.io/api/#format=cjs 的 re-export 处理）。
  //   IIFE + globalName 会生成 `var __hkPlugin = (() => { ... ; return { tool, InputType, ... }; })();`
  //   这样我们可以可靠读取 __hkPlugin.tool 作为 cb。
  console.log('Step 1: 使用 esbuild 编译 TypeScript → IIFE bundle.js');
  const result = await esbuildBuild({
    entryPoints: [join(ROOT, 'index.ts')],
    bundle: true,
    outfile: join(CACHE_DIR, 'index.js'),
    platform: 'node',
    format: 'iife',
    globalName: '__hkPlugin',
    minify: true,
    sourcemap: false,
    target: 'node18',
    external: [],
  });

  if (result.errors.length > 0) {
    console.error('编译失败:', result.errors);
    process.exit(1);
  }

  const bundledCode = readFileSync(join(CACHE_DIR, 'index.js'), 'utf-8');
  const bundleSizeKB = (Buffer.byteLength(bundledCode) / 1024).toFixed(1);
  console.log(`   Bundle 生成成功 (${bundleSizeKB} KB)`);

  // Step 2: 构建插件配置（元数据）
  console.log('\nStep 2: 构建插件配置');

  const WorkflowIOValueTypeEnum = {
    string: 'string', number: 'number', boolean: 'boolean',
    object: 'object', arrayString: 'arrayString', arrayObject: 'arrayObject', any: 'any',
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
    toolDescription: '查询香港公共交通路线和实时到站时间的工具，输入交通问题即可获得路线方案、到站时间、费用和出行建议',
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

  console.log(`   插件名称: ${config.name['zh-CN']}`);

  const pkgJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));

  // Step 3: 组装 CJS index.js 文件
  // esbuild CJS 输出末尾是 0&&(module.exports={...}) 死代码
  // 需要在末尾追加真正的 module.exports，覆盖掉默认的 exports.tool
  console.log('\nStep 3: 组装 CJS index.js（module.exports）');

  const toolMeta = {
    toolId: PKG_NAME,
    name: config.name,
    description: config.description,
    toolDescription: config.toolDescription,
    tags: config.tags,
    versionList: config.versionList,
    author: pkgJson.author,
    courseUrl: '',
  };

  // CJS bundle 的 exports.tool = <run_function>（使用 Object.defineProperty 或直接赋值）
  // 检查 bundle 是否有 exports.tool（esbuild 会用 __export + Object.defineProperty 生成）
  const metaFields = Object.entries(toolMeta)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(',\n');

  // 最终 index.js：先跑完 esbuild IIFE bundle（会生成 var __hkPlugin = {...}），
  // 再从 __hkPlugin.tool 提取真正的工具函数，最后覆盖 module.exports
  const finalIndexJs = `${bundledCode}

// === Plugin metadata (added by build.mjs, fastgpt-plugin standard) ===
// fastgpt-plugin 解压 .pkg 后 import(index.js).default 得到此对象
// IIFE 格式下 __hkPlugin 是 bundle 导出的对象：{ tool, InputType, OutputType, default }
var __hkPluginToolFn =
  (typeof __hkPlugin !== 'undefined' && __hkPlugin && typeof __hkPlugin.tool === 'function')
    ? __hkPlugin.tool
    : (typeof __hkPlugin !== 'undefined' && __hkPlugin && __hkPlugin.default && typeof __hkPlugin.default.cb === 'function')
    ? __hkPlugin.default.cb
    : null;
module.exports = {
${metaFields},
  "cb": __hkPluginToolFn || (async () => ({ error: 'Plugin tool function not found (IIFE bind failed)' })),
};
module.exports.default = module.exports;
`;

  // Step 4: 用 JSZip 打包为 .pkg（zip 格式）
  console.log('\nStep 4: 用 JSZip 生成 .pkg（zip 格式）');

  const zip = new JSZip();
  zip.file('index.js', finalIndexJs);

  const logoPath = join(ROOT, 'logo.svg');
  if (existsSync(logoPath)) {
    zip.file('logo.svg', readFileSync(logoPath));
    console.log('   已添加 logo.svg');
  } else {
    console.log('   警告: logo.svg 不存在');
  }

  const readmePath = join(ROOT, 'README.md');
  if (existsSync(readmePath)) {
    zip.file('README.md', readFileSync(readmePath));
    console.log('   已添加 README.md');
  }

  const pkgContent = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  const pkgPath = join(DIST_DIR, `${PKG_NAME}.pkg`);
  writeFileSync(pkgPath, pkgContent);

  const pkgSizeKB = (pkgContent.length / 1024).toFixed(1);
  console.log(`   .pkg 文件生成成功 (${pkgSizeKB} KB)`);

  // Step 5: 验证
  console.log('\nStep 5: 验证 .pkg 文件');
  const checks = [
    { name: '.pkg 文件存在', ok: existsSync(pkgPath) },
    { name: '文件大小合理 (>10KB, <100MB)', ok: pkgContent.length > 10240 && pkgContent.length < 100 * 1024 * 1024 },
    { name: '文件头是 PK (zip 签名)', ok: pkgContent[0] === 0x50 && pkgContent[1] === 0x4B },
  ];

  // 用 JSZip 反向读取验证
  const verifyZip = await JSZip.loadAsync(pkgContent);
  checks.push({ name: 'zip 内有 index.js', ok: !!verifyZip.files['index.js'] });
  checks.push({ name: 'zip 内有 logo.svg', ok: !!verifyZip.files['logo.svg'] });

  let allPassed = true;
  for (const check of checks) {
    const mark = check.ok ? 'OK' : 'FAIL';
    console.log(`   [${mark}] ${check.name}`);
    if (!check.ok) allPassed = false;
  }

  if (!allPassed) {
    console.error('\n.pkg 文件验证失败');
    process.exit(1);
  }

  console.log('\n打包完成!');
  console.log(`输出: ${pkgPath} (${pkgSizeKB} KB)`);
  console.log('\n部署: root 登录 FastGPT → 配置 → 导入插件 → 上传 .pkg 文件');
}

build().catch(err => {
  console.error('打包出错:', err);
  process.exit(1);
});
