// MongoDB 脚本：查看 root 用户信息
db = db.getSiblingDB('fastgpt');

print("查找 root 用户...");
const user = db.users.findOne({username: "root"});

if (user) {
  print("\n找到 root 用户：");
  print("用户名:", user.username);
  print("密码哈希:", user.password);
  print("用户 ID:", user._id);
} else {
  print("\n未找到 root 用户");
}
