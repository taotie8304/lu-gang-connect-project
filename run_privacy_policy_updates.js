/**
 * 鲁港通 - 批量更新隐私政策到数据库
 * 
 * 使用方法：node run_privacy_policy_updates.js
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function runScript(scriptName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 运行脚本: ${scriptName}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // 修改脚本中的 MongoDB 连接字符串
    const { stdout, stderr } = await execPromise(
      `node -e "const script = require('fs').readFileSync('${scriptName}', 'utf8').replace(/mongodb:\\/\\/root:LuGang2024Secure@mongo:27017/g, 'mongodb://root:password@localhost:27017'); eval(script);"`
    );
    
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log(`✅ ${scriptName} 执行完成\n`);
    return true;
  } catch (error) {
    console.error(`❌ ${scriptName} 执行失败:`, error.message);
    return false;
  }
}

async function main() {
  console.log('📋 开始更新隐私政策到数据库...\n');
  
  const scripts = [
    'add_privacy_policy_zh_hant.js',  // 繁体版本
    'add_privacy_policy_en.js',       // 英文版本
    'convert_privacy_policy_to_simplified.js'  // 简体版本（通过转换生成）
  ];
  
  let successCount = 0;
  
  for (const script of scripts) {
    const success = await runScript(script);
    if (success) successCount++;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 执行结果: ${successCount}/${scripts.length} 个脚本成功`);
  console.log('='.repeat(60));
  
  if (successCount === scripts.length) {
    console.log('\n✅ 所有隐私政策已成功更新到数据库！');
  } else {
    console.log('\n⚠️  部分脚本执行失败，请检查错误信息');
  }
}

main();
