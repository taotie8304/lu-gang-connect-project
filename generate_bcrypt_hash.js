/**
 * 使用 bcrypt 生成密码哈希
 */

const bcrypt = require('bcrypt');

const password = 'Huijin8304*';
const saltRounds = 10;

console.log('='.repeat(60));
console.log('使用 bcrypt 生成密码哈希');
console.log('='.repeat(60));
console.log('\n密码:', password);
console.log('Salt rounds:', saltRounds);

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('\n✗ 生成哈希失败:', err.message);
    process.exit(1);
  }
  
  console.log('\nBcrypt 哈希:', hash);
  console.log('\nSQL 命令：');
  console.log(`UPDATE users SET password = '${hash}' WHERE username='root';`);
  console.log('\n' + '='.repeat(60));
  console.log('注意：bcrypt 每次生成的哈希都不同（因为有随机盐）');
  console.log('这是正常的，验证时会自动处理');
  console.log('='.repeat(60));
});
