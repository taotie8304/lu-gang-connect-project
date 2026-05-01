// 鲁港通 - .pkg 文件验证脚本
// 用法：node verify-pkg.mjs [path-to-pkg]
//
// 验证 .pkg 文件的完整性和格式正确性

import { readFileSync } from 'fs';
import { resolve } from 'path';

const pkgPath = process.argv[2] || 'dist/hk-transport-assistant.pkg';
const fullPath = resolve(pkgPath);

console.log(`🔍 验证 .pkg 文件: ${fullPath}\n`);

try {
  const content = readFileSync(fullPath, 'utf-8');
  const pkg = JSON.parse(content);
  const sizeKB = (Buffer.byteLength(content) / 1024).toFixed(1);

  const checks = [
    { name: 'JSON 格式有效', ok: true },
    { name: `文件大小: ${sizeKB} KB`, ok: true },
    { name: 'type = fastgpt-system-plugin', ok: pkg.type === 'fastgpt-system-plugin' },
    { name: `name = ${pkg.name}`, ok: !!pkg.name },
    { name: `version = ${pkg.version}`, ok: !!pkg.version },
    { name: 'config 存在', ok: !!pkg.config },
    { name: `config.name.zh-CN = ${pkg.config?.name?.['zh-CN']}`, ok: !!pkg.config?.name?.['zh-CN'] },
    { name: 'config.description 存在', ok: !!pkg.config?.description?.['zh-CN'] },
    { name: 'config.toolDescription 存在', ok: !!pkg.config?.toolDescription?.['zh-CN'] },
    { name: `versionList 数量: ${pkg.config?.versionList?.length}`, ok: pkg.config?.versionList?.length > 0 },
    { name: `inputs 数量: ${pkg.config?.versionList?.[0]?.inputs?.length}`, ok: pkg.config?.versionList?.[0]?.inputs?.length === 2 },
    { name: `outputs 数量: ${pkg.config?.versionList?.[0]?.outputs?.length}`, ok: pkg.config?.versionList?.[0]?.outputs?.length === 5 },
    { name: `code 长度: ${pkg.code?.length} 字符`, ok: pkg.code?.length > 100 },
    { name: 'metadata 存在', ok: !!pkg.metadata },
    { name: `构建时间: ${pkg.metadata?.buildTime}`, ok: !!pkg.metadata?.buildTime },
  ];

  // 验证 inputs
  const inputs = pkg.config?.versionList?.[0]?.inputs || [];
  const inputKeys = inputs.map(i => i.key);
  checks.push({ name: `input keys: [${inputKeys.join(', ')}]`, ok: inputKeys.includes('question') && inputKeys.includes('language') });

  // 验证 outputs
  const outputs = pkg.config?.versionList?.[0]?.outputs || [];
  const outputKeys = outputs.map(o => o.key);
  const expectedOutputs = ['routes', 'stopETAs', 'paymentInfo', 'tips', 'metadata'];
  checks.push({ name: `output keys: [${outputKeys.join(', ')}]`, ok: expectedOutputs.every(k => outputKeys.includes(k)) });

  let allPassed = true;
  for (const check of checks) {
    const icon = check.ok ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
    if (!check.ok) allPassed = false;
  }

  console.log(allPassed ? '\n🎉 验证通过！可以上传到 FastGPT。' : '\n❌ 验证失败，请检查上述错误。');
  process.exit(allPassed ? 0 : 1);
} catch (err) {
  console.error(`❌ 无法读取或解析 .pkg 文件: ${err.message}`);
  process.exit(1);
}
