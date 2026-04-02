// 生成双重 SHA256 哈希（与前端一致）
const crypto = require('crypto');

function hashStr(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

const password = 'Huijin8304*';

// 第一次哈希
const hashedOnce = hashStr(password);
console.log('Password:', password);
console.log('Hash 1:', hashedOnce);

// 第二次哈希（存入数据库的值）
const hashedTwice = hashStr(hashedOnce);
console.log('Hash 2:', hashedTwice);
console.log('');
console.log('SQL:');
console.log(`UPDATE users SET password = '${hashedTwice}' WHERE username='root';`);
