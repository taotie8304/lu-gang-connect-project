/**
 * 为鲁港通后端 root 用户生成 access_token
 */

const crypto = require('crypto');

// 生成一个 32 字符的随机 token
function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

const token = generateToken();

console.log('='.repeat(60));
console.log('为 root 用户生成 access_token');
console.log('='.repeat(60));
console.log('\nAccess Token:', token);
console.log('\n使用方法：');
console.log('1. 将此 token 更新到数据库');
console.log('2. 访问后端：https://api.airscend.com');
console.log('3. 在登录页面，使用 access_token 登录');
console.log('4. 登录后，在设置中修改密码');
console.log('\nSQL 命令：');
console.log(`UPDATE users SET access_token = '${token}' WHERE username='root';`);
console.log('='.repeat(60));
