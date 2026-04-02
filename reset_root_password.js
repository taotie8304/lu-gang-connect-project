/**
 * 鲁港通 - 重置 root 管理员密码
 * 安全地通过 MongoDB 更新密码
 */

const crypto = require('crypto');

// 新密码
const NEW_PASSWORD = 'Huijin8304*';

// SHA256 哈希函数
function hashStr(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// MongoDB 连接信息
const MONGO_HOST = '156.225.30.134';
const MONGO_PORT = '27017';
const MONGO_USER = 'root';
const MONGO_PASS = 'LuGang2024Secure';
const DB_NAME = 'fastgpt';

// 计算新密码的哈希值
const hashedPassword = hashStr(NEW_PASSWORD);

console.log('='.repeat(60));
console.log('鲁港通 - 重置 root 管理员密码');
console.log('='.repeat(60));
console.log('\n新密码:', NEW_PASSWORD);
console.log('SHA256 哈希:', hashedPassword);
console.log('\n请在服务器上执行以下 MongoDB 命令：');
console.log('='.repeat(60));
console.log(`
# 1. 进入 MongoDB 容器
docker exec -it lugang-ai-mongo mongosh -u root -p LuGang2024Secure --authenticationDatabase admin

# 2. 切换到 fastgpt 数据库
use fastgpt

# 3. 查看当前 root 用户信息（确认用户存在）
db.users.findOne({username: "root"}, {username: 1, _id: 1})

# 4. 更新密码（执行此命令）
db.users.updateOne(
  {username: "root"},
  {$set: {password: "${hashedPassword}"}}
)

# 5. 验证更新（应该显示 modifiedCount: 1）
# 如果显示 matchedCount: 1, modifiedCount: 1 则表示成功

# 6. 退出 MongoDB
exit
`);
console.log('='.repeat(60));
console.log('\n⚠️  重要提示：');
console.log('1. 请复制上面的命令到服务器执行');
console.log('2. 确认看到 modifiedCount: 1 表示密码已成功重置');
console.log('3. 重置后可以使用新密码登录系统');
console.log('='.repeat(60));
