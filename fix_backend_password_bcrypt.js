// 鲁港通后端密码修复脚本 - 使用 bcrypt
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function fixBackendPassword() {
  const password = 'Huijin8304*';
  
  // 生成 bcrypt 哈希（与后端 Go 代码一致）
  const saltRounds = 10; // bcrypt.DefaultCost in Go
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  
  console.log('原始密码:', password);
  console.log('Bcrypt 哈希:', hashedPassword);
  console.log('');
  
  // 验证哈希是否正确
  const isValid = await bcrypt.compare(password, hashedPassword);
  console.log('哈希验证:', isValid ? '✅ 正确' : '❌ 错误');
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
      'SELECT id, username, LEFT(password, 30) as password_preview, role, status FROM users WHERE username=?',
      ['root']
    );
    console.log('当前记录:', JSON.stringify(currentRows, null, 2));
    console.log('');
    
    // 更新为正确的 bcrypt 哈希密码
    console.log('=== 更新密码为 Bcrypt 哈希 ===');
    const [updateResult] = await connection.execute(
      'UPDATE users SET password=? WHERE username=?',
      [hashedPassword, 'root']
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
    
    if (verifyRows.length > 0) {
      // 验证新密码是否可以通过 bcrypt 验证
      const dbHash = verifyRows[0].password;
      const canLogin = await bcrypt.compare(password, dbHash);
      
      console.log('');
      console.log('密码验证测试:', canLogin ? '✅ 成功' : '❌ 失败');
      
      if (canLogin) {
        console.log('');
        console.log('✅ 密码更新成功！');
        console.log('现在可以使用以下凭据登录后端：');
        console.log('  用户名: root');
        console.log('  密码: Huijin8304*');
      }
    }
  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await connection.end();
  }
}

fixBackendPassword().catch(console.error);
