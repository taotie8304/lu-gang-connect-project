// 生成正确的 bcrypt 哈希（与后端 One API 一致）
const bcrypt = require('bcrypt');

const password = 'Huijin8304*';
const saltRounds = 10; // bcrypt.DefaultCost

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('错误:', err);
    return;
  }
  
  console.log('密码:', password);
  console.log('Bcrypt 哈希:', hash);
  console.log('\nSQL 更新语句:');
  console.log(`UPDATE users SET password = '${hash}' WHERE username='root';`);
  
  // 验证哈希
  bcrypt.compare(password, hash, (err, result) => {
    if (result) {
      console.log('\n✅ 哈希验证成功');
    } else {
      console.log('\n❌ 哈希验证失败');
    }
  });
});
