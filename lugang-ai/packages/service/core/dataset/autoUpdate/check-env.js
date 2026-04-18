#!/usr/bin/env node

// 鲁港通 - 环境变量检查脚本

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('鲁港通 - 自动更新功能环境检查');
console.log('========================================\n');

// 颜色定义
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function checkMark(condition) {
  return condition ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
}

// 1. 检查 Node.js 版本
console.log('1. Node.js 版本检查');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
console.log(`   当前版本: ${nodeVersion}`);
if (majorVersion >= 18) {
  console.log(`   ${checkMark(true)} Node.js 版本符合要求 (>= 18)\n`);
} else {
  console.log(`   ${checkMark(false)} Node.js 版本过低，需要 >= 18\n`);
  process.exit(1);
}

// 2. 检查必需的依赖包
console.log('2. 依赖包检查');
const requiredPackages = [
  'cheerio',
  'node-cron',
  'papaparse',
  'node-xlsx',
  'axios'
];

let allPackagesInstalled = true;
for (const pkg of requiredPackages) {
  try {
    require.resolve(pkg);
    console.log(`   ${checkMark(true)} ${pkg}`);
  } catch (e) {
    console.log(`   ${checkMark(false)} ${pkg} - 未安装`);
    allPackagesInstalled = false;
  }
}

if (!allPackagesInstalled) {
  console.log(`\n   ${colors.red}请运行 'pnpm install' 安装缺失的依赖包${colors.reset}\n`);
  process.exit(1);
}
console.log('');

// 3. 检查环境变量
console.log('3. 环境变量检查');

// 尝试加载 .env.local
const envPath = path.join(process.cwd(), 'projects', 'app', '.env.local');
if (fs.existsSync(envPath)) {
  console.log(`   ${checkMark(true)} .env.local 文件存在`);
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  
  // 检查 MongoDB 连接
  if (envContent.includes('MONGODB_URI')) {
    console.log(`   ${checkMark(true)} MONGODB_URI 已配置`);
  } else {
    console.log(`   ${checkMark(false)} MONGODB_URI 未配置`);
  }
  
  // 检查 Redis 连接
  if (envContent.includes('REDIS_URL')) {
    console.log(`   ${checkMark(true)} REDIS_URL 已配置`);
  } else {
    console.log(`   ${checkMark(false)} REDIS_URL 未配置`);
  }
} else {
  console.log(`   ${colors.yellow}⚠${colors.reset} .env.local 文件不存在`);
  console.log(`   请从 .env.template 复制并配置`);
}
console.log('');

// 4. 检查核心文件
console.log('4. 核心文件检查');
const coreFiles = [
  'packages/service/core/dataset/autoUpdate/scraper.ts',
  'packages/service/core/dataset/autoUpdate/detector.ts',
  'packages/service/core/dataset/autoUpdate/downloader.ts',
  'packages/service/core/dataset/autoUpdate/scheduler.ts',
  'packages/service/core/dataset/autoUpdate/index.ts'
];

let allFilesExist = true;
for (const file of coreFiles) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`   ${checkMark(true)} ${file}`);
  } else {
    console.log(`   ${checkMark(false)} ${file} - 不存在`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  console.log(`\n   ${colors.red}部分核心文件缺失${colors.reset}\n`);
  process.exit(1);
}
console.log('');

// 5. 检查 API 路由
console.log('5. API 路由检查');
const apiFiles = [
  'projects/app/src/pages/api/core/dataset/collection/autoUpdate/config.ts',
  'projects/app/src/pages/api/core/dataset/collection/autoUpdate/trigger.ts',
  'projects/app/src/pages/api/core/dataset/collection/autoUpdate/detect.ts',
  'projects/app/src/pages/api/core/dataset/collection/autoUpdate/history.ts'
];

let allApiFilesExist = true;
for (const file of apiFiles) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`   ${checkMark(true)} ${file}`);
  } else {
    console.log(`   ${checkMark(false)} ${file} - 不存在`);
    allApiFilesExist = false;
  }
}

if (!allApiFilesExist) {
  console.log(`\n   ${colors.red}部分 API 路由文件缺失${colors.reset}\n`);
  process.exit(1);
}
console.log('');

// 6. 检查系统集成
console.log('6. 系统集成检查');
const instrumentationPath = path.join(process.cwd(), 'projects', 'app', 'src', 'instrumentation.ts');
if (fs.existsSync(instrumentationPath)) {
  console.log(`   ${checkMark(true)} instrumentation.ts 存在`);
  
  const content = fs.readFileSync(instrumentationPath, 'utf-8');
  if (content.includes('initAutoUpdate')) {
    console.log(`   ${checkMark(true)} initAutoUpdate 已集成`);
  } else {
    console.log(`   ${checkMark(false)} initAutoUpdate 未集成`);
    console.log(`   请在 instrumentation.ts 中添加:`);
    console.log(`   import { initAutoUpdate } from '@fastgpt/service/core/dataset/autoUpdate';`);
    console.log(`   initAutoUpdate();`);
  }
} else {
  console.log(`   ${checkMark(false)} instrumentation.ts 不存在`);
}
console.log('');

// 7. 总结
console.log('========================================');
console.log(`${colors.green}环境检查完成！${colors.reset}`);
console.log('========================================\n');

console.log('下一步:');
console.log('1. 如果所有检查都通过，运行部署脚本:');
console.log('   bash packages/service/core/dataset/autoUpdate/deploy.sh');
console.log('');
console.log('2. 或者手动部署:');
console.log('   pnpm install');
console.log('   pnpm build');
console.log('   创建数据库索引（见 DATABASE_OPTIMIZATION.md）');
console.log('   pnpm dev 或 docker-compose up -d');
console.log('');
console.log('文档:');
console.log('- 部署清单: packages/service/core/dataset/autoUpdate/DEPLOYMENT_CHECKLIST.md');
console.log('- 功能说明: packages/service/core/dataset/autoUpdate/README.md');
console.log('');
