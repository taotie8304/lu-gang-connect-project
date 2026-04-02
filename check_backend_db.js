// 通过 SSH 隧道连接后端 MySQL 数据库检查 root 用户密码
const mysql = require('mysql2/promise');

async function checkBackendPassword() {
  const connection = await mysql.createConnection({
    host: '156.225.30.134',
    port: 3306,
    user: 'lugang_connect',
    password: 'huijin8304',
    database: 'lugang_connect'
  });

  try {
    const [rows] = await connection.execute(
      'SELECT id, username, password, role, status FROM users WHERE username=?',
      ['root']
    );
    
    console.log('后端 root 用户信息：');
    console.log(JSON.stringify(rows, null, 2));
    
    if (rows.length > 0) {
      const user = rows[0];
      console.log('\n密码哈希:', user.password);
      console.log('哈希长度:', user.password ? user.password.length : 0);
      console.log('是否为 bcrypt:', user.password ? user.password.startsWith('$2b$') : false);
    }
  } finally {
    await connection.end();
  }
}

checkBackendPassword().catch(console.error);
