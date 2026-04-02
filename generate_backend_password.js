/**
 * 为鲁港通后端生成密码哈希
 * One API 通常使用 bcrypt 或 MD5
 */

const crypto = require('crypto');

const password = 'Huijin8304*';

// 尝试不同的加密方式
console.log('='.repeat(60));
console.log('鲁港通后端 - 生成密码哈希');
console.log('='.repeat(60));
console.log('\n密码:', password);
console.log('\n可能的哈希方式：\n');

// 1. MD5
const md5Hash = crypto.createHash('md5').update(password).digest('hex');
console.log('1. MD5:', md5Hash);

// 2. SHA256
const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
console.log('2. SHA256:', sha256Hash);

// 3. SHA512
const sha512Hash = crypto.createHash('sha512').update(password).digest('hex');
console.log('3. SHA512:', sha512Hash);

console.log('\n' + '='.repeat(60));
console.log('One API 通常使用 MD5，我们先尝试 MD5');
console.log('='.repeat(60));
console.log('\nSQL 命令：');
console.log(`UPDATE users SET password = '${md5Hash}' WHERE username='root';`);
