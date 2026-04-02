// 鲁港通后端密码修复脚本
// 后端使用 SHA256 二次哈希，与前端保持一致
const crypto = require('crypto');
const mysql = require('mysql2/promise');

// SHA256 哈希函数（与前端 hashStr 一致）
function hashStr(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function fixBackendPassword() {
  const password = 'Huijin8304*';
  
  // 生成二次哈希（与前端逻辑一致）
  const hashedOnce = hashStr(password);
  const hashedTwice = hashStr(hashedOnce);
  
  console.log('原始密码:', password);
  console.log('第一次哈希:', hashedOnce);
  console.log('第二次哈希:', hashedTwice);
  console.log('');
  
  // 连接数据库
  const connection = await mysql.createConnection({
    host: '156.225.30.134',
    port: 3306,
    user: 'lugang_connect',
    password: 'huijin8304',
    database: 'lugang_connect'
  });

  try {
    // 检查当前密码
    console.log('=== 检查当前 root 用户 ===');
    const [currentRows] = await connection.execute(
      'SELECT id, username, password, role, status FROM users WHERE username=?',
      ['root']
    );
    console.log('当前记录:', JSON.stringify(currentRows, null, 2));
    console.log('');
    
    // 更新为正确的二次哈希密码
    console.log('=== 更新密码为 SHA256 二次哈希 ===');
    const [updateResult] = await connection.execute(
      'UPDATE users SET password=? WHERE username=?',
      [hashedTwice, 'root']
    );
    console.log('更新结果:', updateResult);
    console.log('');
    
    // 验证更新
    console.log('=== 验证更新后的密码 ===');
    const [verifyRows] = await connection.execute(
      'SELECT id, username, password, role, status FROM users WHERE username=?',
      ['root']
    );
    console.log('更新后记录:', JSON.stringify(verifyRows, null, 2));
    
    if (verifyRows.length > 0 && verifyRows[0].password === hashedTwice) {
      console.log('');
      console.log('✅ 密码更新成功！');
      console.log('现在可以使用以下凭据登录后端：');
      console.log('  用户名: root');
      console.log('  密码: Huijin8304*');
    } else {
      console.log('');
      console.log('❌ 密码更新失败，请检查数据库连接');
    }
  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await connection.end();
  }
}

fixBackendPassword().catch(console.error);
